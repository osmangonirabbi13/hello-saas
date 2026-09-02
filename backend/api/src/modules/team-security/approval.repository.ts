import { prisma, Prisma, ApprovalActionType } from '@hello-shop/database';
import type { ApprovalPolicyInput } from '@hello-shop/validation';
import { AppError } from '../../common/errors/app-error.js';
import { policyMatches, sanitizeAudit, stablePayloadHash } from './security-utils.js';

async function aprNumber(tx: Prisma.TransactionClient, businessId: string) {
  const row = await tx.businessSequence.upsert({
    where: { businessId_key: { businessId, key: 'APR' } },
    create: { businessId, key: 'APR', nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return `APR-${String(row.nextValue - 1).padStart(6, '0')}`;
}

export type ApprovalCandidate = {
  actionType: ApprovalActionType;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  value: Prisma.Decimal;
  reason: string;
  requesterNote?: string;
  payload: Prisma.InputJsonObject;
};

export class ApprovalRepository {
  async listPolicies(businessId: string) {
    const rows = await prisma.approvalPolicy.findMany({
      where: { businessId },
      include: { approverRole: true },
      orderBy: { actionType: 'asc' },
    });
    const existing = new Map(rows.map((row) => [row.actionType, row]));
    return Object.values(ApprovalActionType).map(
      (actionType) =>
        existing.get(actionType) ?? {
          id: `unconfigured:${actionType}`,
          businessId,
          actionType,
          enabled: false,
          thresholdType: 'NONE' as const,
          thresholdValue: null,
          requiredApprovals: 1,
          approverRoleId: null,
          approverRole: null,
          allowSelfApproval: false,
          expiresAfterHours: null,
        },
    );
  }
  async savePolicy(
    businessId: string,
    actionType: ApprovalActionType,
    actorUserId: string,
    input: ApprovalPolicyInput,
  ) {
    return prisma.$transaction(async (tx) => {
      if (
        input.approverRoleId &&
        !(await tx.role.findFirst({
          where: { businessId, id: input.approverRoleId, isActive: true },
        }))
      )
        throw new AppError(404, 'APPROVER_ROLE_NOT_FOUND', 'Approver role was not found.');
      const data = {
        enabled: input.enabled,
        thresholdType: input.thresholdType,
        thresholdValue: input.thresholdValue ? new Prisma.Decimal(input.thresholdValue) : null,
        approverRoleId: input.approverRoleId ?? null,
        allowSelfApproval: input.allowSelfApproval,
        expiresAfterHours: input.expiresAfterHours ?? null,
        createdById: actorUserId,
      };
      const policy = await tx.approvalPolicy.upsert({
        where: { businessId_actionType: { businessId, actionType } },
        create: { businessId, actionType, ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'approval.policy.updated',
          entityType: 'ApprovalPolicy',
          entityId: policy.id,
          summary: `${actionType} approval policy updated.`,
          metadata: sanitizeAudit(input),
        },
      });
      return policy;
    });
  }
  async evaluateAndRequest(businessId: string, actorUserId: string, candidate: ApprovalCandidate) {
    return prisma.$transaction(async (tx) => {
      const policy = await tx.approvalPolicy.findUnique({
        where: { businessId_actionType: { businessId, actionType: candidate.actionType } },
      });
      if (
        !policy?.enabled ||
        !policyMatches(policy.thresholdType, policy.thresholdValue, candidate.value)
      )
        return { approvalRequired: false as const };
      const payloadHash = stablePayloadHash({
        sourceVersion: candidate.sourceVersion,
        payload: candidate.payload,
      });
      const duplicate = await tx.approvalRequest.findFirst({
        where: {
          businessId,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          payloadHash,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (duplicate?.status === 'APPROVED')
        return { approvalRequired: false as const, approvedRequest: duplicate };
      if (duplicate) return { approvalRequired: true as const, request: duplicate };
      const approvalNumber = await aprNumber(tx, businessId);
      const expiresAt = policy.expiresAfterHours
        ? new Date(Date.now() + policy.expiresAfterHours * 3600000)
        : null;
      const request = await tx.approvalRequest.create({
        data: {
          businessId,
          policyId: policy.id,
          approvalNumber,
          actionType: candidate.actionType,
          requestedById: actorUserId,
          reason: candidate.reason,
          requesterNote: candidate.requesterNote ?? null,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          sourceVersion: candidate.sourceVersion,
          payloadSnapshot: candidate.payload,
          payloadHash,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'approval.requested',
          entityType: 'ApprovalRequest',
          entityId: request.id,
          summary: `${approvalNumber} requested for ${candidate.sourceType}.`,
          metadata: {
            actionType: candidate.actionType,
            sourceId: candidate.sourceId,
            sourceVersion: candidate.sourceVersion,
          },
        },
      });
      return { approvalRequired: true as const, request };
    });
  }
  async list(businessId: string, currentUserId: string, query: Record<string, unknown>) {
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const status = typeof query.status === 'string' ? query.status : undefined;
    const actionType = typeof query.actionType === 'string' ? query.actionType : undefined;
    const requesterId = typeof query.requesterId === 'string' ? query.requesterId : undefined;
    const scope = typeof query.scope === 'string' ? query.scope : undefined;
    const reviewer =
      scope === 'review'
        ? await prisma.businessMembership.findFirst({
            where: { businessId, userId: currentUserId, status: 'ACTIVE' },
            select: { roleId: true },
          })
        : null;
    if (scope === 'review' && !reviewer) return [];
    const dateFrom =
      query.dateFrom instanceof Date
        ? query.dateFrom
        : typeof query.dateFrom === 'string'
          ? new Date(query.dateFrom)
          : undefined;
    const dateTo =
      query.dateTo instanceof Date
        ? query.dateTo
        : typeof query.dateTo === 'string'
          ? new Date(query.dateTo)
          : undefined;
    return prisma.approvalRequest.findMany({
      where: {
        businessId,
        ...(scope === 'review'
          ? {
              status: 'PENDING' as const,
              AND: [
                {
                  OR: [
                    { requestedById: { not: currentUserId } },
                    { policy: { allowSelfApproval: true } },
                  ],
                },
                {
                  OR: [
                    { policy: { approverRoleId: null } },
                    { policy: { approverRoleId: reviewer!.roleId } },
                  ],
                },
              ],
            }
          : scope === 'mine'
            ? { requestedById: currentUserId }
            : scope === 'completed'
              ? {
                  status: {
                    in: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'EXECUTED', 'STALE'],
                  },
                }
              : {}),
        ...(scope !== 'review' && scope !== 'completed' && status
          ? {
              status: status as
                | 'PENDING'
                | 'APPROVED'
                | 'EXECUTING'
                | 'REJECTED'
                | 'CANCELLED'
                | 'EXPIRED'
                | 'EXECUTED'
                | 'STALE',
            }
          : {}),
        ...(actionType ? { actionType: actionType as ApprovalActionType } : {}),
        ...(requesterId ? { requestedById: requesterId } : {}),
        ...(dateFrom || dateTo
          ? {
              requestedAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { approvalNumber: { contains: search, mode: 'insensitive' } },
                { sourceId: { contains: search, mode: 'insensitive' } },
                { reason: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        requestedBy: { select: { id: true, displayName: true } },
        reviewedBy: { select: { id: true, displayName: true } },
        policy: { include: { approverRole: true } },
        decisions: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }
  find(businessId: string, id: string) {
    return prisma.approvalRequest.findFirst({
      where: { businessId, id },
      include: {
        requestedBy: { select: { id: true, displayName: true } },
        reviewedBy: { select: { id: true, displayName: true } },
        policy: { include: { approverRole: true } },
        decisions: true,
      },
    });
  }
  async decide(
    businessId: string,
    id: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { businessId, id },
        include: { policy: true },
      });
      if (!request)
        throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval request was not found.');
      if (request.status !== 'PENDING')
        throw new AppError(409, 'APPROVAL_FINAL', 'This approval request is no longer pending.');
      if (request.expiresAt && request.expiresAt <= new Date()) {
        await tx.approvalRequest.update({ where: { id }, data: { status: 'EXPIRED' } });
        throw new AppError(410, 'APPROVAL_EXPIRED', 'Approval request has expired.');
      }
      if (request.requestedById === reviewerId && !request.policy.allowSelfApproval)
        throw new AppError(403, 'SELF_APPROVAL_DENIED', 'You cannot review your own request.');
      const reviewer = await tx.businessMembership.findFirst({
        where: {
          businessId,
          userId: reviewerId,
          status: 'ACTIVE',
          role: { permissions: { some: { permission: { key: 'approval.review' } } } },
          ...(request.policy.approverRoleId ? { roleId: request.policy.approverRoleId } : {}),
        },
      });
      if (!reviewer)
        throw new AppError(
          403,
          'APPROVER_INELIGIBLE',
          'You are not eligible to review this request.',
        );
      await tx.approvalDecision.create({
        data: { businessId, approvalRequestId: id, reviewerId, decision, note: note ?? null },
      });
      const updated = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: decision,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: note ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId: reviewerId,
          action: decision === 'APPROVED' ? 'approval.approved' : 'approval.rejected',
          entityType: 'ApprovalRequest',
          entityId: id,
          summary: `${request.approvalNumber} ${decision.toLowerCase()}.`,
          metadata: {
            actionType: request.actionType,
            sourceType: request.sourceType,
            sourceId: request.sourceId,
          },
        },
      });
      return updated;
    });
  }
  async cancel(businessId: string, id: string, requesterId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { businessId, id, requestedById: requesterId },
      });
      if (!request)
        throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval request was not found.');
      if (request.status !== 'PENDING')
        throw new AppError(409, 'APPROVAL_FINAL', 'Only pending requests can be cancelled.');
      const updated = await tx.approvalRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorUserId: requesterId,
          action: 'approval.cancelled',
          entityType: 'ApprovalRequest',
          entityId: id,
          summary: `${request.approvalNumber} cancelled.`,
        },
      });
      return updated;
    });
  }
  async execute(
    businessId: string,
    id: string,
    currentVersion: number,
    currentPayload: Prisma.InputJsonObject,
    actorUserId: string,
    execute: () => Promise<unknown>,
  ) {
    const request = await prisma.approvalRequest.findFirst({ where: { businessId, id } });
    if (!request) throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval request was not found.');
    if (request.status === 'EXECUTED') return { alreadyExecuted: true, request };
    if (request.status !== 'APPROVED')
      throw new AppError(
        409,
        'APPROVAL_NOT_APPROVED',
        'Approval must be approved before execution.',
      );
    if (
      request.sourceVersion !== currentVersion ||
      request.payloadHash !==
        stablePayloadHash({ sourceVersion: currentVersion, payload: currentPayload })
    ) {
      await prisma.approvalRequest.update({ where: { id }, data: { status: 'STALE' } });
      await prisma.auditLog.create({
        data: {
          businessId,
          actorUserId,
          action: 'approval.stale',
          entityType: 'ApprovalRequest',
          entityId: id,
          summary: `${request.approvalNumber} became stale.`,
        },
      });
      throw new AppError(
        409,
        'APPROVAL_STALE',
        'This request is no longer valid because the source document changed.',
      );
    }
    const claimed = await prisma.approvalRequest.updateMany({
      where: { id, businessId, status: 'APPROVED', executedAt: null },
      data: { status: 'EXECUTING' },
    });
    if (claimed.count !== 1)
      throw new AppError(
        409,
        'APPROVAL_EXECUTION_IN_PROGRESS',
        'Approval execution is already in progress.',
      );
    let result: unknown;
    try {
      result = await execute();
    } catch (error) {
      await prisma.approvalRequest.updateMany({
        where: { id, businessId, status: 'EXECUTING' },
        data: { status: 'APPROVED' },
      });
      throw error;
    }
    await prisma.approvalRequest.update({
      where: { id },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        businessId,
        actorUserId,
        action: 'approval.executed',
        entityType: 'ApprovalRequest',
        entityId: id,
        summary: `${request.approvalNumber} executed.`,
      },
    });
    return { alreadyExecuted: false, request: await this.find(businessId, id), result };
  }
}
