import { Prisma } from '@hello-shop/database';
import { AppError } from '../../common/errors/app-error.js';
import { accountingEngine, type AccountingLine } from './accounting.engine.js';

export function splitReturnCredit(
  outstandingValue: Prisma.Decimal.Value,
  returnValue: Prisma.Decimal.Value,
) {
  const outstanding = Prisma.Decimal.max(new Prisma.Decimal(outstandingValue), 0);
  const total = new Prisma.Decimal(returnValue);
  const applied = Prisma.Decimal.min(outstanding, total);
  return { applied, available: total.minus(applied) };
}

async function systemAccounts(tx: Prisma.TransactionClient, businessId: string, keys: string[]) {
  const rows = await tx.chartAccount.findMany({
    where: { businessId, systemKey: { in: keys as never[] }, isActive: true },
    select: { id: true, systemKey: true },
  });
  const map = new Map(rows.map((row) => [row.systemKey, row.id]));
  for (const key of keys)
    if (!map.has(key as never))
      throw new AppError(
        409,
        'ACCOUNTING_MAPPING_MISSING',
        'A required accounting mapping is missing.',
      );
  return (key: string) => map.get(key as never)!;
}

export async function postPurchaseAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  purchase: {
    id: string;
    purchaseNumber: string;
    purchaseDate: Date;
    supplierId: string;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalCost: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    dueDate: Date | null;
  },
) {
  const account = await systemAccounts(tx, businessId, [
    'INVENTORY',
    'INPUT_VAT',
    'OTHER_EXPENSE',
    'ACCOUNTS_PAYABLE',
  ]);
  const lines: AccountingLine[] = [
    {
      accountId: account('INVENTORY'),
      debit: purchase.subtotal.minus(purchase.discountAmount),
      supplierId: purchase.supplierId,
    },
    {
      accountId: account('ACCOUNTS_PAYABLE'),
      credit: purchase.grandTotal,
      supplierId: purchase.supplierId,
    },
  ];
  if (purchase.taxAmount.greaterThan(0))
    lines.push({
      accountId: account('INPUT_VAT'),
      debit: purchase.taxAmount,
      supplierId: purchase.supplierId,
    });
  if (purchase.additionalCost.greaterThan(0))
    lines.push({
      accountId: account('OTHER_EXPENSE'),
      debit: purchase.additionalCost,
      supplierId: purchase.supplierId,
      description: 'Unallocated purchase cost',
    });
  const journal = await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: purchase.purchaseDate,
    memo: 'Purchase ' + purchase.purchaseNumber,
    sourceType: 'PURCHASE',
    sourceId: purchase.id,
    sourceEvent: 'POSTED',
    lines,
  });
  if (journal)
    await tx.payableItem.upsert({
      where: { purchaseId: purchase.id },
      update: {},
      create: {
        businessId,
        supplierId: purchase.supplierId,
        purchaseId: purchase.id,
        originalAmount: purchase.grandTotal,
        dueDate: purchase.dueDate,
      },
    });
}

export async function postSaleAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: Date;
    customerId: string | null;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalCost: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    dueDate: Date | null;
  },
) {
  const account = await systemAccounts(tx, businessId, [
    'ACCOUNTS_RECEIVABLE',
    'SALES_REVENUE',
    'VAT_PAYABLE',
    'COGS',
    'INVENTORY',
  ]);
  const revenue = sale.subtotal.minus(sale.discountAmount).plus(sale.additionalCost);
  const valuations = await tx.inventoryCostMovement.findMany({
    where: { businessId, sourceType: 'SALE', sourceId: sale.id },
  });
  const cogs = valuations.reduce(
    (sum, row) => sum.plus(row.totalCostDelta.abs()),
    new Prisma.Decimal(0),
  );
  const lines: AccountingLine[] = [
    {
      accountId: account('ACCOUNTS_RECEIVABLE'),
      debit: sale.grandTotal,
      customerId: sale.customerId,
    },
    { accountId: account('SALES_REVENUE'), credit: revenue, customerId: sale.customerId },
  ];
  if (sale.taxAmount.greaterThan(0))
    lines.push({
      accountId: account('VAT_PAYABLE'),
      credit: sale.taxAmount,
      customerId: sale.customerId,
    });
  if (cogs.greaterThan(0)) {
    lines.push({ accountId: account('COGS'), debit: cogs });
    lines.push({ accountId: account('INVENTORY'), credit: cogs });
  }
  const journal = await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: sale.saleDate,
    memo: 'Sale ' + sale.invoiceNumber,
    sourceType: 'SALE',
    sourceId: sale.id,
    sourceEvent: 'POSTED',
    lines,
  });
  if (journal)
    await tx.receivableItem.upsert({
      where: { saleId: sale.id },
      update: {},
      create: {
        businessId,
        customerId: sale.customerId,
        saleId: sale.id,
        originalAmount: sale.grandTotal,
        dueDate: sale.dueDate,
      },
    });
}

