# Implementation Notes

## 1. What I changed

- **Diff (`diff.util.ts`)**: change detection compared only `unitPrice`, so quantity- or description-only edits were marked `unchanged`. Now compares `unitPrice`, `quantity`, and `description`.
- **List (`cr-list`)**: `visibleRows` filters by `statusFilter` (`ALL` = no filter). Loading / loaded / empty / error paths were already correct and left intact.
- **Detail (`cr-detail`)**:
  - Timeline sorted oldest-first by `at`.
  - `canApprove` / `canReject` require both `PENDING_APPROVAL` and `canApprovePolicy` (any `cr_a_*`).
  - Reject reason: `Validators.required` + non-whitespace pattern; clicking Reject with an invalid reason marks the control touched, shows the error, and does not call the API.
  - `approve()` / `reject()` call the mock API, set `submitting` for the duration, update `state` on success, and set `actionError` on failure without clearing the loaded CR.

## 2. Component & state model

- Both screens use explicit `ViewState<T>` (`idle` → `loading` → `loaded` | `empty` | `error`). Templates switch on `state.status`; no blank screens.
- List: `statusFilter` is local UI state; `visibleRows` is a pure derivation from `state.data` + filter.
- Detail: `detail` / `diff` / `timeline` / `canApprove` / `canReject` are getters over loaded data + session. Action flow uses `submitting` + `actionError` so slow/failed calls stay coherent. Session user comes from `SessionService`.

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Actions only when pending **and** user has approve policy | `canApprove` / `canReject` getters |
| Read-only users cannot act | Approve disabled; Reject block `*ngIf="canReject"` |
| No double-submit | Early return when `submitting`; buttons disabled while submitting |
| Reject needs a non-empty reason | Form validators + guard in `reject()` (no API call; error shown) |
| Failed actions keep the CR on screen | Catch sets `actionError` only; `state` stays `loaded` |
| Timeline is chronological | Sort copy of `audit` by `at` ascending |
| Diff classifies quantity/price/description edits | `computeDiff` field comparison |

## 4. Testing strategy

- Prefer component/DOM tests (click, disabled, roles, rendered text) over poking private fields.
- Fresh `CrApiService` per test so store mutations and `failNext` / `latencyMs` do not leak.
- Cover: list load/empty/error/loading + status filter; detail permissions; timeline order; diff kind; reject validation; approve/reject success; action failure; in-flight disable.
- Skipped under time budget: Retry-button flows, other-org isolation, exhaustive status matrix.

## 5. Assumptions

- Reject uses the same approve policies (`cr_a_*`); there is no separate reject policy in the scaffold.
- Description-only line edits count as `changed` (needed for accurate preview; CR-2 is an example).
- Whitespace-only reject reasons are invalid. Reject remains clickable so an empty submit can surface the inline error; the API is not called until the reason is valid.
- Approve stays visible-but-disabled when not allowed (matches the starter template + provided test); Reject UI is hidden when not allowed.
- Filter with zero matches leaves the loaded table empty rather than flipping to the org-level `empty` state.

## 6. Where I used AI

- Occasional use of an AI assistant while reading the scaffold and drafting notes. All behavior, permission logic, and tests were reviewed and verified locally (`npm test`).

## 7. What I'd improve with more time

- Emit an event after approve/reject so the list pane refreshes without a full shell remount.
- Empty-filter message when `visibleRows` is empty but the org has CRs.
- Shared test helpers for `render` / `flush` across specs.
- Cover Retry paths and org-scoped “Not found” in detail.
