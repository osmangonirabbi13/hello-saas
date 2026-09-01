import { Prisma, prisma } from '@hello-shop/database';
import type {
  AccountingInitializeInput,
  ChartAccountCreateInput,
  ChartAccountUpdateInput,
  CreditApplicationInput,
  FiscalPeriodCreateInput,
  ManualJournalInput,
  SettlementInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { accountingEngine } from './accounting.engine.js';
import { agingBucket, type AgingBucket } from './accounting-aging.js';
import { naturalBalanceChange } from './accounting-balance.js';

const DEFAULT_ACCOUNTS = [
  ['1000', 'Cash and Bank', 'ASSET', 'DEBIT', 'CASH_AND_BANK'],
  ['1100', 'Accounts Receivable', 'ASSET', 'DEBIT', 'ACCOUNTS_RECEIVABLE'],
  ['1200', 'Inventory', 'ASSET', 'DEBIT', 'INVENTORY'],
  ['1300', 'Input VAT', 'ASSET', 'DEBIT', 'INPUT_VAT'],
  ['1400', 'Other Current Asset', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSET'],
  ['2000', 'Accounts Payable', 'LIABILITY', 'CREDIT', 'ACCOUNTS_PAYABLE'],
  ['2100', 'Expense Payable', 'LIABILITY', 'CREDIT', 'EXPENSE_PAYABLE'],
  ['2200', 'VAT Payable', 'LIABILITY', 'CREDIT', 'VAT_PAYABLE'],
  ['2300', 'Other Current Liability', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY'],
  ['3100', 'Owner Capital', 'EQUITY', 'CREDIT', 'OWNER_CAPITAL'],
  ['3200', 'Retained Earnings', 'EQUITY', 'CREDIT', 'RETAINED_EARNINGS'],
  ['3300', 'Opening Balance Equity', 'EQUITY', 'CREDIT', 'OPENING_BALANCE_EQUITY'],
  ['4000', 'Sales Revenue', 'REVENUE', 'CREDIT', 'SALES_REVENUE'],
  ['4100', 'Service Revenue', 'REVENUE', 'CREDIT', 'SERVICE_REVENUE'],
  ['4200', 'Other Income', 'REVENUE', 'CREDIT', 'OTHER_INCOME'],
  ['4900', 'Sales Returns', 'REVENUE', 'DEBIT', 'SALES_RETURN'],
  ['5000', 'Cost of Goods Sold', 'EXPENSE', 'DEBIT', 'COGS'],
  ['5100', 'Inventory Damage Loss', 'EXPENSE', 'DEBIT', 'INVENTORY_DAMAGE_LOSS'],
  ['6100', 'Rent Expense', 'EXPENSE', 'DEBIT', 'RENT_EXPENSE'],
  ['6200', 'Utility Expense', 'EXPENSE', 'DEBIT', 'UTILITY_EXPENSE'],
  ['6300', 'Marketing Expense', 'EXPENSE', 'DEBIT', 'MARKETING_EXPENSE'],
  ['6400', 'Delivery Expense', 'EXPENSE', 'DEBIT', 'DELIVERY_EXPENSE'],
  ['6900', 'Other Expense', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE'],
] as const;

async function journalNumber(tx: Prisma.TransactionClient, businessId: string) {
  const sequence = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'ACCOUNTING_JOURNAL' } },
    create: { businessId, key: 'ACCOUNTING_JOURNAL', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return 'JRN-' + String(sequence.nextValue - 1).padStart(6, '0');
}

async function financialTransactionNumber(tx: Prisma.TransactionClient, businessId: string) {
  const sequence = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'FINANCIAL_TRANSACTION' } },
    create: { businessId, key: 'FINANCIAL_TRANSACTION', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return 'TXN-' + String(sequence.nextValue - 1).padStart(6, '0');
}

export class AccountingRepository {
  initialize(businessId: string, actorUserId: string, input: AccountingInitializeInput) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.accountingSettings.findUnique({ where: { businessId } });
        if (existing?.accountingEnabled) return existing;
        const accounts = new Map<string, string>();
        for (const [code, name, accountType, normalBalance, systemKey] of DEFAULT_ACCOUNTS) {
          const account = await tx.chartAccount.upsert({
            where: { businessId_code: { businessId, code } },
            update: { name, accountType, normalBalance, systemKey, isSystem: true, isActive: true },
            create: {
              businessId,
              code,
              name,
              accountType,
              normalBalance,
              systemKey,
              isSystem: true,
              allowManualPosting: false,
              createdById: actorUserId,
            },
          });
          accounts.set(systemKey, account.id);
        }
        const now = new Date();
        const month = input.fiscalYearStartMonth - 1;
        const startYear =
          now.getUTCMonth() < month ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
        const startDate = new Date(Date.UTC(startYear, month, 1));
        const endDate = new Date(Date.UTC(startYear + 1, month, 0, 23, 59, 59, 999));
        const fiscalYearName = 'FY ' + startYear + '-' + (startYear + 1);
        await tx.fiscalPeriod.upsert({
          where: { businessId_name: { businessId, name: fiscalYearName } },
          update: {},
          create: { businessId, name: fiscalYearName, startDate, endDate },
        });
        const settings = await tx.accountingSettings.upsert({
          where: { businessId },
          update: { accountingEnabled: true, fiscalYearStartMonth: input.fiscalYearStartMonth },
          create: {
            businessId,
            accountingEnabled: true,
            fiscalYearStartMonth: input.fiscalYearStartMonth,
          },
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId,
            action: 'accounting.initialize',
            entityType: 'AccountingSettings',
            entityId: settings.id,
            metadata: { defaultAccountCount: DEFAULT_ACCOUNTS.length },
          },
        });
        return { settings, accountCount: accounts.size };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  listAccounts(businessId: string) {
    return prisma.chartAccount.findMany({
      where: { businessId },
      include: { parent: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }
  findAccount(businessId: string, id: string) {
    return prisma.chartAccount.findFirst({ where: { id, businessId } });
  }
  createAccount(businessId: string, actorUserId: string, input: ChartAccountCreateInput) {
    return prisma.chartAccount.create({
      data: {
        businessId,
        createdById: actorUserId,
        code: input.code,
        name: input.name,
        accountType: input.accountType,
        normalBalance: input.normalBalance,
        accountSubType: input.accountSubType ?? null,
        parentId: input.parentId ?? null,
        description: input.description ?? null,
        allowManualPosting: input.allowManualPosting,
      },
    });
  }
  async updateAccount(businessId: string, id: string, input: ChartAccountUpdateInput) {
    const current = await prisma.chartAccount.findFirst({ where: { id, businessId } });
    if (!current) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account was not found.');
    if (current.isSystem && input.isActive === false)
      throw new AppError(409, 'SYSTEM_ACCOUNT_REQUIRED', 'System accounts cannot be disabled.');
    return prisma.chartAccount.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.allowManualPosting !== undefined
          ? { allowManualPosting: input.allowManualPosting }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }
  async mapFinancialAccount(businessId: string, id: string, chartAccountId: string) {
    const [financial, account] = await Promise.all([
      prisma.financialAccount.findFirst({ where: { id, businessId, isActive: true } }),
      prisma.chartAccount.findFirst({
        where: {
          id: chartAccountId,
          businessId,
          accountType: 'ASSET',
          isActive: true,
          allowManualPosting: true,
        },
      }),
    ]);
    if (!financial || !account)
      throw new AppError(
        404,
        'ACCOUNT_MAPPING_CONTEXT_NOT_FOUND',
        'Both accounts must be active and belong to this business.',
      );
    return prisma.financialAccount.update({ where: { id }, data: { chartAccountId } });
  }
  async mapExpenseCategory(businessId: string, id: string, chartAccountId: string) {
    const [category, account] = await Promise.all([
      prisma.expenseCategory.findFirst({ where: { id, businessId, isActive: true } }),
      prisma.chartAccount.findFirst({
        where: {
          id: chartAccountId,
          businessId,
          accountType: 'EXPENSE',
          isActive: true,
          allowManualPosting: true,
        },
      }),
    ]);
    if (!category || !account)
      throw new AppError(
        404,
        'EXPENSE_MAPPING_CONTEXT_NOT_FOUND',
        'The category and expense account must belong to this business.',
      );
    return prisma.expenseCategory.update({ where: { id }, data: { chartAccountId } });
  }

  listJournals(businessId: string, query: Record<string, unknown>) {
    return prisma.journalEntry.findMany({
      where: {
        businessId,
        ...(typeof query.status === 'string'
          ? { status: query.status as 'DRAFT' | 'POSTED' | 'REVERSED' }
          : {}),
        ...(typeof query.sourceType === 'string' ? { sourceType: query.sourceType } : {}),
        ...(typeof query.search === 'string'
          ? {
              OR: [
                { journalNumber: { contains: query.search, mode: 'insensitive' } },
                { memo: { contains: query.search, mode: 'insensitive' } },
                { sourceId: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              date: {
                ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
                ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
              },
            }
          : {}),
      },
      include: {
        lines: true,
        createdBy: { select: { displayName: true } },
        postedBy: { select: { displayName: true } },
        reversalOf: { select: { id: true, journalNumber: true } },
        reversal: { select: { id: true, journalNumber: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: Number(query.limit ?? 50),
    });
  }
  findJournal(businessId: string, id: string) {
    return prisma.journalEntry.findFirst({
      where: { id, businessId },
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { displayName: true } },
        postedBy: { select: { displayName: true } },
        reversalOf: { select: { id: true, journalNumber: true } },
        reversal: { select: { id: true, journalNumber: true } },
      },
    });
  }
  createManualJournal(businessId: string, actorUserId: string, input: ManualJournalInput) {
    return prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          id: input.fiscalPeriodId,
          businessId,
          status: 'OPEN',
          startDate: { lte: input.date },
          endDate: { gte: input.date },
        },
      });
      if (!period)
        throw new AppError(409, 'FISCAL_PERIOD_CLOSED', 'No open fiscal period covers this date.');
      const number = await journalNumber(tx, businessId);
      return tx.journalEntry.create({
        data: {
          businessId,
          journalNumber: number,
          date: input.date,
          memo: input.memo,
          sourceType: 'MANUAL',
          sourceId: number,
          sourceEvent: 'MANUAL_ENTRY',
          fiscalPeriodId: period.id,
          createdById: actorUserId,
          lines: {
            create: input.lines.map((line) => ({
              businessId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
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
    });
  }
  updateManualJournal(businessId: string, id: string, input: ManualJournalInput) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.journalEntry.findFirst({
        where: { id, businessId, status: 'DRAFT', sourceType: 'MANUAL' },
      });
      if (!current)
        throw new AppError(
          409,
          'JOURNAL_IMMUTABLE',
          'Only a tenant-owned manual draft can be edited.',
        );
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          id: input.fiscalPeriodId,
          businessId,
          status: 'OPEN',
          startDate: { lte: input.date },
          endDate: { gte: input.date },
        },
      });
      if (!period)
        throw new AppError(409, 'FISCAL_PERIOD_CLOSED', 'No open fiscal period covers this date.');
      await tx.journalLine.deleteMany({ where: { journalEntryId: id, businessId } });
      return tx.journalEntry.update({
        where: { id },
        data: {
          date: input.date,
          memo: input.memo,
          fiscalPeriodId: period.id,
          lines: {
            create: input.lines.map((line) => ({
              businessId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
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
    });
  }
  postJournal(businessId: string, id: string, actorUserId: string) {
    return prisma.$transaction((tx) =>
      accountingEngine.postDraftInTransaction(tx, businessId, id, actorUserId),
    );
  }
  reverseJournal(businessId: string, id: string, actorUserId: string) {
    return prisma.$transaction(
      (tx) => accountingEngine.reverseInTransaction(tx, businessId, id, actorUserId, new Date()),
      { isolationLevel: 'Serializable' },
    );
  }

  async listReceivables(businessId: string, query: Record<string, unknown> = {}) {
    const asOf = query.asOf instanceof Date ? query.asOf : new Date();
    const items = await prisma.receivableItem.findMany({
      where: {
        businessId,
        ...(typeof query.status === 'string'
          ? { status: query.status as 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' }
          : {}),
        ...(typeof query.customerId === 'string' ? { customerId: query.customerId } : {}),
        ...(typeof query.search === 'string'
          ? {
              OR: [
                { sale: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
                { sale: { saleNumber: { contains: query.search, mode: 'insensitive' } } },
                { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              sale: {
                saleDate: {
                  ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
                  ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        customer: true,
        sale: { select: { id: true, saleNumber: true, invoiceNumber: true, saleDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = items
      .map((item) => {
        const aging = agingBucket(item.dueDate, item.sale.saleDate, asOf);
        return { ...item, outstanding: item.originalAmount.minus(item.settledAmount), ...aging };
      })
      .filter((item) => typeof query.ageBucket !== 'string' || item.bucket === query.ageBucket);
    const summary = {
      total: new Prisma.Decimal(0),
      CURRENT: new Prisma.Decimal(0),
      '1_30': new Prisma.Decimal(0),
      '31_60': new Prisma.Decimal(0),
      '61_90': new Prisma.Decimal(0),
      '90_PLUS': new Prisma.Decimal(0),
    };
    for (const row of rows) {
      summary.total = summary.total.plus(row.outstanding);
      summary[row.bucket] = summary[row.bucket].plus(row.outstanding);
    }
    const credits = await prisma.partyCredit.findMany({
      where: {
        businessId,
        kind: 'CUSTOMER_CREDIT',
        status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] },
        ...(typeof query.customerId === 'string' ? { customerId: query.customerId } : {}),
      },
      include: { customer: true },
      orderBy: { occurredAt: 'desc' },
    });
    const availableCredit = credits.reduce(
      (sum, credit) => sum.plus(credit.originalAmount).minus(credit.appliedAmount),
      new Prisma.Decimal(0),
    );
    return { rows, summary, credits, availableCredit, asOf };
  }
  findReceivable(businessId: string, id: string) {
    return prisma.receivableItem.findFirst({
      where: { id, businessId },
      include: { customer: true, sale: true, allocations: true },
    });
  }
  async receivableStatement(businessId: string, id: string) {
    const item = await prisma.receivableItem.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        sale: true,
        allocations: { include: { financialTransaction: true }, orderBy: { allocatedAt: 'asc' } },
        creditApplications: { include: { partyCredit: true }, orderBy: { appliedAt: 'asc' } },
      },
    });
    if (!item) return null;
    const returns = await prisma.saleReturn.findMany({
      where: { businessId, saleId: item.saleId, status: 'POSTED' },
      select: { id: true },
    });
    const credits = await prisma.partyCredit.findMany({
      where: {
        businessId,
        sourceType: 'SALE_RETURN',
        sourceId: { in: returns.map((row) => row.id) },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const events: Array<{
      date: Date;
      document: string;
      reference: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      status: string;
    }> = [
      {
        date: item.sale.saleDate,
        document: 'Sale',
        reference: item.sale.invoiceNumber,
        debit: item.originalAmount,
        credit: new Prisma.Decimal(0),
        status: item.status,
      },
    ];
    for (const allocation of item.allocations) {
      events.push({
        date: allocation.allocatedAt,
        document: 'Payment',
        reference: allocation.financialTransaction.transactionNo,
        debit: new Prisma.Decimal(0),
        credit: allocation.amount,
        status: item.status,
      });
    }
    for (const credit of credits)
      events.push({
        date: credit.occurredAt,
        document: 'Sale Return Credit',
        reference: credit.documentNumber,
        debit: new Prisma.Decimal(0),
        credit: credit.originalAmount,
        status: credit.status,
      });
    for (const application of item.creditApplications)
      if (application.sourceType === 'CUSTOMER_CREDIT_APPLICATION')
        events.push({
          date: application.appliedAt,
          document: 'Credit Application',
          reference: application.partyCredit.documentNumber,
          debit: new Prisma.Decimal(0),
          credit: application.amount,
          status: item.status,
        });
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = new Prisma.Decimal(0);
    const rows = events.map((event) => {
      running = running.plus(event.debit).minus(event.credit);
      return { ...event, runningOutstanding: running };
    });
    const availableCredit = credits.reduce(
      (sum, credit) => sum.plus(credit.originalAmount).minus(credit.appliedAmount),
      new Prisma.Decimal(0),
    );
    return { item, rows, availableCredit };
  }
  receivePayment(businessId: string, id: string, actorUserId: string, input: SettlementInput) {
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.receivableItem.findFirst({ where: { id, businessId } });
        if (!item) throw new AppError(404, 'RECEIVABLE_NOT_FOUND', 'Receivable was not found.');
        const amount = new Prisma.Decimal(input.amount);
        const outstanding = item.originalAmount.minus(item.settledAmount);
        if (amount.greaterThan(outstanding))
          throw new AppError(
            409,
            'RECEIVABLE_OVERPAYMENT',
            'Payment exceeds the outstanding receivable.',
          );
        const financial = await tx.financialAccount.findFirst({
          where: { id: input.financialAccountId, businessId, isActive: true },
          include: { chartAccount: true },
        });
        if (
          !financial?.chartAccount ||
          financial.chartAccount.accountType !== 'ASSET' ||
          !financial.chartAccount.isActive
        )
          throw new AppError(
            409,
            'FINANCIAL_ACCOUNT_MAPPING_REQUIRED',
            'Map this financial account to an active accounting asset account first.',
          );
        const receivable = await tx.chartAccount.findFirst({
          where: { businessId, systemKey: 'ACCOUNTS_RECEIVABLE', isActive: true },
        });
        if (!receivable)
          throw new AppError(
            409,
            'ACCOUNTING_MAPPING_MISSING',
            'Accounts Receivable mapping is missing.',
          );
        const transactionNo = await financialTransactionNumber(tx, businessId);
        const transaction = await tx.financialTransaction.create({
          data: {
            businessId,
            accountId: financial.id,
            transactionNo,
            type: 'MONEY_IN',
            direction: 'IN',
            amount,
            transactionDate: input.date,
            description: 'Customer receivable payment',
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            sourceType: 'RECEIVABLE',
            sourceId: item.id,
            createdById: actorUserId,
          },
        });
        const journal = await accountingEngine.postInTransaction(tx, {
          businessId,
          actorUserId,
          date: input.date,
          memo: 'Receive payment ' + transactionNo,
          sourceType: 'RECEIVABLE_PAYMENT',
          sourceId: transaction.id,
          sourceEvent: 'POSTED',
          lines: [
            {
              accountId: financial.chartAccount.id,
              debit: amount,
              financialAccountId: financial.id,
              customerId: item.customerId,
            },
            { accountId: receivable.id, credit: amount, customerId: item.customerId },
          ],
        });
        if (!journal)
          throw new AppError(409, 'ACCOUNTING_NOT_INITIALIZED', 'Initialize accounting first.');
        const settled = item.settledAmount.plus(amount);
        await tx.receivableItem.update({
          where: { id: item.id },
          data: {
            settledAmount: settled,
            status: settled.equals(item.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
          },
        });
        await tx.receivableAllocation.create({
          data: {
            businessId,
            receivableItemId: item.id,
            financialTransactionId: transaction.id,
            journalEntryId: journal.id,
            amount,
            allocatedAt: input.date,
          },
        });
        return tx.receivableItem.findUniqueOrThrow({
          where: { id: item.id },
          include: { allocations: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async listPayables(businessId: string, query: Record<string, unknown> = {}) {
    const asOf = query.asOf instanceof Date ? query.asOf : new Date();
    const items = await prisma.payableItem.findMany({
      where: {
        businessId,
        ...(typeof query.status === 'string'
          ? { status: query.status as 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' }
          : {}),
        ...(typeof query.supplierId === 'string' ? { supplierId: query.supplierId } : {}),
        ...(typeof query.search === 'string'
          ? {
              OR: [
                { purchase: { purchaseNumber: { contains: query.search, mode: 'insensitive' } } },
                { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              purchase: {
                purchaseDate: {
                  ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
                  ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        supplier: true,
        purchase: { select: { id: true, purchaseNumber: true, purchaseDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = items
      .map((item) => {
        const aging = agingBucket(item.dueDate, item.purchase.purchaseDate, asOf);
        return { ...item, outstanding: item.originalAmount.minus(item.settledAmount), ...aging };
      })
      .filter((item) => typeof query.ageBucket !== 'string' || item.bucket === query.ageBucket);
    const summary: Record<AgingBucket | 'total', Prisma.Decimal> = {
      total: new Prisma.Decimal(0),
      CURRENT: new Prisma.Decimal(0),
      '1_30': new Prisma.Decimal(0),
      '31_60': new Prisma.Decimal(0),
      '61_90': new Prisma.Decimal(0),
      '90_PLUS': new Prisma.Decimal(0),
    };
    for (const row of rows) {
      summary.total = summary.total.plus(row.outstanding);
      summary[row.bucket] = summary[row.bucket].plus(row.outstanding);
    }
    const credits = await prisma.partyCredit.findMany({
      where: {
        businessId,
        kind: 'SUPPLIER_CREDIT',
        status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] },
        ...(typeof query.supplierId === 'string' ? { supplierId: query.supplierId } : {}),
      },
      include: { supplier: true },
      orderBy: { occurredAt: 'desc' },
    });
    const availableCredit = credits.reduce(
      (sum, credit) => sum.plus(credit.originalAmount).minus(credit.appliedAmount),
      new Prisma.Decimal(0),
    );
    return { rows, summary, credits, availableCredit, asOf };
  }
  findPayable(businessId: string, id: string) {
    return prisma.payableItem.findFirst({
      where: { id, businessId },
      include: { supplier: true, purchase: true, allocations: true },
    });
  }
  async payableStatement(businessId: string, id: string) {
    const item = await prisma.payableItem.findFirst({
      where: { id, businessId },
      include: {
        supplier: true,
        purchase: true,
        allocations: { include: { financialTransaction: true }, orderBy: { allocatedAt: 'asc' } },
        creditApplications: { include: { partyCredit: true }, orderBy: { appliedAt: 'asc' } },
      },
    });
    if (!item) return null;
    const returns = await prisma.purchaseReturn.findMany({
      where: { businessId, purchaseId: item.purchaseId, status: 'POSTED' },
      select: { id: true },
    });
    const credits = await prisma.partyCredit.findMany({
      where: {
        businessId,
        sourceType: 'PURCHASE_RETURN',
        sourceId: { in: returns.map((row) => row.id) },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const events: Array<{
      date: Date;
      document: string;
      reference: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      status: string;
    }> = [
      {
        date: item.purchase.purchaseDate,
        document: 'Purchase',
        reference: item.purchase.purchaseNumber,
        debit: new Prisma.Decimal(0),
        credit: item.originalAmount,
        status: item.status,
      },
    ];
    for (const allocation of item.allocations) {
      events.push({
        date: allocation.allocatedAt,
        document: 'Payment',
        reference: allocation.financialTransaction.transactionNo,
        debit: allocation.amount,
        credit: new Prisma.Decimal(0),
        status: item.status,
      });
    }
    for (const credit of credits)
      events.push({
        date: credit.occurredAt,
        document: 'Purchase Return Credit',
        reference: credit.documentNumber,
        debit: credit.originalAmount,
        credit: new Prisma.Decimal(0),
        status: credit.status,
      });
    for (const application of item.creditApplications)
      if (application.sourceType === 'SUPPLIER_CREDIT_APPLICATION')
        events.push({
          date: application.appliedAt,
          document: 'Credit Application',
          reference: application.partyCredit.documentNumber,
          debit: application.amount,
          credit: new Prisma.Decimal(0),
          status: item.status,
        });
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = new Prisma.Decimal(0);
    const rows = events.map((event) => {
      running = running.plus(event.credit).minus(event.debit);
      return { ...event, runningOutstanding: running };
    });
    const availableCredit = credits.reduce(
      (sum, credit) => sum.plus(credit.originalAmount).minus(credit.appliedAmount),
      new Prisma.Decimal(0),
    );
    return { item, rows, availableCredit };
  }
  paySupplier(businessId: string, id: string, actorUserId: string, input: SettlementInput) {
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.payableItem.findFirst({ where: { id, businessId } });
        if (!item) throw new AppError(404, 'PAYABLE_NOT_FOUND', 'Payable was not found.');
        const amount = new Prisma.Decimal(input.amount);
        const outstanding = item.originalAmount.minus(item.settledAmount);
        if (amount.greaterThan(outstanding))
          throw new AppError(
            409,
            'PAYABLE_OVERPAYMENT',
            'Payment exceeds the outstanding payable.',
          );
        const financial = await tx.financialAccount.findFirst({
          where: { id: input.financialAccountId, businessId, isActive: true },
          include: { chartAccount: true },
        });
        if (
          !financial?.chartAccount ||
          financial.chartAccount.accountType !== 'ASSET' ||
          !financial.chartAccount.isActive
        )
          throw new AppError(
            409,
            'FINANCIAL_ACCOUNT_MAPPING_REQUIRED',
            'Map this financial account to an active accounting asset account first.',
          );
        const payable = await tx.chartAccount.findFirst({
          where: { businessId, systemKey: 'ACCOUNTS_PAYABLE', isActive: true },
        });
        if (!payable)
          throw new AppError(
            409,
            'ACCOUNTING_MAPPING_MISSING',
            'Accounts Payable mapping is missing.',
          );
        const transactionNo = await financialTransactionNumber(tx, businessId);
        const transaction = await tx.financialTransaction.create({
          data: {
            businessId,
            accountId: financial.id,
            transactionNo,
            type: 'MONEY_OUT',
            direction: 'OUT',
            amount,
            transactionDate: input.date,
            description: 'Supplier payable payment',
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            sourceType: 'PAYABLE',
            sourceId: item.id,
            createdById: actorUserId,
          },
        });
        const journal = await accountingEngine.postInTransaction(tx, {
          businessId,
          actorUserId,
          date: input.date,
          memo: 'Supplier payment ' + transactionNo,
          sourceType: 'PAYABLE_PAYMENT',
          sourceId: transaction.id,
          sourceEvent: 'POSTED',
          lines: [
            { accountId: payable.id, debit: amount, supplierId: item.supplierId },
            {
              accountId: financial.chartAccount.id,
              credit: amount,
              financialAccountId: financial.id,
              supplierId: item.supplierId,
            },
          ],
        });
        if (!journal)
          throw new AppError(409, 'ACCOUNTING_NOT_INITIALIZED', 'Initialize accounting first.');
        const settled = item.settledAmount.plus(amount);
        await tx.payableItem.update({
          where: { id: item.id },
          data: {
            settledAmount: settled,
            status: settled.equals(item.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
          },
        });
        await tx.payableAllocation.create({
          data: {
            businessId,
            payableItemId: item.id,
            financialTransactionId: transaction.id,
            journalEntryId: journal.id,
            amount,
            allocatedAt: input.date,
          },
        });
        return tx.payableItem.findUniqueOrThrow({
          where: { id: item.id },
          include: { allocations: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  applyPartyCredit(
    businessId: string,
    creditId: string,
    actorUserId: string,
    input: CreditApplicationInput,
    expectedKind: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT',
  ) {
    return prisma.$transaction(
      async (tx) => {
        const credit = await tx.partyCredit.findFirst({ where: { id: creditId, businessId } });
        if (!credit)
          throw new AppError(
            404,
            'PARTY_CREDIT_NOT_FOUND',
            'Customer or supplier credit was not found.',
          );
        if (credit.kind !== expectedKind)
          throw new AppError(
            403,
            'CREDIT_PERMISSION_DENIED',
            'This credit type is not allowed by the selected action.',
          );
        const targetId = input.receivableItemId ?? input.payableItemId!;
        const sourceType =
          credit.kind === 'CUSTOMER_CREDIT'
            ? 'CUSTOMER_CREDIT_APPLICATION'
            : 'SUPPLIER_CREDIT_APPLICATION';
        const sourceId = credit.id + ':' + targetId;
        const existing = await tx.partyCreditApplication.findUnique({
          where: { businessId_sourceType_sourceId: { businessId, sourceType, sourceId } },
        });
        if (existing) return existing;
        const amount = new Prisma.Decimal(input.amount);
        const available = credit.originalAmount.minus(credit.appliedAmount);
        if (amount.greaterThan(available))
          throw new AppError(409, 'CREDIT_OVERAPPLICATION', 'Amount exceeds available credit.');
        const control = await tx.chartAccount.findFirst({
          where: {
            businessId,
            systemKey:
              credit.kind === 'CUSTOMER_CREDIT' ? 'ACCOUNTS_RECEIVABLE' : 'ACCOUNTS_PAYABLE',
            isActive: true,
          },
        });
        if (!control)
          throw new AppError(
            409,
            'ACCOUNTING_MAPPING_MISSING',
            'The required control account is missing.',
          );

        let target: {
          id: string;
          originalAmount: Prisma.Decimal;
          settledAmount: Prisma.Decimal;
        } | null;
        if (credit.kind === 'CUSTOMER_CREDIT') {
          if (!credit.customerId)
            throw new AppError(
              409,
              'WALK_IN_CREDIT_NOT_TRANSFERABLE',
              'Walk-in sale credit remains sale-linked and cannot be applied to another invoice.',
            );
          if (!input.receivableItemId || input.payableItemId)
            throw new AppError(
              422,
              'CREDIT_TARGET_INVALID',
              'Customer credit requires a receivable.',
            );
          target = await tx.receivableItem.findFirst({
            where: { id: input.receivableItemId, businessId, customerId: credit.customerId },
          });
        } else {
          if (!input.payableItemId || input.receivableItemId)
            throw new AppError(422, 'CREDIT_TARGET_INVALID', 'Supplier credit requires a payable.');
          target = await tx.payableItem.findFirst({
            where: { id: input.payableItemId, businessId, supplierId: credit.supplierId! },
          });
        }
        if (!target)
          throw new AppError(
            404,
            'CREDIT_TARGET_NOT_FOUND',
            'The same-party target open item was not found.',
          );
        const outstanding = target.originalAmount.minus(target.settledAmount);
        if (amount.greaterThan(outstanding))
          throw new AppError(409, 'CREDIT_OVERAPPLICATION', 'Amount exceeds target outstanding.');

        const journal = await accountingEngine.postInTransaction(tx, {
          businessId,
          actorUserId,
          date: input.date,
          memo: 'Apply ' + credit.documentNumber,
          sourceType,
          sourceId,
          sourceEvent: 'POSTED',
          lines:
            credit.kind === 'CUSTOMER_CREDIT'
              ? [
                  { accountId: control.id, debit: amount, customerId: credit.customerId },
                  { accountId: control.id, credit: amount, customerId: credit.customerId },
                ]
              : [
                  { accountId: control.id, debit: amount, supplierId: credit.supplierId },
                  { accountId: control.id, credit: amount, supplierId: credit.supplierId },
                ],
        });
        if (!journal)
          throw new AppError(409, 'ACCOUNTING_NOT_INITIALIZED', 'Initialize accounting first.');
        const settled = target.settledAmount.plus(amount);
        if (credit.kind === 'CUSTOMER_CREDIT')
          await tx.receivableItem.update({
            where: { id: target.id },
            data: {
              settledAmount: settled,
              status: settled.equals(target.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        else
          await tx.payableItem.update({
            where: { id: target.id },
            data: {
              settledAmount: settled,
              status: settled.equals(target.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        const appliedAmount = credit.appliedAmount.plus(amount);
        await tx.partyCredit.update({
          where: { id: credit.id },
          data: {
            appliedAmount,
            status: appliedAmount.equals(credit.originalAmount) ? 'APPLIED' : 'PARTIALLY_APPLIED',
          },
        });
        return tx.partyCreditApplication.create({
          data: {
            businessId,
            partyCreditId: credit.id,
            receivableItemId: input.receivableItemId ?? null,
            payableItemId: input.payableItemId ?? null,
            journalEntryId: journal.id,
            amount,
            appliedAt: input.date,
            sourceType,
            sourceId,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  listPeriods(businessId: string) {
    return prisma.fiscalPeriod.findMany({ where: { businessId }, orderBy: { startDate: 'desc' } });
  }
  createPeriod(businessId: string, input: FiscalPeriodCreateInput) {
    return prisma.$transaction(async (tx) => {
      const overlap = await tx.fiscalPeriod.findFirst({
        where: { businessId, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } },
      });
      if (overlap)
        throw new AppError(409, 'FISCAL_PERIOD_OVERLAP', 'Fiscal periods cannot overlap.');
      return tx.fiscalPeriod.create({ data: { businessId, ...input } });
    });
  }
  async setPeriodStatus(businessId: string, id: string, status: 'OPEN' | 'CLOSED') {
    if (status === 'CLOSED') {
      const draftCount = await prisma.journalEntry.count({
        where: { businessId, fiscalPeriodId: id, status: 'DRAFT' },
      });
      if (draftCount)
        throw new AppError(
          409,
          'FISCAL_PERIOD_HAS_DRAFTS',
          'Post or remove draft journals before closing the period.',
        );
    }
    const changed = await prisma.fiscalPeriod.updateMany({
      where: { id, businessId },
      data: { status },
    });
    if (!changed.count)
      throw new AppError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Fiscal period was not found.');
    return prisma.fiscalPeriod.findUniqueOrThrow({ where: { id } });
  }

  async trialBalance(businessId: string, query: Record<string, unknown>) {
    const rows = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        businessId,
        journalEntry: {
          status: 'POSTED',
          ...(query.dateFrom || query.dateTo
            ? {
                date: {
                  ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
                  ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
                },
              }
            : {}),
        },
      },
      _sum: { debit: true, credit: true },
    });
    const accounts = await prisma.chartAccount.findMany({
      where: { businessId, id: { in: rows.map((row) => row.accountId) } },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const result = rows.map((row) => ({
      account: byId.get(row.accountId),
      debit: row._sum.debit ?? new Prisma.Decimal(0),
      credit: row._sum.credit ?? new Prisma.Decimal(0),
    }));
    const totalDebit = result.reduce((sum, row) => sum.plus(row.debit), new Prisma.Decimal(0));
    const totalCredit = result.reduce((sum, row) => sum.plus(row.credit), new Prisma.Decimal(0));
    return { rows: result, totalDebit, totalCredit, balanced: totalDebit.equals(totalCredit) };
  }
  async generalLedger(businessId: string, query: Record<string, unknown>) {
    const period =
      typeof query.fiscalPeriodId === 'string'
        ? await prisma.fiscalPeriod.findFirst({
            where: { id: query.fiscalPeriodId, businessId },
          })
        : null;
    if (typeof query.fiscalPeriodId === 'string' && !period)
      throw new AppError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Fiscal period was not found.');
    const dateFrom = (query.dateFrom as Date | undefined) ?? period?.startDate;
    const dateTo = (query.dateTo as Date | undefined) ?? period?.endDate;
    const accountWhere = typeof query.accountId === 'string' ? { accountId: query.accountId } : {};
    const openingRows = dateFrom
      ? await prisma.journalLine.findMany({
          where: {
            businessId,
            ...accountWhere,
            journalEntry: { status: 'POSTED', date: { lt: dateFrom } },
          },
          include: { account: true },
        })
      : [];
    const openingBalances = new Map<string, Prisma.Decimal>();
    for (const row of openingRows) {
      const natural = naturalBalanceChange(row.account.normalBalance, row.debit, row.credit);
      openingBalances.set(
        row.accountId,
        (openingBalances.get(row.accountId) ?? new Prisma.Decimal(0)).plus(natural),
      );
    }
    const rows = await prisma.journalLine.findMany({
      where: {
        businessId,
        ...accountWhere,
        ...(typeof query.search === 'string'
          ? {
              OR: [
                { description: { contains: query.search, mode: 'insensitive' } },
                {
                  journalEntry: { journalNumber: { contains: query.search, mode: 'insensitive' } },
                },
                { journalEntry: { sourceId: { contains: query.search, mode: 'insensitive' } } },
                { journalEntry: { memo: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        journalEntry: {
          status: 'POSTED',
          ...(typeof query.sourceType === 'string' ? { sourceType: query.sourceType } : {}),
          ...(dateFrom || dateTo
            ? {
                date: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
        },
      },
      include: { account: true, journalEntry: true },
      orderBy: [{ journalEntry: { date: 'asc' } }, { createdAt: 'asc' }],
    });
    const balances = new Map(openingBalances);
    const result = rows.map((row) => {
      const natural = naturalBalanceChange(row.account.normalBalance, row.debit, row.credit);
      const runningBalance = (balances.get(row.accountId) ?? new Prisma.Decimal(0)).plus(natural);
      balances.set(row.accountId, runningBalance);
      return { ...row, runningBalance };
    });
    return {
      rows: result,
      openingBalances: Object.fromEntries(openingBalances),
      closingBalances: Object.fromEntries(balances),
    };
  }
  async profitLoss(businessId: string, query: Record<string, unknown>) {
    const trial = await this.trialBalance(businessId, query);
    const rows = trial.rows.filter(
      (row) => row.account && ['REVENUE', 'EXPENSE'].includes(row.account.accountType),
    );
    const revenue = rows
      .filter((row) => row.account?.accountType === 'REVENUE')
      .reduce((sum, row) => sum.plus(row.credit).minus(row.debit), new Prisma.Decimal(0));
    const cogs = rows
      .filter((row) => row.account?.systemKey === 'COGS')
      .reduce((sum, row) => sum.plus(row.debit).minus(row.credit), new Prisma.Decimal(0));
    const operatingExpenses = rows
      .filter((row) => row.account?.accountType === 'EXPENSE' && row.account.systemKey !== 'COGS')
      .reduce((sum, row) => sum.plus(row.debit).minus(row.credit), new Prisma.Decimal(0));
    const grossProfit = revenue.minus(cogs);
    return {
      rows,
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit: grossProfit.minus(operatingExpenses),
    };
  }
}
