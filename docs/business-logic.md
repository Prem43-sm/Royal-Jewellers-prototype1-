# Business Logic

This document explains the core business rules implemented in the system: the jewellery price calculation, product stock lifecycle, the metal stock ledger, day closing, old gold exchange, job work, repairs, and customer/supplier credit tracking.

## Jewellery Price Calculation

All pricing flows through `calculateJewelleryPrice()` in `backend/src/services/calculations.ts`.

### Formula

```
netWeight      = max(0, grossWeight - stoneWeight - otherMaterialWeight)
fineness       = purity / 24
fineGoldWeight = netWeight * fineness
metalValue     = netWeight * rate

wastageAmount  = explicit amount, or metalValue * (wastagePercent / 100)

taxableValue   = metalValue + makingCharge + wastage + stoneCharge
                 + otherCharge - discount        (floor at 0)
taxAmount      = taxableValue * (taxRate / 100)
grandTotal     = taxableValue + taxAmount        (per item, times quantity)
```

Every intermediate value is rounded to 2 decimal places with `round2()`.

### Worked Example

A 22K gold bangle:

| Input | Value |
| ----- | ----- |
| grossWeight | 25.000 g |
| stoneWeight | 0.000 g |
| otherMaterialWeight | 0.000 g |
| rate | 7400/g |
| makingCharge | 350 |
| wastagePercent | 3 |
| taxRate | 3 (GST) |

```
netWeight       = 25.0
metalValue      = 25 * 7400             = 185000.00
wastageAmount   = 185000 * 0.03          = 5550.00
taxableValue    = 185000 + 350 + 5550    = 190900.00
taxAmount       = 190900 * 0.03          = 5727.00
grandTotal      = 190900 + 5727          = 196627.00
```

### Where the formula is used

- `POST /api/sales` for both stock items (rates/purities default from the product) and custom walk-in items (fully manual inputs). The item-level calculations are snapshotted on `SaleItem` rows.
- Order quotation/estimation in `/api/orders`.
- Product pricing fields and product detail display.

Profit on a sale item: `(finalValue / quantity) - purchaseCost * (1 + wastagePercent/100)` accumulated into `Sale.profit`.

## Stock Lifecycle

A `Product` moves through a status machine with these states (see `PRODUCT_STATUSES` in `frontend/src/lib/types.ts`):

```
                 purchase / create
                         |
                         v
                    IN_STOCK <------------------------------+
                     |  |   |                               |
        sale          |  |   | repair created               |
        +-------------+  |   +------------+                 |
        |                |                v                 |
        v                |             REPAIR  --delivered-->+
      SOLD              |                ^                  |
        |               |                |                  |
        +---- cancel ---+            JOB_WORK               |
        (back to IN_STOCK)             |                     |
                        |              +-- returned -->------+
                        v
                   RESERVED  (reserved for a customer/order)
                   CUSTOM_ORDER
                   RETURNED   (customer return of stock item)
                   DAMAGED    (end state, not sellable)
```

Rules enforced in code:

- A product can only be sold when its status is `IN_STOCK` or `RESERVED` (else the API rejects it with an error).
- A cancelled sale returns every involved product to `IN_STOCK`.
- Creating a repair moves the product to `REPAIR`; delivering the repair moves it back to `IN_STOCK`.
- Issuing a job work moves products to `JOB_WORK`; the return moves them back to `IN_STOCK`.

## Metal Stock Ledger

`StockMovement` is an append-only metal ledger. Every transaction that touches metal weight writes one or more signed movement rows:

| Event | movementType | Reference | Weight sign |
| ----- | ------------ | --------- | ----------- |
| Sale of item | `SALE` | SALE / invoice number | negative (netWeight x qty) |
| Cancelled sale | `RETURN` | SALE / sale id | positive |
| Old gold accepted | `OLD_GOLD` | OLD_GOLD_EXCHANGE | positive (fineGoldWeight) |
| Job work issue | `ARTISAN_ISSUE` | JOB_WORK / job id | negative |
| Job work return | `ARTISAN_RETURN` | JOB_WORK / job id | positive (returnedWeight) |

Each row stores `metal`, `purity`, and `weight` so per-metal/per-purity stock can be reconstructed at any point in time. The Metal Stock page and `GET /api/reports` aggregate these movements.

## Day Closing Process

`/api/day-closing` reconciles a single trading day.

1. `GET /today` uses aggregate queries over the current calendar day (00:00 to 23:59) to compute:
   - `totalSales` (excludes CANCELLED), `totalPurchases`
   - `totalExpenses` (excludes soft-deleted)
   - `salePayments`, `supplierPayments`
   - per-method breakdown of `SalePayment` (`CASH`, `UPI`, `CARD`, `BANK`, `CREDIT`, `OTHER`)
   - gold/silver sold and purchased weights
