import type { Prisma, PrismaClient } from '@prisma/client';

export const BUSINESS_PERMISSIONS = [
  'dashboard.read',
  'customer.read',
  'customer.create',
  'customer.update',
  'customer.delete',
  'supplier.read',
  'supplier.create',
  'supplier.update',
  'supplier.delete',
  'product.create',
  'product.read',
  'product.update',
  'product.delete',
  'category.read',
  'category.create',
  'category.update',
  'category.delete',
  'brand.read',
  'brand.create',
  'brand.update',
  'brand.delete',
  'unit.read',
  'unit.create',
  'unit.update',
  'unit.delete',
  'inventory.read',
  'inventory.adjust',
  'inventory.movement.read',
  'warehouse.read',
  'brand.manage',
  'category.manage',
  'unit.manage',
  'purchase.create',
  'purchase.read',
  'purchase.update',
  'purchase.post',
  'purchase.delete_draft',
  'purchase.return.read',
  'sale.create',
  'sale.vat.create',
  'sale.read',
  'sale.return.read',
  'serial.read',
  'rma.read',
  'service.create',
  'service.read',
  'report.service',
  'quotation.create',
  'quotation.read',
  'damage.create',
  'damage.read',
  'expense.read',
  'expense.type.manage',
  'barcode.generate',
  'finance.account.read',
  'finance.transfer.create',
  'cheque.read',
  'finance.transaction.read',
  'investment.read',
  'hr.team.read',
  'hr.sales-rep.read',
  'role.read',
  'report.business',
  'report.sales',
  'report.customer.top',
  'report.customer',
  'report.receivable',
  'report.payable',
  'report.stock.low',
  'report.stock.alert',
  'report.product.sales',
  'report.account.payment',
  'report.expense',
  'report.transaction',
  'report.daily',
  'report.stock',
  'report.stock.list',
  'business.setting.manage',
  'admin.access',
  'marketplace.read',
] as const;

export type BusinessPermission = (typeof BUSINESS_PERMISSIONS)[number];
export const DEFAULT_ROLE_NAMES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'SALES_REP',
  'ACCOUNTANT',
  'WAREHOUSE_MANAGER',
] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];
const reporting: BusinessPermission[] = [
  'dashboard.read',
  'report.business',
  'report.sales',
  'report.customer.top',
  'report.customer',
  'report.receivable',
  'report.payable',
  'report.stock.low',
  'report.stock.alert',
  'report.product.sales',
  'report.account.payment',
  'report.expense',
  'report.transaction',
  'report.daily',
  'report.stock',
  'report.stock.list',
];

export const ROLE_PERMISSION_MAP: Record<DefaultRoleName, readonly BusinessPermission[]> = {
  OWNER: BUSINESS_PERMISSIONS,
  ADMIN: BUSINESS_PERMISSIONS,
  MANAGER: BUSINESS_PERMISSIONS.filter(
    (permission) =>
      !['admin.access', 'business.setting.manage', 'role.read', 'marketplace.read'].includes(
        permission,
      ),
  ),
  CASHIER: [
    'dashboard.read',
    'customer.read',
    'product.read',
    'sale.create',
    'sale.vat.create',
    'sale.read',
    'sale.return.read',
    'serial.read',
    'quotation.create',
    'quotation.read',
    'barcode.generate',
    'finance.account.read',
    'finance.transaction.read',
    'report.daily',
  ],
  SALES_REP: [
    'dashboard.read',
    'customer.read',
    'product.read',
    'sale.create',
    'sale.read',
    'serial.read',
    'quotation.create',
    'quotation.read',
  ],
  ACCOUNTANT: [
    'dashboard.read',
    'customer.read',
    'supplier.read',
    'purchase.read',
    'purchase.return.read',
    'sale.read',
    'sale.return.read',
    'expense.read',
    'expense.type.manage',
    'finance.account.read',
    'finance.transfer.create',
    'cheque.read',
    'finance.transaction.read',
    'investment.read',
    ...reporting,
  ],
  WAREHOUSE_MANAGER: [
    'dashboard.read',
    'supplier.read',
    'product.create',
    'product.read',
    'brand.manage',
    'category.manage',
    'unit.manage',
    'purchase.create',
    'purchase.read',
    'purchase.return.read',
    'serial.read',
    'rma.read',
    'damage.create',
    'damage.read',
    'barcode.generate',
    'report.stock.low',
    'report.stock.alert',
    'report.stock',
    'report.stock.list',
  ],
};

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function provisionBusinessAccess(client: DatabaseClient, businessId: string) {
  const permissions = await Promise.all(
    BUSINESS_PERMISSIONS.map((key) =>
      client.permission.upsert({
        where: { key },
        update: { description: key },
        create: { key, description: key },
      }),
    ),
  );
  const permissionIds = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const roles = new Map<DefaultRoleName, string>();
  for (const roleName of DEFAULT_ROLE_NAMES) {
    const description = 'Default ' + roleName + ' role';
    const role = await client.role.upsert({
      where: { businessId_name: { businessId, name: roleName } },
      update: { isSystem: true, description },
      create: { businessId, name: roleName, isSystem: true, description },
    });
    roles.set(roleName, role.id);
    const desired = ROLE_PERMISSION_MAP[roleName].map((key) => ({
      roleId: role.id,
      permissionId: permissionIds.get(key)!,
    }));
    await client.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: desired.map((grant) => grant.permissionId) },
      },
    });
    if (desired.length)
      await client.rolePermission.createMany({ data: desired, skipDuplicates: true });
  }
  return { permissionCount: permissions.length, roles };
}
