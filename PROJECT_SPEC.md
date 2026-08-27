PROJECT_SPEC.md

Hello Shop — Bangladesh Market ERP / POS / Inventory / Warranty SaaS

Document version: 1.0
Prepared for: Claude Code implementation
Primary backend: Express.js + TypeScript
Primary frontend: Next.js + TypeScript
Target market: Bangladesh
Reference product: Bseba-inspired workflows, but not a 1:1 visual or code clone

0. Purpose of This Document

This document is the source of truth for building a production-ready, multi-tenant ERP/POS SaaS named Hello Shop.

The product is designed for:

Computer and laptop shops

Mobile and electronics showrooms

Wholesale and distribution businesses

Retail stores

Repair and service centers

Businesses that require serial number, IMEI, warranty, RMA, due, bank, cheque, investment, expense, and staff management

Claude Code must use this file to understand the required product behavior, navigation, architecture, data model, API boundaries, security requirements, and development order.

The implementation must be inspired by the business workflows of the reference system, but must not copy its source code, branding, proprietary assets, or interface pixel-for-pixel.

1. Product Goals

1.1 Primary goals

Manage customers, suppliers, products, purchases, sales, returns, warranty, RMA, services, quotations, damages, expenses, bank accounts, investments, staff, and reports from one system.

Track inventory through an auditable stock movement ledger.

Track serial number and IMEI lifecycle from purchase to sale, return, RMA, and delivery.

Support normal sales and VAT-enabled sales.

Support customer receivable and supplier payable ledgers.

Support Bangladeshi payment channels such as cash, bank, bKash, Nagad, Rocket, cheque, and manual balance transfer.

Provide a clean desktop dashboard and a responsive tablet/mobile experience.

Enforce strict multi-tenant isolation and role-based permissions.

Keep financial and stock operations atomic and auditable.

Produce reliable PDF, print, CSV, and Excel reports.

1.2 Non-goals for the first release

The first production release does not need:

Full manufacturing ERP

Complex payroll and attendance

Advanced offline-first conflict resolution

Full e-commerce storefront

Native Android or iOS applications

Multi-country tax engines

Enterprise consolidation across legal entities

AI-generated accounting decisions

Automated bank reconciliation through direct banking APIs

2. Tech Stack

2.1 Backend

Node.js LTS

TypeScript with strict: true

Express.js

PostgreSQL

Prisma ORM

Redis

BullMQ

Zod

Pino and pino-http

Swagger/OpenAPI

Vitest

Supertest

Argon2id for password hashing

JWT access tokens plus rotating refresh-token sessions

HTTP-only secure cookies for refresh tokens

helmet, strict CORS, rate limiting, request ID, and centralized error handling

2.2 Frontend

Next.js App Router

TypeScript

Tailwind CSS

Shadcn UI / Radix UI

TanStack Query

TanStack Table

React Hook Form

Zod

Zustand for local UI state only

Recharts

next-intl or equivalent for Bangla and English

PWA support

Print-friendly invoice and report layouts

2.3 Infrastructure

pnpm workspace

Turborepo

Docker and Docker Compose

Nginx or Cloudflare reverse proxy

AWS EC2/ECS, a production VPS, or equivalent container host

Managed PostgreSQL

Managed Redis

Cloudflare R2 or AWS S3

Sentry

Prometheus/Grafana where practical

GitHub Actions

Automated daily backups and periodic restore tests

3. Monorepo Structure

hello-shop-erp/
├── apps/
│   ├── marketing-web/          # Public website and pricing
│   ├── erp-dashboard/          # Main Next.js ERP application
│   ├── api/                    # Express.js REST API
│   └── worker/                 # BullMQ workers
│
├── packages/
│   ├── database/               # Prisma schema, migrations, generated client
│   ├── auth/                   # Shared auth/session/permission helpers
│   ├── validation/             # Shared Zod schemas
│   ├── types/                  # Shared contracts and DTOs
│   ├── ui/                     # Shared UI components
│   ├── config/                 # Shared typed configuration
│   ├── eslint-config/
│   └── typescript-config/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── monitoring/
│   └── backup/
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── security.md
│   ├── permissions.md
│   ├── api.md
│   └── runbooks/
│
├── AGENTS.md
├── PROJECT_SPEC.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json

4. Express API Architecture

4.1 Request flow

Route
  → Authentication middleware
  → Tenant context middleware
  → Permission middleware
  → Validation middleware
  → Controller
  → Service
  → Repository
  → Prisma/PostgreSQL

4.2 API folder structure

