import { Prisma } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';

export type AccountingLine = {
  accountId: string;
  debit?: Prisma.Decimal.Value;
  credit?: Prisma.Decimal.Value;
  description?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  financialAccountId?: string | null;
  productId?: string | null;
  sourceLineId?: string | null;
};

export type AccountingPostInput = {
  businessId: string;
  actorUserId: string;
  date: Date;
  memo: string;
  sourceType: string;
  sourceId: string;
  sourceEvent: string;
  lines: AccountingLine[];
};

async function nextJournalNumber(tx: Prisma.TransactionClient, businessId: string) {
  const sequence = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'ACCOUNTING_JOURNAL' } },
    create: { businessId, key: 'ACCOUNTING_JOURNAL', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return 'JRN-' + String(sequence.nextValue - 1).padStart(6, '0');
}

export function validateAccountingLines(lines: AccountingLine[]) {
  if (lines.length < 2)
    throw new AppError(422, 'JOURNAL_LINES_REQUIRED', 'A journal requires at least two lines.');
  let debits = new Prisma.Decimal(0);
  let credits = new Prisma.Decimal(0);
  for (const line of lines) {
    const debit = new Prisma.Decimal(line.debit ?? 0);
    const credit = new Prisma.Decimal(line.credit ?? 0);
    if (debit.isNegative() || credit.isNegative() || debit.isZero() === credit.isZero())
      throw new AppError(
        422,
        'INVALID_JOURNAL_LINE',
        'Each journal line must contain exactly one positive debit or credit.',
      );
    debits = debits.plus(debit);
    credits = credits.plus(credit);
  }
  if (!debits.equals(credits))
    throw new AppError(422, 'UNBALANCED_JOURNAL', 'Journal debits and credits must be equal.');
  return { debits, credits };
}

