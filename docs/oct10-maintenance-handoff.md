# October 10 Maintenance Candidate

Source-only follow-up to v2.3.17. This document is not packaging or publication authorization.

## Scope

- One yellow registration panel replaces the duplicate Register All entry points. It contains the navigation-pause warning and keeps receipts accessible after confirmed completion.
- A fresh, wallet-scoped eligibility read happens before the password prompt. Empty work never replaces prior receipts; eligibility is still rechecked by the backend after unlocking. Unknown transaction outcomes remain locked.
- Completed empty/skipped journals settle without inventing transaction confirmations. Submitted receipts require current wallet transaction confirmation evidence. Confirmation is recomputed, not permanently cached.
- Shakedex and ShakeX use the same conservative Unicode display helper. Valid visible emoji remain visible alongside canonical ASCII. Unsafe/invisible/decomposed or malformed encodings stay ASCII. This display policy is not a blanket IDNA validator; action identities remain unchanged.
- Records/DNS management appears before selling options. Existing record drafts, transaction handlers and sale-provider routing are unchanged.
- The localized balance-guide link from PR #28 is included in this branch.

## Verification Boundaries

Only mocked service tests and inert browser fixtures are used here. No production profile, wallet secrets, live transaction construction/signing/broadcast, DNS write, or installed Bob application is involved.

The packaged interactive registration fixture explicitly supplies mocked eligible names because its disposable wallets are unfunded. Do not count that mocked eligibility as production registration eligibility acceptance. Source service tests exercise the real service method with inert wallet I/O.

Before packaging, combine the separately reviewed Overview/stats lifecycle changes, rerun the full suite and verify the final commit. Before release, repeat relevant packaged acceptance on that exact commit, keeping source assertions distinct from packaged and physical-platform coverage. Auto-update and resolver work are excluded.