apps/api/src/
├── app.ts
├── server.ts
├── routes.ts
│
├── config/
│   ├── env.ts
│   ├── cors.ts
│   ├── logger.ts
│   └── swagger.ts
│
├── lib/
│   ├── prisma.ts
│   ├── redis.ts
│   ├── queues.ts
│   ├── response.ts
│   ├── pagination.ts
│   └── money.ts
│
├── middleware/
│   ├── request-id.middleware.ts
│   ├── auth.middleware.ts
│   ├── tenant.middleware.ts
│   ├── permission.middleware.ts
│   ├── validate.middleware.ts
│   ├── rate-limit.middleware.ts
│   ├── idempotency.middleware.ts
│   ├── not-found.middleware.ts
│   └── error.middleware.ts
│
├── common/
│   ├── errors/
│   ├── constants/
│   ├── types/
│   └── utils/
│
├── modules/
│   ├── auth/
│   ├── business/
│   ├── dashboard/
│   ├── customer/
│   ├── supplier/
│   ├── product/
│   ├── brand/
│   ├── category/
│   ├── unit/
│   ├── inventory/
│   ├── purchase/
│   ├── sale/
│   ├── warranty/
│   ├── service/
│   ├── quotation/
│   ├── damage/
│   ├── expense/
│   ├── barcode/
│   ├── finance/
│   ├── cheque/
│   ├── investment/
│   ├── hr/
│   ├── role-permission/
│   ├── report/
│   ├── marketplace/
│   ├── notification/
│   ├── file/
│   └── admin/
│
└── jobs/
    ├── sms.producer.ts
    ├── email.producer.ts
    ├── report.producer.ts
    └── marketplace-sync.producer.ts

4.3 Module pattern

Every module follows:

<module>/
├── <module>.routes.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── <module>.validation.ts
├── <module>.types.ts
├── <module>.mapper.ts
├── <module>.permissions.ts
└── __tests__/

Rules:

Routes define HTTP method, middleware, and controller only.

Controllers handle HTTP input/output only.

Services contain business rules and transaction orchestration.

Repositories contain Prisma queries.

Validation files contain Zod schemas.

Mappers control public response shapes.

Controllers must not call Prisma directly.

Repositories must not contain HTTP logic.

Business services must not trust tenant identifiers from clients.

5. Authentication, Tenancy, and Authorization

5.1 Multi-tenancy

Every tenant-owned record must include businessId.

businessId must be resolved server-side from:

Authenticated user session

Active business selection

Verified BusinessMembership

Never trust businessId supplied through:

Request body

Query parameter

Route parameter

Browser local storage

Client state

Custom headers unless cryptographically issued by the server

Every tenant query must include businessId.

5.2 Session model

Short-lived access token

Rotating refresh token

Refresh token stored as a hash in the database

Refresh token delivered through secure, HTTP-only, same-site cookie

Token reuse detection

Session revoke support

Device and IP metadata

Logout current session

Logout all sessions

Optional two-factor authentication in v2

5.3 Authorization

Permissions are enforced server-side.

Suggested roles:

OWNER

ADMIN

MANAGER

CASHIER

SALES_REP

ACCOUNTANT

WAREHOUSE_MANAGER

SERVICE_MANAGER

VIEWER

Custom roles are allowed.

Access roles and HR job titles are separate concepts:

Role controls system permissions.

Designation or TeamRole describes an employee's organizational title.

6. Main Application Shell

6.1 Sidebar header

The sidebar header displays:

Hello shop

In production, this label should come from BusinessSetting.displayName, with Hello shop as the seed/demo business name.

6.2 Sidebar behavior

Fixed left sidebar on desktop

Collapsible icon-only mode

Drawer on mobile/tablet

Active item highlighted

Expandable menu groups

Permission-aware visibility

Searchable command menu

Keyboard navigation

Persist collapsed state per user

New-feature badge support

Tooltips in collapsed mode

One source of truth through a typed navigation configuration

6.3 Top header

The dashboard header contains:

Theme selector

Language selector

Support phone or support link

Quick Sale button

Add New dropdown

Notification button

Business switcher if the user has multiple memberships

User profile menu

Session logout

7. Sidebar Navigation Specification

The navigation order must match the following structure.

7.1 Exact navigation tree

Hello shop

Dashboard

Customer & Supplier
├── Customer
└── Supplier

Product
├── New Product
├── Product List
├── Brand
├── Category
├── Sub Category          [NEW]
└── Unit

Purchase
├── Create Purchase
├── Purchase List
└── Purchase Return List

Sale
├── Create Sale
├── Sale With Vat         [NEW]
├── Sale List
└── Sale Return List

Warranty
├── Serial List
└── RMA

Service
├── Create Service
├── Service List
└── Service Report

Quotation
├── Create Quotation
└── Quotation List

Damage
├── Add Damage
└── Damage List

Expense
├── Expense
└── Expense Type

Barcode
├── Multi Barcode
└── Single Barcode

Bank Accounts
├── Bank Accounts
├── Balance Transfer
├── Cheque
└── Transactions

Investment
└── Investor List

HR
├── Team
├── SR List
└── Role

Report
├── Business Report
├── Sale Report
├── Top Customer
├── Customer Report
├── Receivable Report
├── Payable Report
├── Low Stock Product List
├── Alert Product List
├── Sale Product Report
├── Account Payment Report
├── Expense Report
├── Transaction Report
├── Daily Report
├── Stock Report
└── Stock List

Business Setting

Admin

Marketplace            [NEW]
└── Active Marketplace

7.2 Route and permission mapping

Menu

Route

Required permission

