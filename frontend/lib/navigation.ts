import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Barcode,
  Boxes,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleGauge,
  ClipboardList,
  HandCoins,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  Wrench,
} from 'lucide-react';

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  permission?: string;
  badge?: 'NEW' | number;
  children?: NavigationItem[];
};
const child = (
  id: string,
  label: string,
  href: string,
  permission: string,
  badge?: 'NEW',
): NavigationItem => ({ id, label, href, permission, icon: Package, ...(badge ? { badge } : {}) });

export const navigation: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    permission: 'dashboard.read',
    icon: CircleGauge,
  },
  {
    id: 'parties',
    label: 'Customer & Supplier',
    icon: Users,
    children: [
      child('customers', 'Customer', '/customers', 'customer.read'),
      child('suppliers', 'Supplier', '/suppliers', 'supplier.read'),
    ],
  },
  {
    id: 'product',
    label: 'Product',
    icon: Package,
    children: [
      child('product-new', 'New Product', '/products/new', 'product.create'),
      child('products', 'Product List', '/products', 'product.read'),
      child('brands', 'Brand', '/brands', 'brand.manage'),
      child('categories', 'Category', '/categories', 'category.manage'),
      child('sub-categories', 'Sub Category', '/sub-categories', 'category.manage', 'NEW'),
      child('units', 'Unit', '/units', 'unit.manage'),
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: Boxes,
    children: [
      child('purchase-new', 'Create Purchase', '/purchases/new', 'purchase.create'),
      child('purchases', 'Purchase List', '/purchases', 'purchase.read'),
      child(
        'purchase-returns',
        'Purchase Return List',
        '/purchases/returns',
        'purchase.return.read',
      ),
    ],
  },
  {
    id: 'sale',
    label: 'Sale',
    icon: ShoppingCart,
    children: [
      child('sale-new', 'Create Sale', '/sales/new', 'sale.create'),
      child('sale-vat', 'Sale With Vat', '/sales/vat', 'sale.vat.create', 'NEW'),
      child('sales', 'Sale List', '/sales', 'sale.read'),
      child('sale-returns', 'Sale Return List', '/sales/returns', 'sale.return.read'),
    ],
  },
  {
    id: 'warranty',
    label: 'Warranty',
    icon: ShieldCheck,
    children: [
      child('serials', 'Serial List', '/warranty/serials', 'serial.read'),
      child('rma', 'RMA', '/warranty/rma', 'rma.read'),
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: Wrench,
    children: [
      child('service-new', 'Create Service', '/services/new', 'service.create'),
      child('services', 'Service List', '/services', 'service.read'),
      child('service-report', 'Service Report', '/services/report', 'report.service'),
    ],
  },
  {
    id: 'quotation',
    label: 'Quotation',
    icon: ClipboardList,
    children: [
      child('quotation-new', 'Create Quotation', '/quotations/new', 'quotation.create'),
      child('quotations', 'Quotation List', '/quotations', 'quotation.read'),
    ],
  },
  {
    id: 'damage',
    label: 'Damage',
    icon: Boxes,
    children: [
      child('damage-new', 'Add Damage', '/damages/new', 'damage.create'),
      child('damages', 'Damage List', '/damages', 'damage.read'),
    ],
  },
  {
    id: 'expense',
    label: 'Expense',
    icon: ReceiptText,
    children: [
      child('expenses', 'Expense', '/expenses', 'expense.read'),
      child('expense-types', 'Expense Type', '/expenses/types', 'expense.type.manage'),
      child('expense-by-type', 'Expense By Type', '/expenses/by-type', 'expense.read'),
    ],
  },
  {
    id: 'barcode',
    label: 'Barcode',
    icon: Barcode,
    children: [
      child('barcode-multi', 'Multi Barcode', '/barcodes/multi', 'barcode.generate'),
      child('barcode-single', 'Single Barcode', '/barcodes/single', 'barcode.generate'),
    ],
  },
  {
    id: 'finance',
    label: 'Bank Accounts',
    icon: Banknote,
    children: [
      child('accounts', 'Bank Accounts', '/finance/accounts', 'finance.account.read'),
      child('transfers', 'Balance Transfer', '/finance/transfers', 'finance.transfer.create'),
      child('cheques', 'Cheque', '/finance/cheques', 'cheque.read'),
      child('transactions', 'Transactions', '/finance/transactions', 'finance.transaction.read'),
    ],
  },
  {
    id: 'investment',
    label: 'Investment',
    icon: HandCoins,
    children: [child('investors', 'Investor List', '/investments/investors', 'investment.read')],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: BriefcaseBusiness,
    children: [
      child('team', 'Team', '/hr/team', 'hr.team.read'),
      child('sales-representatives', 'SR List', '/hr/sales-representatives', 'hr.sales-rep.read'),
      child('roles', 'Role', '/hr/roles', 'role.read'),
    ],
  },
  {
    id: 'report',
    label: 'Report',
    icon: ChartNoAxesCombined,
    children: [
      child('report-business', 'Business Report', '/reports/business', 'report.business'),
      child('report-sales', 'Sale Report', '/reports/sales', 'report.sales'),
      child(
        'report-top-customers',
        'Top Customer',
        '/reports/top-customers',
        'report.customer.top',
      ),
      child('report-customers', 'Customer Report', '/reports/customers', 'report.customer'),
      child('report-receivables', 'Receivable Report', '/reports/receivables', 'report.receivable'),
      child('report-payables', 'Payable Report', '/reports/payables', 'report.payable'),
      child(
        'report-low-stock',
        'Low Stock Product List',
        '/reports/low-stock-products',
        'report.stock.low',
      ),
      child('report-alerts', 'Alert Product List', '/reports/alert-products', 'report.stock.alert'),
      child(
        'report-sale-products',
        'Sale Product Report',
        '/reports/sale-products',
        'report.product.sales',
      ),
      child(
        'report-account-payments',
        'Account Payment Report',
        '/reports/account-payments',
        'report.account.payment',
      ),
      child('report-expenses', 'Expense Report', '/reports/expenses', 'report.expense'),
      child(
        'report-transactions',
        'Transaction Report',
        '/reports/transactions',
        'report.transaction',
      ),
      child('report-daily', 'Daily Report', '/reports/daily', 'report.daily'),
      child('report-stock', 'Stock Report', '/reports/stock', 'report.stock'),
      child('report-stock-list', 'Stock List', '/reports/stock-list', 'report.stock.list'),
    ],
  },
  {
    id: 'settings',
    label: 'Business Setting',
    href: '/settings/business',
    permission: 'business.setting.manage',
    icon: Settings,
  },
  { id: 'admin', label: 'Admin', href: '/admin', permission: 'admin.access', icon: ShieldCheck },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: Store,
    badge: 'NEW',
    children: [
      child('marketplace-active', 'Active Marketplace', '/marketplace/active', 'marketplace.read'),
    ],
  },
];

export function visibleNavigation(permissions: ReadonlySet<string>): NavigationItem[] {
  return navigation.flatMap((item) => {
    if (item.permission && !permissions.has(item.permission)) return [];
    if (!item.children) return [item];
    const children = item.children.filter(
      (entry) => !entry.permission || permissions.has(entry.permission),
    );
    return children.length ? [{ ...item, children }] : [];
  });
}
