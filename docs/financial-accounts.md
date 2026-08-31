# Financial accounts

STEP 9 introduces an operational money ledger for tenant-owned cash, bank, bKash, Nagad, card, and other accounts. It is not a general ledger and does not create journal entries, a chart of accounts, receivable/payable ledgers, COGS, profit, or net-worth figures.

## Authority and balances

The API derives `businessId` from the authenticated persisted session and active membership. Clients cannot submit tenant identity, balances, account codes, TXN numbers, TRF numbers, or running balances. An account balance is derived from immutable `POSTED` financial transactions: `IN - OUT`. There is no client-writable balance field. Negative balances are prohibited by default; Money Out, Adjustment Out, and transfer posting recalculate the source balance inside the same serializable PostgreSQL transaction.

Account numbers and mobile identifiers are masked in API list/detail responses. Accounts with history are disabled, never deleted. A disabled account remains readable but cannot receive manual transactions, transfers, or adjustments.

## Operations

- An optional positive opening balance creates one posted `OPENING_BALANCE` transaction atomically with the account.
- Money In and Money Out create posted TXN-numbered entries.
- Adjustment In/Out requires `financial.adjust`, a reason, and confirmation in the UI.
- A transfer creates one TRF-numbered document plus equal `TRANSFER_OUT` and `TRANSFER_IN` entries in one serializable transaction. STEP 9 defers transfer fees.
- Posted finance history is immutable. Future corrections use compensating transactions rather than edits.
- Statements return authoritative opening, running, and closing balances with deterministic date/creation/id ordering.

Mutation commands accept the existing scoped `Idempotency-Key` contract. The idempotency claim, sequence allocation, money entry or two-sided transfer, and audit record share one serializable transaction.

## Source references and integration boundary

Transactions include optional `sourceType` and `sourceId` fields for future source-module linkage. STEP 9 does not retroactively mutate or auto-post Expense, Sale, Purchase, Return, Service, or Damage records. STEP 10 may integrate those workflows and introduce formal accounting, but it must preserve the operational history created here.

## Offline policy

Account creation, Money In, Money Out, transfers, opening balances, and adjustments are online-only. They are never stored in the IndexedDB outbox because available funds are concurrency-sensitive server authority.

## Migration

`20260907000000_financial_accounts` is a local reviewable migration. It remains intentionally unapplied until local database verification is explicitly authorized.
