import { apiError, type ApiErrorBody } from './api-error';

const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window === 'undefined' ? null : sessionStorage.getItem('hello_shop_access_token');
  const response = await fetch(base + path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as { data?: T; error?: ApiErrorBody };
  if (!response.ok || payload.data === undefined) throw apiError(payload.error, 'Request failed.');
  return payload.data;
}
export type Role = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: { permission: { key: string } }[];
  _count?: { memberships: number };
};
export type TeamMember = {
  id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  employeeCode?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  employmentType?: string | null;
  joinedAt?: string | null;
  notes?: string | null;
  user: { id: string; displayName: string; email: string; sessions: { lastUsedAt: string }[] };
  role: Role;
};
export type Permission = {
  key: string;
  module: string;
  label: string;
  description: string;
  risk: 'STANDARD' | 'SENSITIVE' | 'CRITICAL';
};
export type Invitation = {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  role: Role;
  inviteToken?: string;
};
export type Approval = {
  id: string;
  approvalNumber: string;
  actionType: string;
  status: string;
  reason: string;
  sourceType: string;
  sourceId: string;
  requestedAt: string;
  requesterNote?: string | null;
  reviewerNote?: string | null;
  requestedBy: { id: string; displayName: string };
  reviewedBy?: { displayName: string } | null;
  reviewedAt?: string | null;
  executedAt?: string | null;
  impactSummary: string;
  currentSourceState: string;
};
export type Policy = {
  id: string;
  actionType: string;
  enabled: boolean;
  thresholdType: string;
  thresholdValue?: string | null;
  approverRoleId?: string | null;
  allowSelfApproval: boolean;
  expiresAfterHours?: number | null;
};
export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  requestId?: string | null;
  createdAt: string;
  actor?: { displayName: string; email: string } | null;
  metadata?: unknown;
};
const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const securityApi = {
  registerInvitation: (body: unknown) =>
    call<{ userId: string; businessId: string; membershipId: string }>(
      '/team/invitations/register',
      post(body),
    ),
  team: (query = '') => call<TeamMember[]>('/team' + query),
  member: (id: string) => call<TeamMember>('/team/' + id),
  roles: () => call<Role[]>('/roles'),
  permissions: () => call<Permission[]>('/permissions'),
  invite: (body: unknown) => call<Invitation>('/team/invitations', post(body)),
  updateMember: (id: string, body: unknown) =>
    call<TeamMember>('/team/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
  changeRole: (id: string, roleId: string) =>
    call<TeamMember>(`/team/${id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) }),
  suspend: (id: string) => call<TeamMember>(`/team/${id}/suspend`, post()),
  reactivate: (id: string) => call<TeamMember>(`/team/${id}/reactivate`, post()),
  revokeSessions: (id: string) =>
    call<{ revokedCount: number }>(`/team/${id}/revoke-sessions`, post()),
  saveRole: (body: unknown, id?: string) =>
    call<Role>(id ? `/roles/${id}` : '/roles', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    }),
  approvals: (query = '') => call<Approval[]>('/approvals' + query),
  approval: (id: string) => call<Approval>('/approvals/' + id),
  decide: (id: string, action: 'approve' | 'reject', note: string) =>
    call<Approval>(`/approvals/${id}/${action}`, post({ note })),
  cancel: (id: string) => call<Approval>(`/approvals/${id}/cancel`, post()),
  policies: () => call<Policy[]>('/approval-policies'),
  savePolicy: (actionType: string, body: unknown) =>
    call<Policy>(`/approval-policies/${actionType}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  audits: (query = '') => call<AuditEvent[]>('/audit-logs' + query),
  audit: (id: string) => call<AuditEvent>('/audit-logs/' + id),
};
