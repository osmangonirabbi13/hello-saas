import { Prisma, prisma } from '@hello-shop/database';
import type {
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput,
  FinancialAdjustmentInput,
  FinancialTransactionCreateInput,
  FinancialTransferInput,
} from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { executeIdempotent, type MutationIdentity } from '../sync/mutation-idempotency.js';

const accountSelect = {
  id: true,
  accountCode: true,
  name: true,
  type: true,
  description: true,
  bankName: true,
  accountHolder: true,
  accountNumber: true,
  branch: true,
  mobileNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
const transactionInclude = {
  account: { select: { id: true, accountCode: true, name: true, type: true } },
  createdBy: { select: { displayName: true } },
} as const;
const transferInclude = {
  sourceAccount: { select: { id: true, accountCode: true, name: true, type: true } },
  destinationAccount: { select: { id: true, accountCode: true, name: true, type: true } },
  createdBy: { select: { displayName: true } },
  transactions: {
    select: { id: true, transactionNo: true, accountId: true, direction: true, amount: true },
    orderBy: { transactionNo: 'asc' as const },
  },
} as const;

async function nextNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  key: 'FINANCIAL_ACCOUNT' | 'FINANCIAL_TRANSACTION' | 'FINANCIAL_TRANSFER',
  prefix: string,
) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `${prefix}-${String(row.nextValue - 1).padStart(6, '0')}`;
}

async function accountBalance(tx: Prisma.TransactionClient, businessId: string, accountId: string) {
  const rows = await tx.financialTransaction.groupBy({
    by: ['direction'],
    where: { businessId, accountId, status: 'POSTED' },
    _sum: { amount: true },
  });
  return rows.reduce(
    (total, row) =>
      row.direction === 'IN' ? total.plus(row._sum.amount ?? 0) : total.minus(row._sum.amount ?? 0),
    new Prisma.Decimal(0),
  );
}

