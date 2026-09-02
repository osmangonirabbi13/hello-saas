import { prisma } from '@hello-shop/database';
export class AuditRepository {
  list(businessId: string, query: Record<string, unknown>) {
    const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
    const date = (value: unknown) =>
      value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
    const search = text(query.search)?.trim() ?? '';
    const actorUserId = text(query.actorUserId);
    const action = text(query.action);
    const module = text(query.module);
    const dateFrom = date(query.dateFrom);
    const dateTo = date(query.dateTo);
    return prisma.auditLog.findMany({
      where: {
        businessId,
        ...(actorUserId ? { actorUserId } : {}),
        ...(action ? { action } : {}),
        ...(module ? { entityType: module } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { actor: { displayName: { contains: search, mode: 'insensitive' } } },
                { actor: { email: { contains: search, mode: 'insensitive' } } },
                { action: { contains: search, mode: 'insensitive' } },
                { entityType: { contains: search, mode: 'insensitive' } },
                { entityId: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        requestId: true,
        createdAt: true,
        actor: { select: { id: true, displayName: true, email: true } },
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  find(businessId: string, id: string) {
    return prisma.auditLog.findFirst({
      where: { businessId, id },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        requestId: true,
        createdAt: true,
        actor: { select: { id: true, displayName: true, email: true } },
        metadata: true,
      },
    });
  }
}
