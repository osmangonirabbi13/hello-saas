import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@hello-shop/database';

export const inviteToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const stablePayloadHash = (payload: unknown) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const forbidden = /password|token|authorization|cookie|secret|private.?key/i;
export function sanitizeAudit(value: unknown): Prisma.InputJsonValue {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (Array.isArray(value)) return value.map(sanitizeAudit);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !forbidden.test(key))
        .map(([key, item]) => [key, sanitizeAudit(item)]),
    );
  }
  return '[unsupported value]';
}

export function policyMatches(
  type: 'NONE' | 'ALWAYS' | 'AMOUNT' | 'PERCENTAGE',
  threshold: Prisma.Decimal | null,
  value: Prisma.Decimal,
) {
  if (type === 'NONE') return false;
  if (type === 'ALWAYS') return true;
  return value.greaterThanOrEqualTo(threshold ?? new Prisma.Decimal(0));
}