Dashboard

/dashboard

dashboard.read

Customer

/customers

customer.read

Supplier

/suppliers

supplier.read

New Product

/products/new

product.create

Product List

/products

product.read

Brand

/products/brands

brand.manage

Category

/products/categories

category.manage

Sub Category

/products/sub-categories

category.manage

Unit

/products/units

unit.manage

Create Purchase

/purchases/new

purchase.create

Purchase List

/purchases

purchase.read

Purchase Return List

/purchases/returns

purchase.return.read

Create Sale

/sales/new

sale.create

Sale With Vat

/sales/new?mode=vat

sale.vat.create

Sale List

/sales

sale.read

Sale Return List

/sales/returns

sale.return.read

Serial List

/warranty/serials

serial.read

RMA

/warranty/rma

rma.read

Create Service

/services/new

service.create

Service List

/services

service.read

Service Report

/services/report

report.service

Create Quotation

/quotations/new

quotation.create

Quotation List

/quotations

quotation.read

Add Damage

/damages/new

damage.create

Damage List

/damages

damage.read

Expense

/expenses

expense.read

Expense Type

/expenses/types

expense.type.manage

Multi Barcode

/barcodes/multi

barcode.generate

Single Barcode

/barcodes/single

barcode.generate

Bank Accounts

/finance/accounts

finance.account.read

Balance Transfer

/finance/transfers

finance.transfer.create

Cheque

/finance/cheques

cheque.read

Transactions

/finance/transactions

finance.transaction.read

Investor List

/investments/investors

investment.read

Team

/hr/team

hr.team.read

SR List

/hr/sales-representatives

hr.sales-rep.read

Role

/hr/roles

role.read

Business Report

/reports/business

report.business

Sale Report

/reports/sales

report.sales

Top Customer

/reports/top-customers

report.customer.top

Customer Report

/reports/customers

report.customer

Receivable Report

/reports/receivables

report.receivable

Payable Report

/reports/payables

report.payable

Low Stock Product List

/reports/low-stock

report.stock.low

Alert Product List

/reports/alert-products

report.stock.alert

Sale Product Report

/reports/sale-products

report.product.sales

Account Payment Report

/reports/account-payments

report.account.payment

Expense Report

/reports/expenses

report.expense

Transaction Report

/reports/transactions

report.transaction

Daily Report

/reports/daily

report.daily

Stock Report

/reports/stock

report.stock

Stock List

/reports/stock-list

report.stock.list

Business Setting

/settings/business

business.setting.manage

Admin

/admin

admin.access

Active Marketplace

/marketplace/active

marketplace.read

7.3 Typed navigation configuration

The frontend must generate the sidebar from a typed configuration, not repeated JSX.

Example shape:

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon: React.ComponentType;
  permission?: string;
  badge?: "NEW" | number;
  children?: NavigationItem[];
};

export const navigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    permission: "dashboard.read",
    icon: LayoutDashboard,
  },
  // Remaining items follow the table above.
];

The client may hide unauthorized links for usability, but the API must still enforce every permission.

8. Dashboard Specification

8.1 Dashboard layout

The dashboard should use a modern, responsive card-based design.

Top quick actions:

New Sale

New Purchase

Product List

Customer

Supplier

Sales List

Purchase List

Stock List

Date filter:

Today

Yesterday

Last 7 days

Last 30 days

This month

Last month

Custom date range

8.2 Primary summary cards

Sales

Total sales

Paid

Due

Percentage collected

Purchase

Total purchase

Paid

Due

Percentage paid

Cash Flow

Cash received

Cash paid out

Net cash flow

Account

Number of active accounts

Total balance

Total expense

SMS or usage balance where configured

8.3 Secondary counters

Sale invoices

Purchase invoices

Cash-flow entries

Expenses

Service paid

8.4 Charts

Financial distribution donut/pie chart

Last 30 days trend line/bar chart

Total sales

Total purchase

Total expense

Average sale

Optional sales vs purchase comparison

Optional account-wise balance chart

8.5 Dashboard API

GET /api/v1/dashboard/summary
GET /api/v1/dashboard/financial-distribution
GET /api/v1/dashboard/trends
GET /api/v1/dashboard/quick-counts
GET /api/v1/dashboard/alerts

All dashboard queries must be tenant-scoped and date-filtered.

9. Functional Modules

9.1 Customer

Customer fields:

Name

Phone

Alternate phone

Email

Address

District

Customer type

Credit limit

Opening balance

Tax/VAT identification where needed

Notes

Active status

Customer features:

Customer list with pagination

Search by name, phone, email, or invoice

Customer profile

Sale history

Payment history

Return history

Warranty/RMA history

Service history

Receivable ledger

Printable statement

SMS history

CSV/Excel import and export

Soft delete only when no posted transaction exists

9.2 Supplier

Supplier fields and features mirror customer management but include:

Purchase history

Purchase returns

Supplier payable

Supplier payments

Supplier warranty/RMA shipments

Supplier statement

9.3 Product

Product fields:

Product name

Slug

SKU

Primary barcode

Brand