2. Expected cash is derived:
   `expectedCash = cashSales + salePayments (recovery) - supplierPayments - totalExpenses`
3. On `POST /close` (OWNER only), the staff member enters the physically counted `actualCash`. The system stores:
   `difference = expectedCash - actualCash`
4. A `DayClosing` row is written with the full snapshot. Days are uniquely keyed by `closeDate`, so closing a day twice is rejected (400 "Day already closed").
5. `GET /history` returns the last 100 closing records.

Selling in credit means the cash box does not get the sale amount that day; only the settled payments hit `expectedCash`, which is why the calculation uses payment amounts rather than `grandTotal`.

## Old Gold Exchange Flow

`POST /api/old-gold` values customer old gold in steps:

1. Weigh in - `grossWeight` is recorded.
2. Deduct stones and other materials -> `netWeight = grossWeight - stoneWeight - otherMaterialWeight`.
3. Test purity (touchstone/acid, default `Touchstone`) -> `testedPurity` (karats, 0-24).
4. Convert to fine gold: `fineness = testedPurity / 24`; `fineGoldWeight = netWeight * fineness`.
5. Value: `grossValue = fineGoldWeight * rate`; `finalValue = grossValue - deduction` (melting/assay deductions).
6. A `StockMovement` row of type `OLD_GOLD` (positive, for `fineGoldWeight`) records the metal intake.
7. The final value is credited to the customer via a `CustomerTransaction` of type `INCOME` (reduces the customer's outstanding balance). Optionally the old gold item can be turned into a `Product` for resale.

## Job Work Issue/Return Cycle

Job work tracks metal handed to a `Artisan` (goldsmith) for making/finishing.

- `POST /api/job-works` (OWNER/MANAGER) creates a job, records issued items (productId, metal, purity, `issuedWeight`), moves each product to `JOB_WORK`, and writes `ARTISAN_ISSUE` movements (negative weight). Status starts at `ISSUED`.
- `PUT /api/job-works/:id` accepts `returns[]`, each with `itemId`, `returnedWeight`, `finished`. For each return:
  - the `JobWorkItem` is updated; `finished` is true automatically when `returnedWeight >= issuedWeight`
  - the product is moved back to `IN_STOCK`
  - an `ARTISAN_RETURN` movement (positive) is written
- When every item is finished, the job is marked `COMPLETED`. `labourCharge` can be edited until completion.

## Repair Flow

`/api/repairs` implements a typical shop repair service:

1. `POST` (OWNER/MANAGER/STAFF) receives the item: `problem` is required; optionally link a customer, product, artisan, estimated cost, advance paid, and expected delivery. Product status becomes `REPAIR`.
2. `PUT /:id` transitions statuses `RECEIVED -> IN_PROGRESS -> READY -> DELIVERED`. On `DELIVERED` the actual delivery timestamp is recorded and the product returns to `IN_STOCK`.
3. `DELETE /:id` soft-cancels the repair via status `CANCELLED` (OWNER/MANAGER).

## Customer Credit Tracking

- Every credit-affecting event creates a `CustomerTransaction` with an absolute `balanceAfter` (running balance), so history is a correct ledger.
- A sale on credit raises the balance (`SALE` row, +grandTotal; `CUSTOMER_PAYMENT` row for the amount paid).
- A later payment `POST /api/sales/:id/payment` posts a `CUSTOMER_PAYMENT` reducing the balance.
- Old gold receipts post `INCOME` reducing the balance.
- A cancelled sale posts an `ADJUSTMENT` reducing the balance by the unpaid portion.
- The customer detail page and dashboard show the latest `balanceAfter` as the outstanding total.

## Supplier Credit Tracking

Mirror of the customer ledger:

- Purchases create `SupplierTransaction` rows (type `PURCHASE`, +totalCost).
- `POST /api/purchases` and `POST /api/suppliers/:id/payments` create `Payment` rows and `PURCHASE_PAYMENT` transactions reducing the supplier balance.
- The latest `balanceAfter` is displayed as supplier dues on the dashboard and supplier detail page.

## Financial Rules of Thumb

- All money and weights are rounded to 2 decimal places for money, 3 for display weights.
- Never mutate a past invoice: rates and charges are snapshotted on line items at sale/purchase time.
- Day closing happens once per `closeDate`; a prior close blocks another close for that date.
- Audit logs are written for create/update/delete on major entities and for day close, password change, backups, and restore.