function mask(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export class FinanceRepository {
  async listAccounts(businessId: string, query: Record<string, unknown>) {
    const where: Prisma.FinancialAccountWhereInput = {
      businessId,
      ...(typeof query.type === 'string'
        ? { type: query.type as Prisma.EnumFinancialAccountTypeFilter }
        : {}),
      ...(typeof query.active === 'string' ? { isActive: query.active === 'true' } : {}),
      ...(typeof query.search === 'string'
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { accountCode: { contains: query.search, mode: 'insensitive' } },
              { bankName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [accounts, sums] = await Promise.all([
      prisma.financialAccount.findMany({
        where,
        select: accountSelect,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.financialTransaction.groupBy({
        by: ['accountId', 'direction'],
        where: { businessId, status: 'POSTED' },
        _sum: { amount: true },
      }),
    ]);
    const balances = new Map<string, Prisma.Decimal>();
    for (const row of sums)
      balances.set(
        row.accountId,
        (balances.get(row.accountId) ?? new Prisma.Decimal(0))[
          row.direction === 'IN' ? 'plus' : 'minus'
        ](row._sum.amount ?? 0),
      );
    return accounts.map((account) => ({
      ...account,
      accountNumber: mask(account.accountNumber),
      mobileNumber: mask(account.mobileNumber),
      balance: (balances.get(account.id) ?? new Prisma.Decimal(0)).toFixed(2),
    }));
  }

  async findAccount(businessId: string, id: string) {
    const account = await prisma.financialAccount.findFirst({
      where: { id, businessId },
      select: accountSelect,
    });
    if (!account)
      throw new AppError(404, 'FINANCIAL_ACCOUNT_NOT_FOUND', 'Financial account was not found.');
    const balance = await prisma.$transaction((tx) => accountBalance(tx, businessId, id));
    return {
      ...account,
      balance: balance.toFixed(2),
    };
  }

  createAccount(
    businessId: string,
    userId: string,
    input: FinancialAccountCreateInput,
    identity?: MutationIdentity,
  ) {
    return executeIdempotent({
      businessId,
      userId,
      identity,
      payload: input,
      execute: async (tx) => {
        const accountCode = await nextNumber(tx, businessId, 'FINANCIAL_ACCOUNT', 'ACC');
        const account = await tx.financialAccount.create({
          data: {
            businessId,
            createdById: userId,
            accountCode,
            name: input.name,
            type: input.type,
            description: input.description ?? null,
            bankName: input.bankName ?? null,
            accountHolder: input.accountHolder ?? null,
            accountNumber: input.accountNumber ?? null,
            branch: input.branch ?? null,
            mobileNumber: input.mobileNumber ?? null,
          },
          select: accountSelect,
        });
        if (input.openingBalance) {
          const transactionNo = await nextNumber(tx, businessId, 'FINANCIAL_TRANSACTION', 'TXN');
          const openingTransaction = await tx.financialTransaction.create({
            data: {
              businessId,
              accountId: account.id,
              transactionNo,
              type: 'OPENING_BALANCE',
              direction: 'IN',
              amount: input.openingBalance,
              transactionDate: new Date(),
              description: 'Opening balance',
              createdById: userId,
            },
          });
          await tx.auditLog.create({
            data: {
              businessId,
              actorUserId: userId,
              action: 'financial_transaction.opening_balance',
              entityType: 'FinancialTransaction',
              entityId: openingTransaction.id,
              metadata: { accountId: account.id, transactionNo },
            },
          });
        }
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'financial_account.create',
            entityType: 'FinancialAccount',
            entityId: account.id,
            metadata: {
              accountCode,
              type: input.type,
              openingBalanceCreated: Boolean(input.openingBalance),
            },
          },
        });
        return {
          ...account,
          balance: input.openingBalance ?? '0.00',
        };
      },
    });
  }

  async updateAccount(
    businessId: string,
    id: string,
    userId: string,
    input: FinancialAccountUpdateInput,
  ) {
    const changed = await prisma.financialAccount.updateMany({
      where: { id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
        ...(input.accountHolder !== undefined ? { accountHolder: input.accountHolder } : {}),
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
        ...(input.branch !== undefined ? { branch: input.branch } : {}),
        ...(input.mobileNumber !== undefined ? { mobileNumber: input.mobileNumber } : {}),
      },
    });
    if (!changed.count)
      throw new AppError(404, 'FINANCIAL_ACCOUNT_NOT_FOUND', 'Financial account was not found.');
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: 'financial_account.update',
        entityType: 'FinancialAccount',
        entityId: id,
      },
    });
    return this.findAccount(businessId, id);
  }

  async setAccountActive(businessId: string, id: string, userId: string, isActive: boolean) {
    const changed = await prisma.financialAccount.updateMany({
      where: { id, businessId },
      data: { isActive },
    });
    if (!changed.count)
      throw new AppError(404, 'FINANCIAL_ACCOUNT_NOT_FOUND', 'Financial account was not found.');
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: isActive ? 'financial_account.enable' : 'financial_account.disable',
        entityType: 'FinancialAccount',
        entityId: id,
      },
    });
    return this.findAccount(businessId, id);
  }

  postTransaction(
    businessId: string,
    userId: string,
    input: FinancialTransactionCreateInput | FinancialAdjustmentInput,
    kind: 'MONEY_IN' | 'MONEY_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    identity?: MutationIdentity,
  ) {
    return executeIdempotent({
      businessId,
      userId,
      identity,
      payload: { kind, ...input },
      execute: async (tx) => {
        const account = await tx.financialAccount.findFirst({
          where: { id: input.accountId, businessId },
        });
        if (!account)
          throw new AppError(
            404,
            'FINANCIAL_ACCOUNT_NOT_FOUND',
            'Financial account was not found.',
          );
        if (!account.isActive)
          throw new AppError(
            409,
            'FINANCIAL_ACCOUNT_DISABLED',
            'Disabled accounts cannot receive new transactions.',
          );
        const direction = kind.endsWith('_IN') ? 'IN' : 'OUT';
        if (
          direction === 'OUT' &&
          (await accountBalance(tx, businessId, account.id)).lt(input.amount)
        )
          throw new AppError(
            409,
            'INSUFFICIENT_FUNDS',
            'The account has insufficient available balance.',
          );
        const transactionNo = await nextNumber(tx, businessId, 'FINANCIAL_TRANSACTION', 'TXN');
        const description =
          'reason' in input ? `${input.description} — ${input.reason}` : input.description;
        const transaction = await tx.financialTransaction.create({
          data: {
            businessId,
            accountId: account.id,
            transactionNo,
            type: kind,
            direction,
            amount: input.amount,
            transactionDate: input.transactionDate,
            description,
            counterparty: input.counterparty ?? null,
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            createdById: userId,
          },
          include: transactionInclude,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: `financial_transaction.${kind.toLowerCase()}`,
            entityType: 'FinancialTransaction',
            entityId: transaction.id,
            metadata: { transactionNo, accountId: account.id },
          },
        });
        return transaction;
      },
    });
  }

  createTransfer(
    businessId: string,
    userId: string,
    input: FinancialTransferInput,
    identity?: MutationIdentity,
  ) {
    return executeIdempotent({
      businessId,
      userId,
      identity,
      payload: input,
      execute: async (tx) => {
        const accounts = await tx.financialAccount.findMany({
          where: { businessId, id: { in: [input.sourceAccountId, input.destinationAccountId] } },
        });
        if (accounts.length !== 2)
          throw new AppError(
            404,
            'FINANCIAL_ACCOUNT_NOT_FOUND',
            'Both transfer accounts must belong to the active business.',
          );
        if (accounts.some((account) => !account.isActive))
          throw new AppError(
            409,
            'FINANCIAL_ACCOUNT_DISABLED',
            'Disabled accounts cannot be used for transfers.',
          );
        if ((await accountBalance(tx, businessId, input.sourceAccountId)).lt(input.amount))
          throw new AppError(
            409,
            'INSUFFICIENT_FUNDS',
            'The source account has insufficient available balance.',
          );
        const transferNo = await nextNumber(tx, businessId, 'FINANCIAL_TRANSFER', 'TRF');
        const transfer = await tx.financialTransfer.create({
          data: {
            businessId,
            transferNo,
            sourceAccountId: input.sourceAccountId,
            destinationAccountId: input.destinationAccountId,
            amount: input.amount,
            transferDate: input.transferDate,
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            createdById: userId,
          },
        });
        const outNo = await nextNumber(tx, businessId, 'FINANCIAL_TRANSACTION', 'TXN');
        const inNo = await nextNumber(tx, businessId, 'FINANCIAL_TRANSACTION', 'TXN');
        await tx.financialTransaction.createMany({
          data: [
            {
              businessId,
              accountId: input.sourceAccountId,
              transferId: transfer.id,
              transactionNo: outNo,
              type: 'TRANSFER_OUT',
              direction: 'OUT',
              amount: input.amount,
              transactionDate: input.transferDate,
              description: `Transfer ${transferNo}`,
              reference: input.reference ?? null,
              notes: input.notes ?? null,
              createdById: userId,
            },
            {
              businessId,
              accountId: input.destinationAccountId,
              transferId: transfer.id,
              transactionNo: inNo,
              type: 'TRANSFER_IN',
              direction: 'IN',
              amount: input.amount,
              transactionDate: input.transferDate,
              description: `Transfer ${transferNo}`,
              reference: input.reference ?? null,
              notes: input.notes ?? null,
              createdById: userId,
            },
          ],
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'financial_transfer.post',
            entityType: 'FinancialTransfer',
            entityId: transfer.id,
            metadata: {
              transferNo,
              sourceAccountId: input.sourceAccountId,
              destinationAccountId: input.destinationAccountId,
            },
          },
        });
        return tx.financialTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
          include: transferInclude,
        });
      },
    });
  }

  async listTransactions(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const where = this.transactionWhere(businessId, query);
    const [rows, total] = await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.financialTransaction.count({ where }),
    ]);
    return { rows, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async findTransaction(businessId: string, id: string) {
    const row = await prisma.financialTransaction.findFirst({
      where: { id, businessId },
      include: { ...transactionInclude, transfer: { select: { id: true, transferNo: true } } },
    });
    if (!row)
      throw new AppError(
        404,
        'FINANCIAL_TRANSACTION_NOT_FOUND',
        'Financial transaction was not found.',
      );
    return row;
  }

  async statement(businessId: string, accountId: string, query: Record<string, unknown>) {
    await this.findAccount(businessId, accountId);
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const dateFrom = query.dateFrom instanceof Date ? query.dateFrom : undefined;
    const dateTo = query.dateTo instanceof Date ? query.dateTo : undefined;
    const history = await prisma.financialTransaction.findMany({
      where: {
        businessId,
        accountId,
        status: 'POSTED',
        ...(dateTo ? { transactionDate: { lte: dateTo } } : {}),
      },
      include: transactionInclude,
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    let running = new Prisma.Decimal(0),
      opening = new Prisma.Decimal(0);
    const rows = history.flatMap((row) => {
      running = row.direction === 'IN' ? running.plus(row.amount) : running.minus(row.amount);
      if (dateFrom && row.transactionDate < dateFrom) {
        opening = running;
        return [];
      }
      const matches =
        (!query.type || row.type === query.type) &&
        (!query.direction || row.direction === query.direction) &&
        (!query.search ||
          [row.transactionNo, row.description, row.reference ?? ''].some((value) =>
            value.toLowerCase().includes(String(query.search).toLowerCase()),
          )) &&
        (typeof query.amountMin !== 'string' || row.amount.gte(query.amountMin)) &&
        (typeof query.amountMax !== 'string' || row.amount.lte(query.amountMax));
      return matches ? [{ ...row, runningBalance: running.toFixed(2) }] : [];
    });
    const total = rows.length;
    return {
      openingBalance: opening.toFixed(2),
      closingBalance: running.toFixed(2),
      rows: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listTransfers(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const where: Prisma.FinancialTransferWhereInput = {
      businessId,
      ...(query.dateFrom || query.dateTo
        ? {
            transferDate: {
              ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
              ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
            },
          }
        : {}),
      ...(typeof query.search === 'string'
        ? {
            OR: [
              { transferNo: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.financialTransfer.findMany({
        where,
        include: transferInclude,
        orderBy: [{ transferDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.financialTransfer.count({ where }),
    ]);
    return { rows, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async findTransfer(businessId: string, id: string) {
    const row = await prisma.financialTransfer.findFirst({
      where: { id, businessId },
      include: transferInclude,
    });
    if (!row)
      throw new AppError(404, 'FINANCIAL_TRANSFER_NOT_FOUND', 'Financial transfer was not found.');
    return row;
  }

  private transactionWhere(
    businessId: string,
    query: Record<string, unknown>,
  ): Prisma.FinancialTransactionWhereInput {
    return {
      businessId,
      ...(typeof query.accountId === 'string' ? { accountId: query.accountId } : {}),
      ...(typeof query.type === 'string'
        ? { type: query.type as Prisma.EnumFinancialTransactionTypeFilter }
        : {}),
      ...(typeof query.direction === 'string'
        ? { direction: query.direction as Prisma.EnumFinancialDirectionFilter }
        : {}),
      ...(typeof query.status === 'string'
        ? { status: query.status as Prisma.EnumFinancialTransactionStatusFilter }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            transactionDate: {
              ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
              ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
            },
          }
        : {}),
      ...(typeof query.search === 'string'
        ? {
            OR: [
              { transactionNo: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
              { counterparty: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}