Category

Subcategory

Unit

Product type: stocked, serialized, service, digital

Purchase price

Retail price

Dealer/wholesale price

Minimum sale price

VAT rate

Warranty duration

Reorder level

Alert quantity

Track stock

Track serial/IMEI

Description

Images

Active status

Rules:

SKU unique per business

Barcode unique per business when present

Serialized product quantity must match serial count during purchase

Product price override requires permission and audit log

Product cannot be hard-deleted after transactional use

9.4 Brand, Category, Subcategory, and Unit

Category supports hierarchy through parentId.

The UI exposes:

Category page for root categories

Sub Category page for child categories

Unit examples:

Piece

Box

Set

Meter

Kilogram

Liter

Service

All names are unique per business within their scope.

9.5 Purchase

Create Purchase supports:

Supplier

Purchase date

Supplier invoice number

Reference

Warehouse

Product search

Barcode scan

Quantity

Serial/IMEI entry

Purchase price

Sale price

Dealer price

VAT

Line discount

Overall discount

Shipping/additional cost

Payment account

Paid amount

Due amount

Notes

Attachment

Purchase states:

DRAFT

POSTED

PARTIALLY_PAID

PAID

RETURNED

VOID

Posting a purchase must be atomic:

Validate supplier and products in the active business.

Validate serial count and uniqueness.

Create purchase and purchase lines.

Create positive stock movements.

Create serial items.

Create supplier payable.

Create purchase payment when paid.

Create account transaction.

Create balanced journal entry.

Commit or roll back everything.

9.6 Purchase Return

Purchase return:

References an original purchase

Cannot return more than remaining returnable quantity

Serialized products require serial selection

Creates negative stock movement

Updates serial status

Reduces supplier payable or creates supplier credit

Creates reversal journal lines

Is never implemented by editing original purchase lines

9.7 Sale

Create Sale supports:

Customer

Walk-in customer

Sales representative

Warehouse

Product or barcode search

Serial selection

Quantity

Retail/dealer/custom price

Discount

VAT

Shipping/additional charge

Payment account

Split payment

Paid and due

Invoice note

SMS notification

Print after sale

Hold/resume draft sale

Sale states:

DRAFT

POSTED

PARTIALLY_PAID

PAID

PARTIALLY_RETURNED

RETURNED

VOID

Posting a sale must be atomic:

Validate customer and items.

Lock or safely verify stock balance.

Validate serial availability.

Create sale and lines.

Create negative stock movements.

Mark serials as sold.

Calculate receivable.

Record payments.

Record account transactions.

Generate unique invoice number.

Create journal entry.

Queue SMS/email.

Commit or roll back everything.

9.8 Sale With VAT

Sale With Vat uses the same sale engine with VAT mode enabled.

Requirements:

Business VAT settings

Product-level VAT rate

VAT-inclusive or VAT-exclusive pricing

Line and invoice tax summary

Customer BIN/VAT information where applicable

VAT invoice print template

Tax report filters

No duplicated sale business logic; use one service with explicit tax mode

9.9 Sale Return

Sale return:

References original sale

Cannot exceed returnable quantity

Requires serial selection for serialized items

Adds stock back when item condition allows resale

Can route damaged items to damage inventory

Reverses receivable/payment/accounting correctly

Creates credit note or refund record

Preserves original invoice

9.10 Warranty Serial List

Serial list fields:

Serial/IMEI

Product

Purchase date

Supplier

Stock/sale status

Sale invoice

Customer

Sale date

Warranty start

Warranty end

Current RMA state

Search and filters

Serial statuses:

IN_STOCK
RESERVED
SOLD
CUSTOMER_RETURNED
IN_RMA
SENT_TO_SUPPLIER
RECEIVED_FROM_SUPPLIER
READY_FOR_DELIVERY
DELIVERED_TO_CUSTOMER
DAMAGED
SCRAPPED

Unique constraint:

unique(businessId, serialNumber)

9.11 RMA

RMA workflow:

RECEIVED_FROM_CUSTOMER
→ ELIGIBILITY_CHECK
→ IN_HOUSE_INSPECTION
→ SENT_TO_SUPPLIER
→ RECEIVED_FROM_SUPPLIER
→ READY_FOR_DELIVERY
→ DELIVERED_TO_CUSTOMER
→ CLOSED

RMA fields:

Claim number

Customer

Original sale

Product

Serial/IMEI

Problem description

Physical condition

Accessories received

Images/attachments

Warranty eligibility

Customer charge

Supplier

Courier details

Technician note

Expected delivery date

Current status

Every transition creates an immutable WarrantyEvent.

9.12 Service

Service order fields:

Service number

Customer

Device/product name

Serial/IMEI

Problem

Accessories received

Device condition

Assigned technician

Estimated cost

Advance paid

Final charge

Spare parts used

Status

Expected completion date

Notes and attachments

Service statuses:

RECEIVED
DIAGNOSING
WAITING_FOR_APPROVAL
IN_PROGRESS
WAITING_FOR_PART
READY_FOR_DELIVERY
DELIVERED
CANCELLED

