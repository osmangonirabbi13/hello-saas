# Damage and Expense boundaries

Damage is an online-only inventory document. A posted document removes sellable quantity through `InventoryService` using a `DAMAGE` movement. Serialized lines require exact tenant/product/warehouse `IN_STOCK` serials, transition them to `DAMAGED`, and append `DAMAGE_RECORDED` history. Cost snapshots use persisted purchase cost and are operational valuation only. Damage is distinct from returns, RMA, and Service and never creates an Expense.

Expenses are tenant-scoped operational records with business-managed categories. Amounts are validated decimal strings and persisted as Prisma Decimal. `CASH`, `BANK`, `BKASH`, `NAGAD`, `CARD`, and `OTHER` are informational payment-method metadata only. Posting finalizes the record but creates no inventory movement, account balance, payable, ledger, journal, or profit/loss calculation. Attachments and authoritative Financial Account transactions are deferred to the later finance step.

Dashboard Damage and Expense aggregates are intentionally deferred until the dashboard repository can expose persisted tenant-scoped metrics. No placeholder values or synthetic profit figures are shown.