export async function postExpenseAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  expense: {
    id: string;
    expenseNumber: string;
    expenseDate: Date;
    amount: Prisma.Decimal;
    categoryId: string;
  },
) {
  const settings = await tx.accountingSettings.findUnique({ where: { businessId } });
  if (!settings?.accountingEnabled) return;
  const category = await tx.expenseCategory.findFirst({
    where: { id: expense.categoryId, businessId },
    select: { chartAccountId: true },
  });
  if (!category?.chartAccountId)
    throw new AppError(
      409,
      'EXPENSE_ACCOUNT_MAPPING_MISSING',
      'Map this expense category to a ledger account before posting.',
    );
  const account = await systemAccounts(tx, businessId, ['EXPENSE_PAYABLE']);
  await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: expense.expenseDate,
    memo: 'Expense ' + expense.expenseNumber,
    sourceType: 'EXPENSE',
    sourceId: expense.id,
    sourceEvent: 'POSTED',
    lines: [
      { accountId: category.chartAccountId, debit: expense.amount },
      { accountId: account('EXPENSE_PAYABLE'), credit: expense.amount },
    ],
  });
}

export async function postPurchaseReturnAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  item: {
    id: string;
    returnNumber: string;
    returnDate: Date;
    purchaseId: string;
    supplierId: string;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
  },
) {
  const account = await systemAccounts(tx, businessId, [
    'ACCOUNTS_PAYABLE',
    'INVENTORY',
    'INPUT_VAT',
  ]);
  const lines: AccountingLine[] = [
    { accountId: account('ACCOUNTS_PAYABLE'), debit: item.grandTotal, supplierId: item.supplierId },
    {
      accountId: account('INVENTORY'),
      credit: item.subtotal.minus(item.discountAmount),
      supplierId: item.supplierId,
    },
  ];
  if (item.taxAmount.greaterThan(0))
    lines.push({
      accountId: account('INPUT_VAT'),
      credit: item.taxAmount,
      supplierId: item.supplierId,
    });
  const journal = await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: item.returnDate,
    memo: 'Purchase return ' + item.returnNumber,
    sourceType: 'PURCHASE_RETURN',
    sourceId: item.id,
    sourceEvent: 'POSTED',
    lines,
  });
  if (!journal) return;
  const existing = await tx.partyCredit.findUnique({
    where: {
      businessId_sourceType_sourceId: {
        businessId,
        sourceType: 'PURCHASE_RETURN',
        sourceId: item.id,
      },
    },
  });
  if (existing) return;
  const payable = await tx.payableItem.findUnique({ where: { purchaseId: item.purchaseId } });
  const { applied } = splitReturnCredit(
    payable ? payable.originalAmount.minus(payable.settledAmount) : 0,
    item.grandTotal,
  );
  const credit = await tx.partyCredit.create({
    data: {
      businessId,
      kind: 'SUPPLIER_CREDIT',
      supplierId: item.supplierId,
      sourceType: 'PURCHASE_RETURN',
      sourceId: item.id,
      documentNumber: item.returnNumber,
      originalAmount: item.grandTotal,
      appliedAmount: applied,
      status: applied.equals(item.grandTotal)
        ? 'APPLIED'
        : applied.isZero()
          ? 'AVAILABLE'
          : 'PARTIALLY_APPLIED',
      occurredAt: item.returnDate,
    },
  });
  if (payable && applied.greaterThan(0)) {
    const settled = payable.settledAmount.plus(applied);
    await tx.payableItem.update({
      where: { id: payable.id },
      data: {
        settledAmount: settled,
        status: settled.equals(payable.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
      },
    });
    await tx.partyCreditApplication.create({
      data: {
        businessId,
        partyCreditId: credit.id,
        payableItemId: payable.id,
        journalEntryId: journal.id,
        amount: applied,
        appliedAt: item.returnDate,
        sourceType: 'PURCHASE_RETURN',
        sourceId: item.id,
      },
    });
  }
}