Using a spare part creates a SERVICE_CONSUMPTION stock movement.

Service Report includes:

Service count

Amount billed

Amount paid

Amount due

Technician performance

Status breakdown

Parts consumption

9.13 Quotation

Quotation features:

Customer

Valid-until date

Products/services

Quantity

Price

Discount

VAT

Terms

Notes

PDF and print

Status: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED

Convert quotation to sale through an idempotent operation

Quotation does not affect stock before conversion

9.14 Damage

Damage entry fields:

Warehouse

Product

Quantity

Serial selection

Reason

Condition

Estimated loss

Attachment

Approved by

Posting damage:

Creates negative DAMAGE stock movement

Marks selected serials as damaged

Creates accounting loss entry when accounting is enabled

Requires elevated permission

Creates audit log

9.15 Expense

Expense fields:

Expense type

Date

Account

Amount

Tax

Vendor/payee

Reference

Description

Attachment

Approval status

Expense types are configurable per business.

Posted expense creates:

Account transaction

Journal entry

Audit trail

9.16 Barcode

Single Barcode:

Select product or serial

Choose label size

Set quantity

Preview

Print or export PDF

Multi Barcode:

Add multiple products

Set label count per product

Include product name, SKU, price, and barcode based on template

Support common thermal label sizes

Use Code 128 by default

Support QR for serial/warranty verification

9.17 Bank Accounts and Finance

Financial account types:

Cash

Bank

bKash

Nagad

Rocket

Card

Petty cash

Other mobile financial service

Account features:

Opening balance

Current balance

Transaction history

Deposit

Withdrawal

Adjustment with permission

Active/inactive

Statement export

Account balance must be derived from transaction entries or a transactionally maintained balance cache.

9.18 Balance Transfer

Balance transfer must create two linked entries in one database transaction:

Debit source account

Credit destination account

Rules:

Source and destination cannot be the same

Insufficient balance can be blocked based on business setting

Transfer reference must be unique

Editing a posted transfer is not allowed

Use reversal workflow

9.19 Cheque

Cheque fields:

Cheque number

Bank

Account

Party

Direction: RECEIVED or ISSUED

Amount

Issue date

Due date

Status

Related sale, purchase, expense, or investment

Cheque statuses:

PENDING
DEPOSITED
CLEARED
BOUNCED
CANCELLED

Only CLEARED changes final cash/bank balance unless the business uses a cheque-in-hand account.

9.20 Transactions

The transaction page shows all posted finance entries:

Date

Account

Type

Debit

Credit

Reference

Party

Created by

Source module

Reversal status

Filters:

Date range

Account

Type

User

Customer

Supplier

Reference

9.21 Investment and Investor List

Investor fields:

Name

Phone

Email

Address

Start date

Status

Notes

Investment transaction fields:

Investor

Contribution

Withdrawal

Profit distribution

Adjustment

Account

Date

Attachment

Accounting treatment must use equity or liability accounts based on business configuration.

9.22 HR: Team

Team page includes:

Employee profile

User account link

Team/department

Designation

Phone

Email

Joining date

Salary metadata for future use

Active status

Assigned role

Branch/warehouse assignment

9.23 HR: SR List

Sales representative list includes:

Representative profile

Assigned user

Sales count

Sales amount

Collected amount

Due created

Return amount

Commission settings

Date filters

9.24 HR: Role

Role management includes:

Role name

Description

Permission list

User count

System role protection

Custom role creation

Copy role

Audit history

The OWNER role cannot be deleted.

9.25 Business Setting

Settings groups:

Business profile

Logo

Address and support contact

Currency

Locale and timezone

Bangla/English default language

Invoice prefix and numbering

Purchase numbering

Quotation numbering

Service numbering

RMA numbering

VAT configuration

Default warehouse

Negative stock policy

Price override policy

Low-stock policy

SMS provider

Email provider

Print templates

Backup status

Notification preferences

Fiscal year

9.26 Admin

Tenant admin features:

Users

Invitations

Sessions

Roles and permissions

Audit logs

Import/export jobs

Subscription and usage

Storage usage

SMS usage

Feature flags

Platform super-admin must be a separate protected application or route group and must never rely only on a normal tenant role.

9.27 Marketplace

Marketplace is marked as a new feature.

V1 may provide a placeholder-ready architecture while active integrations can be added in V2.

Supported future integrations may include:

WooCommerce

Shopify

Custom website API

Facebook catalog

Daraz, only when a supported official integration is available

Active Marketplace page displays:

Connected marketplace

Connection status

Last sync

Product link count

Order sync count

Error count

Pause/resume

Sync now

Disconnect

All secrets must be encrypted at rest.

10. Reports

All reports support:

Tenant scope

Date filters

Branch/warehouse filters when enabled

Pagination

Search

Role-based access

Print

PDF

CSV

Excel

Background generation for large exports

10.1 Business Report

Gross sales

Net sales

Purchase

Gross profit

Expense

Service income

Cash received

Cash paid

Receivable

Payable

Account balance

Return totals

10.2 Sale Report

