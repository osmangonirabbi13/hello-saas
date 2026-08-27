import argon2 from 'argon2';
import { prisma } from './index.js';
import { assertLocalDatabaseUrl } from './local-safety.js';
import { provisionBusinessAccess } from './access-provisioning.js';

if (process.env.NODE_ENV !== 'development')
  throw new Error('Development bootstrap requires NODE_ENV=development.');
const databaseUrl = process.env.DATABASE_URL;
const email = process.env.DEV_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.DEV_BOOTSTRAP_PASSWORD;
const displayName = process.env.DEV_BOOTSTRAP_DISPLAY_NAME?.trim();
const businessName = process.env.DEV_BOOTSTRAP_BUSINESS_NAME?.trim();
const businessSlug = process.env.DEV_BOOTSTRAP_BUSINESS_SLUG?.trim().toLowerCase();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
assertLocalDatabaseUrl(databaseUrl);
if (!email || !password || !displayName || !businessName || !businessSlug)
  throw new Error('All DEV_BOOTSTRAP_* variables are required.');
if (password.length < 12 || password.includes('replace-with'))
  throw new Error(
    'DEV_BOOTSTRAP_PASSWORD must be a non-placeholder value of at least 12 characters.',
  );
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

const result = await prisma.$transaction(async (transaction) => {
  const business = await transaction.business.upsert({
    where: { slug: businessSlug },
    update: { name: businessName, isActive: true },
    create: { slug: businessSlug, name: businessName },
  });
  const access = await provisionBusinessAccess(transaction, business.id);
  const ownerRoleId = access.roles.get('OWNER');
  if (!ownerRoleId) throw new Error('OWNER provisioning failed.');
  const user = await transaction.user.upsert({
    where: { email },
    update: { displayName, passwordHash, isActive: true },
    create: { email, displayName, passwordHash },
  });
  const membership = await transaction.businessMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    update: { roleId: ownerRoleId, status: 'ACTIVE' },
    create: { businessId: business.id, userId: user.id, roleId: ownerRoleId },
  });
  await transaction.auditLog.create({
    data: {
      businessId: business.id,
      actorUserId: user.id,
      action: 'development.bootstrap',
      entityType: 'BusinessMembership',
      entityId: membership.id,
      metadata: { source: 'local-development-cli' },
    },
  });
  return {
    businessId: business.id,
    userId: user.id,
    membershipId: membership.id,
    permissionCount: access.permissionCount,
    roleCount: access.roles.size,
  };
});

process.stdout.write(JSON.stringify(result) + '\n');
await prisma.$disconnect();
