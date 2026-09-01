import { Prisma } from '@hello-shop/database';

export function naturalBalanceChange(
  normalBalance: 'DEBIT' | 'CREDIT',
  debitValue: Prisma.Decimal.Value,
  creditValue: Prisma.Decimal.Value,
) {
  const debit = new Prisma.Decimal(debitValue);
  const credit = new Prisma.Decimal(creditValue);
  return normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);
}