Invoice

Customer

Sales representative

Gross amount

Discount

VAT

Net amount

Paid

Due

Profit

Status

10.3 Top Customer

Rank by configurable metric:

Sales amount

Profit

Payment amount

Number of purchases

10.4 Customer Report

Opening balance

Sales

Returns

Payments

Closing receivable

Last transaction date

10.5 Receivable Report

Formula:

Opening receivable
+ Credit sales
- Customer payments
- Sale returns
- Credit notes
= Closing receivable

10.6 Payable Report

Formula:

Opening payable
+ Credit purchases
- Supplier payments
- Purchase returns
- Supplier credits
= Closing payable

10.7 Low Stock Product List

Products where:

availableQuantity <= reorderLevel

10.8 Alert Product List

Products that match configurable warnings:

Out of stock

Below alert quantity

Negative stock anomaly

Missing sale price

Serialized stock mismatch

Inactive but still in stock

10.9 Sale Product Report

Product

Quantity sold

Return quantity

Net quantity

Net sales

COGS

Gross profit

Margin

10.10 Account Payment Report

Payments by account

Payments by source module

Cash vs bank vs MFS

Received and paid-out totals

10.11 Expense Report

Expense type

Account

Amount

VAT/tax

Approver

Date

Vendor

10.12 Transaction Report

Unified account transaction report with debit, credit, balance, reference, and source.

10.13 Daily Report

Opening cash

Daily sales

Daily collections

Purchases paid

Expenses

Service collections

Transfers

Closing cash

User/cashier summary

10.14 Stock Report

Opening quantity

Purchase

Sale

Sale return

Purchase return

Damage

Service consumption

Adjustment

Closing quantity

Stock value

10.15 Stock List

Current product inventory:

Product

SKU

Barcode

Category

Warehouse

Available

Reserved

Damaged

Serialized count

Purchase cost

Stock value

10.16 Stock valuation

MVP valuation method:

Weighted average cost

Future option:

FIFO

VAT must not be treated as revenue.

11. Core Database Models

11.1 Identity and tenancy

User
UserProfile
LoginSession
RefreshToken
PasswordResetToken
Business
BusinessMembership
BusinessSetting
Branch
Warehouse
Role
Permission
RolePermission
MembershipRole
Invitation
AuditLog

11.2 Customer and supplier

Customer
Supplier
PartyAddress
CustomerLedgerEntry
SupplierLedgerEntry
CustomerPayment
SupplierPayment

11.3 Catalog and inventory

Brand
Category
Unit
Product
ProductImage
ProductPrice
ProductBarcode
SerialItem
StockMovement
StockBalance
StockAdjustment
StockTransfer
StockReservation

11.4 Purchase

Purchase
PurchaseLine
PurchasePayment
PurchaseReturn
PurchaseReturnLine

11.5 Sale

Sale
SaleLine
SalePayment
SaleReturn
SaleReturnLine
Invoice
InvoiceSequence
CreditNote

11.6 Warranty and service

WarrantyClaim
WarrantyEvent
WarrantyAttachment
RmaShipment
ServiceOrder
ServiceOrderLine
ServiceStatusEvent
ServicePayment
TechnicianAssignment

11.7 Quotation, damage, and expense

Quotation
QuotationLine
Damage
DamageLine
Expense
ExpenseType

11.8 Finance and accounting

FinancialAccount
AccountTransaction
BalanceTransfer
Cheque
Investor
InvestmentTransaction
LedgerAccount
JournalEntry
JournalLine
FiscalPeriod

11.9 Marketplace and system

MarketplaceProvider
MarketplaceConnection
MarketplaceProductLink
MarketplaceOrderLink
MarketplaceSyncJob
Notification
SmsLog
EmailLog
FileAsset
ExportJob
IdempotencyRecord
Webhook
Subscription
Plan
UsageRecord

11.10 Mandatory tenant fields

Every business-scoped table must include:

businessId String
createdAt  DateTime @default(now())
updatedAt  DateTime @updatedAt
createdById String?

Frequently queried tenant tables require compound indexes starting with businessId.

Examples:

@@index([businessId, createdAt])
@@index([businessId, status])
@@unique([businessId, sku])
@@unique([businessId, serialNumber])

12. Inventory Rules

Stock changes only through StockMovement.

Supported movement types:

OPENING_STOCK
PURCHASE
PURCHASE_RETURN
SALE
SALE_RETURN
DAMAGE
SERVICE_CONSUMPTION
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
WARRANTY_IN
WARRANTY_OUT
RESERVATION
RESERVATION_RELEASE

A StockBalance table may cache current quantities for performance, but it must be updated in the same database transaction as StockMovement.

Negative stock is disabled by default.

Concurrency-sensitive sale posting must use one of:

Atomic conditional update on StockBalance

Serializable transaction

Explicit row lock through safe parameterized SQL where Prisma support is insufficient

The implementation must include tests for simultaneous sales.

13. Financial Rules

Use Prisma Decimal for stored financial values.

Never calculate money with unrounded JavaScript floating-point arithmetic.