export class AccountingEngine {
  async reverseInTransaction(
    tx: Prisma.TransactionClient,
    businessId: string,
    journalId: string,
    actorUserId: string,
    reversalDate: Date,
  ) {
    const original = await tx.journalEntry.findFirst({
      where: { id: journalId, businessId },
      include: { lines: true },
    });
    if (!original) throw new AppError(404, 'JOURNAL_NOT_FOUND', 'Journal was not found.');
    if (original.status === 'REVERSED') {
      return tx.journalEntry.findFirst({
        where: { reversalOfId: original.id, businessId },
        include: { lines: true },
      });
    }
    if (original.status !== 'POSTED')
      throw new AppError(409, 'JOURNAL_NOT_POSTED', 'Only a posted journal can be reversed.');
    const reversal = await this.postInTransaction(tx, {
      businessId,
      actorUserId,
      date: reversalDate,
      memo: 'Reversal of ' + original.journalNumber + ': ' + original.memo,
      sourceType: 'JOURNAL_REVERSAL',
      sourceId: original.id,
      sourceEvent: 'REVERSED',
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
        description: line.description,
        customerId: line.customerId,
        supplierId: line.supplierId,
        financialAccountId: line.financialAccountId,
        productId: line.productId,
        sourceLineId: line.sourceLineId,
      })),
    });
    if (!reversal)
      throw new AppError(409, 'ACCOUNTING_NOT_INITIALIZED', 'Initialize accounting first.');
    await tx.journalEntry.update({
      where: { id: reversal.id },
      data: { reversalOfId: original.id },
    });
    await tx.journalEntry.update({
      where: { id: original.id },
      data: { status: 'REVERSED', reversedById: reversal.id, version: { increment: 1 } },
    });
    return tx.journalEntry.findUniqueOrThrow({
      where: { id: reversal.id },
      include: { lines: true },
    });
  }

  async postDraftInTransaction(
    tx: Prisma.TransactionClient,
    businessId: string,
    journalId: string,
    actorUserId: string,
  ) {
    const journal = await tx.journalEntry.findFirst({
      where: { id: journalId, businessId },
      include: { lines: true, fiscalPeriod: true },
    });
    if (!journal) throw new AppError(404, 'JOURNAL_NOT_FOUND', 'Journal was not found.');
    if (journal.sourceType !== 'MANUAL')
      throw new AppError(
        409,
        'AUTOMATIC_JOURNAL_IMMUTABLE',
        'Automatic journals cannot be edited.',
      );
    if (journal.status === 'POSTED') return journal;
    if (journal.status !== 'DRAFT')
      throw new AppError(409, 'JOURNAL_NOT_DRAFT', 'Only a draft journal can be posted.');
    if (journal.fiscalPeriod.status !== 'OPEN')
      throw new AppError(409, 'FISCAL_PERIOD_CLOSED', 'The fiscal period is closed.');
    validateAccountingLines(journal.lines);
    const accountIds = [...new Set(journal.lines.map((line) => line.accountId))];
    const allowedAccounts = await tx.chartAccount.count({
      where: { businessId, id: { in: accountIds }, isActive: true, allowManualPosting: true },
    });
    if (allowedAccounts !== accountIds.length)
      throw new AppError(
        422,
        'MANUAL_POSTING_DENIED',
        'Every manual journal account must be active, tenant-owned, and posting-enabled.',
      );
    const posted = await tx.journalEntry.update({
      where: { id: journal.id },
      data: {
        status: 'POSTED',
        postedById: actorUserId,
        postedAt: new Date(),
        version: { increment: 1 },
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: 'accounting.journal.post',
        entityType: 'JournalEntry',
        entityId: journal.id,
        metadata: { journalNumber: journal.journalNumber, sourceType: 'MANUAL' },
      },
    });
    return posted;
  }

  async postInTransaction(tx: Prisma.TransactionClient, input: AccountingPostInput) {
    validateAccountingLines(input.lines);
    const existing = await tx.journalEntry.findUnique({
      where: {
        businessId_sourceType_sourceId_sourceEvent: {
          businessId: input.businessId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceEvent: input.sourceEvent,
        },
      },
      include: { lines: true },
    });
    if (existing) return existing;

    const settings = await tx.accountingSettings.findUnique({
      where: { businessId: input.businessId },
      select: { accountingEnabled: true },
    });
    if (!settings?.accountingEnabled && input.sourceType !== 'MANUAL') return null;
    if (!settings?.accountingEnabled)
      throw new AppError(409, 'ACCOUNTING_NOT_INITIALIZED', 'Initialize accounting first.');

    const period = await tx.fiscalPeriod.findFirst({
      where: {
        businessId: input.businessId,
        status: 'OPEN',
        startDate: { lte: input.date },
        endDate: { gte: input.date },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period)
      throw new AppError(409, 'FISCAL_PERIOD_CLOSED', 'No open fiscal period covers this date.');

    const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
    const accounts = await tx.chartAccount.findMany({
      where: { businessId: input.businessId, id: { in: accountIds }, isActive: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length)
      throw new AppError(
        422,
        'INVALID_JOURNAL_ACCOUNT',
        'Every account must be active and tenant-owned.',
      );

    const journalNumber = await nextJournalNumber(tx, input.businessId);
    const journal = await tx.journalEntry.create({
      data: {
        businessId: input.businessId,
        journalNumber,
        date: input.date,
        memo: input.memo,
        status: 'POSTED',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceEvent: input.sourceEvent,
        fiscalPeriodId: period.id,
        createdById: input.actorUserId,
        postedById: input.actorUserId,
        postedAt: new Date(),
        lines: {
          create: input.lines.map((line) => ({
            businessId: input.businessId,
            accountId: line.accountId,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description ?? null,
            customerId: line.customerId ?? null,
            supplierId: line.supplierId ?? null,
            financialAccountId: line.financialAccountId ?? null,
            productId: line.productId ?? null,
            sourceLineId: line.sourceLineId ?? null,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorUserId: input.actorUserId,
        action: 'accounting.journal.post',
        entityType: 'JournalEntry',
        entityId: journal.id,
        metadata: { journalNumber, sourceType: input.sourceType, sourceId: input.sourceId },
      },
    });
    return journal;
  }
}

export const accountingEngine = new AccountingEngine();