export async function postSaleReturnAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  item: {
    id: string;
    returnNumber: string;
    returnDate: Date;
    saleId: string;
    customerId: string | null;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
  },
) {
  const account = await systemAccounts(tx, businessId, [
    'SALES_RETURN',
    'VAT_PAYABLE',
    'ACCOUNTS_RECEIVABLE',
    'INVENTORY',
    'COGS',
  ]);
  const valuations = await tx.inventoryCostMovement.findMany({
    where: { businessId, sourceType: 'SALE_RETURN', sourceId: item.id },
  });
  const restored = valuations.reduce(
    (sum, row) => sum.plus(row.totalCostDelta),
    new Prisma.Decimal(0),
  );
  const lines: AccountingLine[] = [
    {
      accountId: account('SALES_RETURN'),
      debit: item.subtotal.minus(item.discountAmount),
      customerId: item.customerId,
    },
    {
      accountId: account('ACCOUNTS_RECEIVABLE'),
      credit: item.grandTotal,
      customerId: item.customerId,
    },
  ];
  if (item.taxAmount.greaterThan(0))
    lines.push({
      accountId: account('VAT_PAYABLE'),
      debit: item.taxAmount,
      customerId: item.customerId,
    });
  if (restored.greaterThan(0)) {
    lines.push({ accountId: account('INVENTORY'), debit: restored });
    lines.push({ accountId: account('COGS'), credit: restored });
  }
  const journal = await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: item.returnDate,
    memo: 'Sale return ' + item.returnNumber,
    sourceType: 'SALE_RETURN',
    sourceId: item.id,
    sourceEvent: 'POSTED',
    lines,
  });
  if (!journal) return;
  const existing = await tx.partyCredit.findUnique({
    where: {
      businessId_sourceType_sourceId: { businessId, sourceType: 'SALE_RETURN', sourceId: item.id },
    },
  });
  if (existing) return;
  const receivable = await tx.receivableItem.findUnique({ where: { saleId: item.saleId } });
  const { applied } = splitReturnCredit(
    receivable ? receivable.originalAmount.minus(receivable.settledAmount) : 0,
    item.grandTotal,
  );
  const credit = await tx.partyCredit.create({
    data: {
      businessId,
      kind: 'CUSTOMER_CREDIT',
      customerId: item.customerId,
      sourceType: 'SALE_RETURN',
      sourceId: item.id,
      documentNumber: item.returnNumber,
      originalAmount: item.grandTotal,
      appliedAmount: applied,
      status: applied.equals(item.grandTotal)
        ? 'APPLIED'
        : applied.isZero()
          ? 'AVAILABLE'
          : 'PARTIALLY_APPLIED',
      occurredAt: item.returnDate,
    },
  });
  if (receivable && applied.greaterThan(0)) {
    const settled = receivable.settledAmount.plus(applied);
    await tx.receivableItem.update({
      where: { id: receivable.id },
      data: {
        settledAmount: settled,
        status: settled.equals(receivable.originalAmount) ? 'PAID' : 'PARTIALLY_PAID',
      },
    });
    await tx.partyCreditApplication.create({
      data: {
        businessId,
        partyCreditId: credit.id,
        receivableItemId: receivable.id,
        journalEntryId: journal.id,
        amount: applied,
        appliedAt: item.returnDate,
        sourceType: 'SALE_RETURN',
        sourceId: item.id,
      },
    });
  }
}

export async function postDamageAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  item: { id: string; damageNumber: string; damageDate: Date },
) {
  const account = await systemAccounts(tx, businessId, ['INVENTORY_DAMAGE_LOSS', 'INVENTORY']);
  const valuations = await tx.inventoryCostMovement.findMany({
    where: { businessId, sourceType: 'DAMAGE', sourceId: item.id },
  });
  const loss = valuations.reduce(
    (sum, row) => sum.plus(row.totalCostDelta.abs()),
    new Prisma.Decimal(0),
  );
  if (loss.isZero()) return;
  await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: item.damageDate,
    memo: 'Damage ' + item.damageNumber,
    sourceType: 'DAMAGE',
    sourceId: item.id,
    sourceEvent: 'POSTED',
    lines: [
      { accountId: account('INVENTORY_DAMAGE_LOSS'), debit: loss },
      { accountId: account('INVENTORY'), credit: loss },
    ],
  });
}

