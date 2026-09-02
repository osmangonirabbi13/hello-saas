import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  approvalActionSchema,
  approvalDecisionSchema,
  approvalListSchema,
  approvalPolicySchema,
  auditListSchema,
  invitationAcceptSchema,
  invitationCreateSchema,
  invitationRegistrationSchema,
  memberRoleSchema,
  memberUpdateSchema,
  roleInputSchema,
  teamListSchema,
} from '@hello-shop/validation';
import { authenticate } from '../../middleware/auth.middleware.js';
import { resolveTenant } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { teamSecurityController } from './team-security.controller.js';

export function createTeamSecurityRouters(auth: AuthService, repo: AuthRepository) {
  const c = teamSecurityController();
  const team = Router();
  const invitationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  team.post(
    '/invitations/register',
    invitationLimiter,
    validateBody(invitationRegistrationSchema),
    c.registerInvite,
  );
  team.use(authenticate(auth));
  team.post('/invitations/accept', validateBody(invitationAcceptSchema), c.acceptInvite);
  team.use(resolveTenant(repo));
  team.get('/', requirePermission('hr.team.read'), validateQuery(teamListSchema), c.teamList);
  team.get('/invitations', requirePermission('hr.team.read'), c.invitations);
  team.post(
    '/invitations',
    requirePermission('team.invite'),
    validateBody(invitationCreateSchema),
    c.invite,
  );
  team.post('/invitations/:id/revoke', requirePermission('team.invite'), c.revokeInvite);
  team.get('/:id', requirePermission('hr.team.read'), c.member);
  team.patch(
    '/:id',
    requirePermission('team.update'),
    validateBody(memberUpdateSchema),
    c.updateMember,
  );
  team.patch(
    '/:id/role',
    requirePermission('role.manage'),
    validateBody(memberRoleSchema),
    c.changeRole,
  );
  team.post('/:id/suspend', requirePermission('team.suspend'), c.suspend);
  team.post('/:id/reactivate', requirePermission('team.reactivate'), c.reactivate);
  team.post('/:id/revoke-sessions', requirePermission('team.revoke_sessions'), c.revokeSessions);

  const roles = Router();
  roles.use(authenticate(auth), resolveTenant(repo));
  roles.get('/', requirePermission('role.read'), c.roles);
  roles.post('/', requirePermission('role.manage'), validateBody(roleInputSchema), c.createRole);
  roles.get('/:id', requirePermission('role.read'), c.role);
  roles.patch(
    '/:id',
    requirePermission('role.manage'),
    validateBody(roleInputSchema),
    c.updateRole,
  );
  const permissions = Router();
  permissions.use(authenticate(auth), resolveTenant(repo));
  permissions.get('/', requirePermission('permission.read'), c.permissions);
  const approvals = Router();
  approvals.use(authenticate(auth), resolveTenant(repo));
  approvals.get(
    '/',
    requirePermission('approval.read'),
    validateQuery(approvalListSchema),
    c.approvalList,
  );
  approvals.get('/:id', requirePermission('approval.read'), c.approval);
  approvals.post(
    '/:id/approve',
    requirePermission('approval.review'),
    validateBody(approvalDecisionSchema),
    c.approve,
  );
  approvals.post(
    '/:id/reject',
    requirePermission('approval.review'),
    validateBody(approvalDecisionSchema),
    c.reject,
  );
  approvals.post('/:id/cancel', requirePermission('approval.read'), c.cancel);
  const policies = Router();
  policies.use(authenticate(auth), resolveTenant(repo));
  policies.get('/', requirePermission('approval.read'), c.policies);
  policies.patch(
    '/:actionType',
    requirePermission('approval.policy.manage'),
    (q, _r, n) => {
      const parsed = approvalActionSchema.safeParse(q.params.actionType);
      if (!parsed.success) return n(parsed.error);
      n();
    },
    validateBody(approvalPolicySchema),
    c.savePolicy,
  );
  const audits = Router();
  audits.use(authenticate(auth), resolveTenant(repo));
  audits.get('/', requirePermission('audit.read'), validateQuery(auditListSchema), c.auditList);
  audits.get('/:id', requirePermission('audit.read'), c.audit);
  return { team, roles, permissions, approvals, policies, audits };
}
