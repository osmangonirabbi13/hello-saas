# Warranty and RMA

STEP 6 adds an online-only, tenant-scoped warranty and return-material-authorization workflow.

## Authority boundaries

- Warranty dates originate from the posted Sale and are persisted on serialized units. The client cannot set them.
- businessId, sale, product, customer, supplier, and serial ownership are resolved by the API from persisted tenant data.
- Serialized intake atomically claims SOLD to IN_RMA. Supplier processing remains IN_RMA; delivery or cancellation restores the customer-owned unit to SOLD.
- Customer-owned repair does not change StockBalance and does not create StockMovement.
- Purchase Return and Sale Return remain separate domains.
- RMA and serial histories are append-only. Final RMAs cannot be edited.

## Workflow

RECEIVED to INSPECTING to APPROVED or REJECTED. Approved items can become ready for the customer or move through supplier processing. Rejected items can become ready for customer collection. READY_FOR_CUSTOMER to DELIVERED is final.

Supplier handoff requires a persisted supplier on the same RMA. Operational costs are informational only and do not create accounting entries.

## Public tracking

Each RMA receives a server-generated 256-bit base64url token. The public endpoint exposes only business name, RMA number, product, masked serial, status, dates, and status timeline. Internal notes, costs, user identities, customer data, and tenant identifiers are never returned.

Printed RMA receipts encode the public tracking URL as a QR code generated in the browser. No token is sent to an external QR service.

## Permissions

Warranty lookup uses warranty.check; history uses warranty.read. RMA actions use granular rma.read, rma.create, rma.update, rma.inspect, rma.send_supplier, rma.receive_supplier, rma.ready, rma.deliver, and rma.cancel permissions enforced by the API.

## Migration

20260904000000_warranty_rma creates the RMA enums, models, constraints, and indexes. It is committed for review and must be applied only through the approved migration process. It was not applied during STEP 6.