export async function postFinancialTransactionAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  transaction: {
    id: string;
    transactionNo: string;
    accountId: string;
    transactionDate: Date;
    amount: Prisma.Decimal;
    direction: 'IN' | 'OUT';
  },
  offsetAccountId?: string,
) {
  const settings = await tx.accountingSettings.findUnique({ where: { businessId } });
  if (!settings?.accountingEnabled) return;
  if (!offsetAccountId)
    throw new AppError(
      409,
      'ACCOUNTING_CLASSIFICATION_REQUIRED',
      'Select an accounting classification for this money transaction.',
    );
  const [financial, offset] = await Promise.all([
    tx.financialAccount.findFirst({
      where: { id: transaction.accountId, businessId, isActive: true },
      include: { chartAccount: true },
    }),
    tx.chartAccount.findFirst({
      where: { id: offsetAccountId, businessId, isActive: true, allowManualPosting: true },
    }),
  ]);
  if (!financial?.chartAccount || !offset)
    throw new AppError(
      409,
      'ACCOUNTING_MAPPING_MISSING',
      'Financial and offset accounts require valid same-tenant mappings.',
    );
  const incoming = transaction.direction === 'IN';
  await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: transaction.transactionDate,
    memo: 'Financial transaction ' + transaction.transactionNo,
    sourceType: 'FINANCIAL_TRANSACTION',
    sourceId: transaction.id,
    sourceEvent: 'POSTED',
    lines: incoming
      ? [
          {
            accountId: financial.chartAccount.id,
            debit: transaction.amount,
            financialAccountId: financial.id,
          },
          { accountId: offset.id, credit: transaction.amount },
        ]
      : [
          { accountId: offset.id, debit: transaction.amount },
          {
            accountId: financial.chartAccount.id,
            credit: transaction.amount,
            financialAccountId: financial.id,
          },
        ],
  });
}

export async function postFinancialTransferAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  transfer: {
    id: string;
    transferNo: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: Prisma.Decimal;
    transferDate: Date;
  },
) {
  const settings = await tx.accountingSettings.findUnique({ where: { businessId } });
  if (!settings?.accountingEnabled) return;
  const accounts = await tx.financialAccount.findMany({
    where: {
      businessId,
      id: { in: [transfer.sourceAccountId, transfer.destinationAccountId] },
      isActive: true,
    },
    include: { chartAccount: true },
  });
  const source = accounts.find((row) => row.id === transfer.sourceAccountId);
  const destination = accounts.find((row) => row.id === transfer.destinationAccountId);
  if (!source?.chartAccount || !destination?.chartAccount)
    throw new AppError(
      409,
      'ACCOUNTING_MAPPING_MISSING',
      'Both transfer accounts require same-tenant accounting mappings.',
    );
  await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: transfer.transferDate,
    memo: 'Transfer ' + transfer.transferNo,
    sourceType: 'FINANCIAL_TRANSFER',
    sourceId: transfer.id,
    sourceEvent: 'POSTED',
    lines: [
      {
        accountId: destination.chartAccount.id,
        debit: transfer.amount,
        financialAccountId: destination.id,
      },
      { accountId: source.chartAccount.id, credit: transfer.amount, financialAccountId: source.id },
    ],
  });
}

export async function postServiceAccounting(
  tx: Prisma.TransactionClient,
  businessId: string,
  actorUserId: string,
  service: {
    id: string;
    serviceNumber: string;
    customerId: string | null;
    grandTotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
  },
  deliveredAt: Date,
) {
  if (service.grandTotal.isZero()) return;
  const account = await systemAccounts(tx, businessId, [
    'ACCOUNTS_RECEIVABLE',
    'SERVICE_REVENUE',
    'VAT_PAYABLE',
  ]);
  const lines: AccountingLine[] = [
    {
      accountId: account('ACCOUNTS_RECEIVABLE'),
      debit: service.grandTotal,
      customerId: service.customerId,
    },
    {
      accountId: account('SERVICE_REVENUE'),
      credit: service.grandTotal.minus(service.taxAmount),
      customerId: service.customerId,
    },
  ];
  if (service.taxAmount.greaterThan(0))
    lines.push({
      accountId: account('VAT_PAYABLE'),
      credit: service.taxAmount,
      customerId: service.customerId,
    });
  await accountingEngine.postInTransaction(tx, {
    businessId,
    actorUserId,
    date: deliveredAt,
    memo: 'Service ' + service.serviceNumber,
    sourceType: 'SERVICE',
    sourceId: service.id,
    sourceEvent: 'DELIVERED',
    lines,
  });
}
