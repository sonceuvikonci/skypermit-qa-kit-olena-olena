# TC-UIOP-008: Request form lets the operator select a C3 aircraft together with zone KBP-CTR-3

| Field | Value |
|---|---|
| **ID** | TC-UIOP-008 |
| **Doc ref** | `04 — Frontend Scope` § Two contracts to hold exactly («The form does not pre-filter»); `06 — Business Rules` §3 (band `C3`), §4 (`KBP-CTR-3` permits C0–C2); SKY-3 AC 1 |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `12001` (one gram past the C2 upper bound, band `C3`) and `serial_number` = `QA-C3-12001` (assumed). The picker label does not show weight, so the aircraft is found by its serial.
4. The operator is on the request creation form `/operator/requests/new`.

## Test data

| Item | Value |
|---|---|
| Zone | `KBP-CTR-3` (permitted bands C0–C2, so `C3` is not permitted) |
| Aircraft | `serial_number` = `QA-C3-12001` (assumed), `mtom_grams` = `12001` (band `C3`) |

## Steps

1. In `flight-request-zone-select`, choose `KBP-CTR-3`.
2. In `flight-request-aircraft-select`, choose the option whose label contains `QA-C3-12001`.

## Expected result

1. `flight-request-zone-select` has `KBP-CTR-3` selected.
2. `flight-request-aircraft-select` has the option containing `QA-C3-12001` selected, and the zone select still has `KBP-CTR-3` selected.

Open question: `04 — Frontend Scope` does not say what the aircraft option label shows; the code labels it `manufacturer model (serial)` without the weight band, so the aircraft is identified by serial (source: code, not docs).
Open question: the selectors `flight-request-zone-select` and `flight-request-aircraft-select` and the path `/operator/requests/new` are taken from the code, not from `04 — Frontend Scope`.
