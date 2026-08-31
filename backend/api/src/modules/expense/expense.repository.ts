import { Prisma, prisma } from '@hello-shop/database';
import type { ExpensePaymentMethod, ExpenseStatus } from '@hello-shop/database';
import type { ExpenseCategoryCreateInput, ExpenseCategoryUpdateInput, ExpenseInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';

const include = {
  business: { select: { name: true } },
  category: true,
  createdBy: { select: { displayName: true } },
  postedBy: { select: { displayName: true } },
} as const;
async function number(tx: Prisma.TransactionClient, businessId: string) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'EXPENSE' } },
    create: { businessId, key: 'EXPENSE', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `EXP-${String(row.nextValue - 1).padStart(6, '0')}`;
}
export class ExpenseRepository {
  categories(businessId: string) {
    return prisma.expenseCategory.findMany({ where: { businessId }, orderBy: { name: 'asc' } });
  }
  async createCategory(
    businessId: string,
    userId: string,
    input: ExpenseCategoryCreateInput,
  ) {
    try {
      return await prisma.expenseCategory.create({
        data: {
          businessId,
          createdById: userId,
          name: input.name,
          description: input.description ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'EXPENSE_CATEGORY_DUPLICATE',
          'An expense category with this name already exists.',
        );
      throw error;
    }
  }
  async updateCategory(
    businessId: string,
    id: string,
    input: ExpenseCategoryUpdateInput,
  ) {
    const result = await prisma.expenseCategory.updateMany({
      where: { id, businessId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    if (!result.count)
      throw new AppError(404, 'EXPENSE_CATEGORY_NOT_FOUND', 'Expense category was not found.');
    return prisma.expenseCategory.findFirstOrThrow({ where: { id, businessId } });
  }
  async list(businessId: string, query: Record<string, unknown>) {
    const page = Number(query.page ?? 1),
      limit = Number(query.limit ?? 20);
    const where: Prisma.ExpenseWhereInput = {
      businessId,
      ...(typeof query.status === 'string' ? { status: query.status as ExpenseStatus } : {}),
      ...(typeof query.categoryId === 'string' ? { categoryId: query.categoryId } : {}),
      ...(typeof query.paymentMethod === 'string'
        ? {
            paymentMethod: query.paymentMethod as ExpensePaymentMethod,
          }
        : {}),
      ...(typeof query.search === 'string'
        ? {
            OR: [
              { expenseNumber: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { payee: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            expenseDate: {
              ...(query.dateFrom ? { gte: query.dateFrom as Date } : {}),
              ...(query.dateTo ? { lte: query.dateTo as Date } : {}),
            },
          }
        : {}),
    };
    const [rows, total, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        include,
        orderBy: { expenseDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where: { ...where, status: 'POSTED' }, _sum: { amount: true } }),
    ]);
    return { rows, total, page, limit, postedTotal: String(aggregate._sum.amount ?? 0) };
  }
  find(businessId: string, id: string) {
    return prisma.expense.findFirst({ where: { id, businessId }, include });
  }
  async create(businessId: string, userId: string, input: ExpenseInput) {
    return prisma.$transaction(
      async (tx) => {
        const category = await tx.expenseCategory.findFirst({
          where: { id: input.categoryId, businessId, isActive: true },
        });
        if (!category)
          throw new AppError(
            404,
            'EXPENSE_CATEGORY_NOT_FOUND',
            'Active expense category was not found.',
          );
        const expenseNumber = await number(tx, businessId);
        const item = await tx.expense.create({
          data: {
            businessId,
            createdById: userId,
            expenseNumber,
            categoryId: input.categoryId,
            expenseDate: input.expenseDate,
            amount: input.amount,
            description: input.description,
            payee: input.payee ?? null,
            paymentMethod: input.paymentMethod ?? null,
            reference: input.reference ?? null,
            notes: input.notes ?? null,
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'expense.create',
            entityType: 'Expense',
            entityId: item.id,
          },
        });
        return item;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async update(businessId: string, id: string, userId: string, input: ExpenseInput) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: input.categoryId, businessId, isActive: true },
    });
    if (!category)
      throw new AppError(
        404,
        'EXPENSE_CATEGORY_NOT_FOUND',
        'Active expense category was not found.',
      );
    const changed = await prisma.expense.updateMany({
      where: { id, businessId, status: 'DRAFT' },
      data: {
        categoryId: input.categoryId,
        expenseDate: input.expenseDate,
        amount: input.amount,
        description: input.description,
        payee: input.payee ?? null,
        paymentMethod: input.paymentMethod ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new AppError(409, 'EXPENSE_IMMUTABLE', 'Only a draft expense can be edited.');
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: 'expense.update',
        entityType: 'Expense',
        entityId: id,
      },
    });
    return prisma.expense.findFirstOrThrow({ where: { id, businessId }, include });
  }
  async post(businessId: string, id: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.expense.findFirst({ where: { id, businessId }, include });
        if (!existing) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense was not found.');
        if (existing.status === 'POSTED') return existing;
        const changed = await tx.expense.updateMany({
          where: { id, businessId, status: 'DRAFT' },
          data: { status: 'POSTED', postedById: userId, postedAt: new Date() },
        });
        if (!changed.count)
          throw new AppError(409, 'EXPENSE_POST_CONFLICT', 'Expense cannot be posted.');
        await tx.auditLog.create({
          data: {
            businessId,
            actorUserId: userId,
            action: 'expense.post',
            entityType: 'Expense',
            entityId: id,
          },
        });
        return tx.expense.findUniqueOrThrow({ where: { id }, include });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async remove(businessId: string, id: string, userId: string) {
    const changed = await prisma.expense.deleteMany({ where: { id, businessId, status: 'DRAFT' } });
    if (!changed.count)
      throw new AppError(409, 'EXPENSE_DELETE_DENIED', 'Only a draft expense can be deleted.');
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId: userId,
        action: 'expense.delete_draft',
        entityType: 'Expense',
        entityId: id,
      },
    });
  }
}
