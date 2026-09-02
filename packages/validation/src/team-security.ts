import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
export const memberStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
export const employmentTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
  'OTHER',
]);
export const teamListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  roleId: z.string().cuid().optional(),
  status: memberStatusSchema.optional(),
});
export const memberUpdateSchema = z.object({
  employeeCode: optionalText(40),
  jobTitle: optionalText(100),
  phone: optionalText(30),
  employmentType: employmentTypeSchema.optional().nullable(),
  joinedAt: z.coerce.date().optional().nullable(),
  notes: optionalText(500),
});
export const memberRoleSchema = z.object({ roleId: z.string().cuid() });
export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roleId: z.string().cuid(),
  jobTitle: optionalText(100),
  employeeCode: optionalText(40),
  expiresInHours: z.number().int().min(1).max(168).default(72),
});
export const invitationAcceptSchema = z.object({ token: z.string().min(40).max(512) });
export const invitationRegistrationSchema = z.object({
  token: z.string().min(40).max(512),
  email: z.string().trim().toLowerCase().email().max(254),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});

export const permissionKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_.-]{2,100}$/);
export const roleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z][A-Za-z0-9 _-]*$/),
  description: optionalText(240),
  isActive: z.boolean().default(true),
  permissions: z.array(permissionKeySchema).max(250),
});

export const approvalActionSchema = z.enum([
  'SALE_HIGH_DISCOUNT',
  'PURCHASE_POST',
  'SALE_RETURN_POST',
  'PURCHASE_RETURN_POST',
  'DAMAGE_POST',
  'EXPENSE_POST',
  'FINANCIAL_MONEY_OUT',
  'FINANCIAL_TRANSFER',
  'FINANCIAL_ADJUSTMENT',
  'MANUAL_JOURNAL_POST',
  'JOURNAL_REVERSE',
  'FISCAL_PERIOD_CLOSE',
  'TEAM_ROLE_CHANGE',
  'TEAM_SUSPEND',
]);
export const approvalPolicySchema = z
  .object({
    enabled: z.boolean(),
    thresholdType: z.enum(['NONE', 'ALWAYS', 'AMOUNT', 'PERCENTAGE']),
    thresholdValue: z
      .string()
      .regex(/^\d+(?:\.\d{1,4})?$/)
      .optional()
      .nullable(),
    approverRoleId: z.string().cuid().optional().nullable(),
    allowSelfApproval: z.boolean().default(false),
    expiresAfterHours: z.number().int().min(1).max(720).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if ((v.thresholdType === 'AMOUNT' || v.thresholdType === 'PERCENTAGE') && !v.thresholdValue)
      ctx.addIssue({
        code: 'custom',
        path: ['thresholdValue'],
        message: 'A threshold value is required.',
      });
    if (v.thresholdType === 'PERCENTAGE' && Number(v.thresholdValue) > 100)
      ctx.addIssue({
        code: 'custom',
        path: ['thresholdValue'],
        message: 'Percentage cannot exceed 100.',
      });
  });
export const approvalDecisionSchema = z.object({ note: z.string().trim().max(500).optional() });
export const approvalListSchema = z.object({
  scope: z.enum(['review', 'mine', 'completed']).optional(),
  search: z.string().trim().max(120).optional(),
  actionType: approvalActionSchema.optional(),
  status: z
    .enum([
      'PENDING',
      'APPROVED',
      'EXECUTING',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'EXECUTED',
      'STALE',
    ])
    .optional(),
  requesterId: z.string().cuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export const auditListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  actorUserId: z.string().cuid().optional(),
  module: z.string().trim().max(80).optional(),
  action: z.string().trim().max(120).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type ApprovalPolicyInput = z.infer<typeof approvalPolicySchema>;
