# Book Loan Policy v1.0

## 1. Borrowing limits

1.1 A member may have between 1 and 5 books on loan at the same time.
1.2 The standard loan period is 14 days.
1.3 A loan may be extended at most 2 times. Each extension adds 7 days to the due date.
1.4 Members must be at least 12 years old to borrow without a guardian.
1.5 A late fee is charged for each day after the due date.

## 2. Copy status

Each physical copy has exactly one status: AVAILABLE, ON_LOAN, RESERVED or LOST.

| From | Action | To |
| --- | --- | --- |
| AVAILABLE | checkout | ON_LOAN |
| AVAILABLE | reserve | RESERVED |
| ON_LOAN | return | AVAILABLE |
| ON_LOAN | report_lost | LOST |
| RESERVED | checkout | ON_LOAN |

A reserved copy can only be checked out by the member who reserved it.