Centralize rounding and VAT calculations.

Every posted financial event creates balanced journal lines.

Posted records are not hard-edited.

Corrections use reversal or compensating entries.

Payment POST endpoints require idempotency keys.

Account transfer, sale posting, purchase posting, returns, damage, and investment posting are transactional.

Invoice numbers are unique per business.

Number allocation must be concurrency-safe.

Voided invoice numbers are never reused.

Database records store the business timezone context needed for reporting.

14. API Conventions

14.1 Base URL

/api/v1

14.2 Success response

{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}

14.3 Paginated response

{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "requestId": "req_..."
  }
}

14.4 Error response

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "fields": {}
  },
  "meta": {
    "requestId": "req_..."
  }
}

Never expose stack traces, SQL, secrets, token values, or internal Prisma errors to clients.

14.5 List endpoint conventions

Common query parameters:

page
limit
search
sortBy
sortOrder
dateFrom
dateTo
status

Maximum normal page size: 100.

Large exports must use background jobs.

15. Key API Route Groups

/api/v1/auth
/api/v1/businesses
/api/v1/dashboard
/api/v1/customers
/api/v1/suppliers
/api/v1/products
/api/v1/brands
/api/v1/categories
/api/v1/units
/api/v1/inventory
/api/v1/purchases
/api/v1/purchase-returns
/api/v1/sales
/api/v1/sale-returns
/api/v1/serials
/api/v1/rma
/api/v1/services
/api/v1/quotations
/api/v1/damages
/api/v1/expenses
/api/v1/expense-types
/api/v1/barcodes
/api/v1/finance/accounts
/api/v1/finance/transfers
/api/v1/finance/cheques
/api/v1/finance/transactions
/api/v1/investors
/api/v1/investments
/api/v1/hr/team
/api/v1/hr/sales-representatives
/api/v1/roles
/api/v1/reports
/api/v1/settings
/api/v1/admin
/api/v1/marketplaces

16. Security Requirements

Strict tenant isolation

Authentication on protected routes

Permission checks on every protected action

Zod validation on body, query, and params

Secure CORS allowlist

Helmet security headers

CSRF protection when cookie-based credentials are used

Access-token expiry

Refresh-token rotation

Refresh-token reuse detection

Login rate limiting by IP and account

Password reset rate limiting

Argon2id password hashing

Audit logs for sensitive actions

Re-authentication for role changes, destructive actions, and bulk data export

File MIME and signature validation

File size and file count limits

S3/R2 private buckets with signed URLs

Log redaction for passwords, tokens, cookies, phone numbers where needed

No sensitive data in URLs

Dependency and secret scanning in CI

Daily backups

Restore drills

Database TLS

Secret manager in production

Idempotency on payment and posting endpoints

Soft delete where business history must remain

Platform admin actions logged separately

17. Background Jobs

BullMQ queues:

sms
email
report-export
invoice-pdf
warranty-reminder
service-reminder
low-stock-alert
marketplace-sync
data-import
cleanup

API requests enqueue jobs and return quickly.

Workers must support:

Retry with exponential backoff

Permanent vs retryable failure classification

Idempotent execution

Dead-letter handling

Job correlation with request and tenant

Sanitized logs

Job timeout

Concurrency limits

18. UI/UX Requirements

Responsive from 360px width

Desktop-optimized data tables

Sticky form actions

Keyboard-friendly POS and sale form

Barcode input auto-focus

Accessible labels and focus states

Loading skeletons

Empty states

Error boundaries

Optimistic UI only where safe

Unsaved-change warning

Confirmation dialogs for sensitive actions

Printable A4 invoice

Thermal invoice template

Bangla and English

BDT formatting

Asia/Dhaka default timezone

Table column visibility controls

Saved filters in v2

No visual cloning of the reference site

19. Testing Requirements

Each module must include relevant tests for:

Successful request

Validation failure

Unauthenticated request

Permission denied

Cross-tenant access

Not found

Duplicate conflict

Pagination and filters

Transaction rollback

Concurrent stock update

Duplicate serial

Idempotent payment/posting

Audit log creation

Soft-delete behavior

Export authorization

Critical end-to-end workflows:

Purchase serialized product

Sell serialized product

Receive customer payment

Return sold product

Create and complete RMA

Consume spare part in service order

Record damage

Transfer money between accounts

Clear or bounce cheque

Convert quotation to sale

Generate business and stock reports

Verify another tenant cannot access any record

Before completing each development step, run:

format
lint
typecheck
unit tests
integration tests
build

20. Observability

Every request includes:

Request ID

Authenticated user ID when available

Business ID when available

Route

Status code

Duration

Do not log:

Passwords

Access tokens

Refresh tokens

Cookies

Full card or bank secrets

Marketplace API secrets

Private file signed URLs

Monitoring:

API uptime

Error rate

Latency

Database pool usage

Redis availability

Queue depth

Failed jobs

Storage usage

Backup success

Suspicious login attempts

21. Development Roadmap

Phase 1 — Foundation

Monorepo

Express production setup

Environment validation

Logging

Error handling

