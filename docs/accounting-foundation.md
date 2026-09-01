# Accounting foundation

Hello Shop keeps two related domains separate. `FinancialAccount` and `FinancialTransaction` describe where money exists (cash counter, bank, bKash). `ChartAccount`, `JournalEntry`, and `JournalLine` describe the economic meaning. A financial account may be mapped only to an active, posting-enabled asset account owned by the same business.

## Posting controls

`AccountingEngine` is the only automatic journal posting boundary. It runs inside the caller's transaction, derives the business from authenticated tenant context, requires an open fiscal period, validates active tenant-owned accounts, uses Decimal arithmetic, rejects zero/two-sided lines and unequal totals, assigns `JRN-xxxxxx` through `BusinessSequence`, and deduplicates `(businessId, sourceType, sourceId, sourceEvent)`. Posted journals are immutable; corrections use an opposite reversal journal.

Initialization is explicit and idempotent. It creates a compact default chart, accounting settings, and the current fiscal period. System-mapped accounts cannot be disabled. Accounting mutations are online-only.

## Source policies

- Sale/VAT/POS: recognize the full invoice as Accounts Receivable, Sales Revenue, VAT Payable, plus COGS/Inventory from persisted cost movements. Legacy `paidAmount` does not identify a real money account and is not treated as settlement.
- Purchase: recognize Inventory, Input VAT, unallocated additional purchase cost as Other Expense, and the full Accounts Payable. Legacy payment metadata is not treated as settlement.
- Sale Return: reduce receivable/revenue and VAT, restore Inventory and reverse COGS at historical cost. The persisted return credit first allocates against the source Sale receivable; any excess remains an explicit Customer Credit. No cash refund is invented.
- Purchase Return: reduce Accounts Payable and reverse Inventory/Input VAT. The persisted return credit first allocates against the source Purchase payable; any excess remains an explicit Supplier Credit. No cash receipt is invented.
- Expense: the category must be explicitly mapped to an expense ledger account. `paymentMethod` remains metadata and never selects cash/bank.
- Damage: recognize Inventory Damage Loss against Inventory using authoritative cost movements.
- Service: recognize delivered service revenue and VAT as a receivable. Service-part inventory cost is deferred until parts have an authoritative InventoryService consumption event.
- Money In/Out/adjustments: after accounting is enabled, an explicit offset classification is required. Internal transfers debit the mapped destination asset and credit the mapped source asset; they never create income or expense.

## Receivables and payables

Sales and purchases create explicit open items. Customer receipts and supplier payments require a mapped FinancialAccount, reject overpayment, create the operational FinancialTransaction, create the balanced accounting journal, allocate payment, and update open-item status in one serializable transaction. Walk-in unpaid sales remain attached to the Sale without inventing a customer.

PartyCredit represents a structured CUSTOMER_CREDIT or SUPPLIER_CREDIT; it is never shown as a negative overdue invoice. Return processing records the full credit document, the amount automatically allocated to its source open item, and the available excess. Available same-party credit can be applied to a future receivable/payable through PartyCreditApplication without a FinancialTransaction, because no money moves. The application journal transfers the party balance within the AR/AP control account and remains source-idempotent. Anonymous walk-in credit stays Sale-linked and cannot be transferred across unrelated walk-in invoices.

Customer cash refunds and supplier cash receipts are explicitly deferred. They must never be inferred from a return or credit application.

## Inventory valuation

Hello Shop uses perpetual moving weighted average by business, warehouse, and product. Each StockMovement creates an InventoryCostMovement and updates InventoryCostState in the same InventoryService-owned transaction. Outbound COGS uses the current average. Sale returns restore the original sale cost basis. Product selling price and editable product purchase price are never used as COGS authority.

## Reports and limitations

General Ledger, Trial Balance, and Profit & Loss read POSTED journal lines only. General Ledger derives pre-range opening balances and running balances using each account's normal-balance direction. P&L is not calculated from raw Sale/Purchase tables. A formal Balance Sheet, year-end retained-earnings closing, transfer fees, arbitrary purchase-cost allocation, service-part COGS, cash settlement of party credits, and backfill of pre-accounting history are deferred rather than guessed.

The migration `20260908000000_accounting_foundation` is reviewable and intentionally unapplied. Real PostgreSQL concurrency, unique-race, allocation-race, and valuation-race verification remains deferred until local infrastructure is explicitly allowed.