Health and readiness

PostgreSQL and Prisma

Auth and sessions

Business and membership

Tenant isolation

Role and permission

Audit log

Phase 2 — Catalog and Inventory

Brand

Category and subcategory

Unit

Product

Barcode

Warehouse

Stock movement

Stock balance

Serial/IMEI

Low-stock alerts

Phase 3 — Customer, Supplier, Purchase

Customer

Supplier

Ledgers

Purchase

Purchase payment

Purchase return

Supplier payable

Phase 4 — Sale and POS

Create sale

VAT sale

Sale list

Sale payment

Sale return

Invoice

Hold/resume

Barcode flow

Customer receivable

Phase 5 — Warranty, Service, Quotation, Damage

Serial list

RMA

Service orders

Service report

Quotation

Quotation conversion

Damage

Phase 6 — Expense and Finance

Expense type

Expense

Financial accounts

Balance transfer

Cheque

Transactions

Investor list

Investment transactions

Accounting journals

Phase 7 — HR, Reports, Settings

Team

Sales representative list

Roles UI

Dashboard

All reports

Business settings

Tenant admin

Phase 8 — Marketplace and Production Readiness

Marketplace architecture

Initial integration

Export jobs

Monitoring

Security testing

Load testing

Backup and restore

CI/CD

Documentation

Production deployment

22. Claude Code Implementation Protocol

Claude Code must follow this process for every step.

Before editing

Read AGENTS.md.

Read PROJECT_SPEC.md.

Inspect the current repository.

Read relevant architecture, database, security, and API documents.

Identify established contracts.

Present a concise implementation plan.

Limit the work to the requested step.

During implementation

Keep TypeScript strict.

Do not use any without written justification.

Do not place business logic in controllers.

Do not bypass repositories without a documented transaction reason.

Do not trust client tenant identifiers.

Reuse existing utilities.

Do not duplicate sale logic for VAT sales.

Keep migrations reviewable.

Do not apply destructive production migrations.

Add indexes and constraints.

Add tests as part of the feature.

Do not leave production TODOs, placeholders, fake responses, or mock-only implementations.

Before completion

Run formatting.

Run lint.

Run typecheck.

Run relevant tests.

Run build.

Review tenant isolation.

Review permission enforcement.

Review transaction behavior.

Review logs for secret leakage.

Summarize changed files and verification results.

23. Definition of Done

A feature is complete only when:

Database schema and migration are present

Validation exists

Permission is defined and enforced

Tenant scoping is enforced

Controller, service, and repository boundaries are respected

Success and error responses follow the API standard

Audit logging is added where required

Transaction handling is correct

Unit/integration tests pass

UI has loading, empty, error, and success states

Mobile behavior is acceptable

Bangla/English labels are supported

Documentation is updated

No unrelated regression is introduced

24. MVP Scope

In scope

Authentication

Single active business per session

Roles and permissions

Dashboard

Customers and suppliers

Products, brands, categories, subcategories, units

Barcode generation

Single warehouse

Purchase and purchase returns

Sale, VAT sale, and sale returns

Serial/IMEI

RMA

Service

Quotation

Damage

Expense

Financial accounts and transfers

Basic cheque management

Investor list

Team and sales representative list

Core reports

Business settings

Audit log

Bangla and English UI

Deferred to later release

Multi-warehouse transfer UI

Advanced payroll and attendance

Full offline POS

Multiple marketplace providers

Public API/webhooks

White-label deployments

Advanced financial statements

Native mobile apps

Complex commissions

Automatic bank feeds

25. Initial Seed Data

Demo business:

Business name: Hello shop
Currency: BDT
Timezone: Asia/Dhaka
Language: English
Default warehouse: Main Warehouse
Negative stock: Disabled
VAT mode: Optional

Default roles:

OWNER
ADMIN
MANAGER
CASHIER
SALES_REP
ACCOUNTANT
WAREHOUSE_MANAGER
SERVICE_MANAGER
VIEWER

Default accounts:

Cash
Bank
bKash
Nagad
Rocket
Petty Cash

Default units:

Piece
Box
Set
Meter
Kilogram
Liter
Service

26. First Implementation Steps

Scaffold the pnpm/Turborepo monorepo.

Create apps/api, apps/erp-dashboard, apps/worker, and shared packages.

Add strict TypeScript, ESLint, formatting, and shared configs.

Implement typed environment validation.

Implement Pino logging, request IDs, error handling, health, readiness, and graceful shutdown.

Configure PostgreSQL, Prisma, and Redis lifecycle.

Add the Phase 1 Prisma models.

Implement authentication and rotating sessions.

Implement business membership and active tenant context.

Implement permission middleware and audit logging.

Build the dashboard shell and exact sidebar configuration from Section 7.

Do not begin product or transaction modules until tenant isolation tests pass.

27. Final Product Principle

The system must prioritize:

Correctness

Tenant isolation

Financial auditability

Inventory traceability

Security

Data integrity

Maintainability

Performance

User experience

Feature count

A smaller workflow that is correct and fully tested is preferred over a large unfinished module.