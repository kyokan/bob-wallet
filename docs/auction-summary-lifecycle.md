# Auction summary lifecycle

Overview and Transactions share `walletStats`; Overview's primary auction total
is the existing sum of bidding, revealable and finished auction estimates. It is
not the all-covenant locked balance, not necessarily refundable, and is not used
to derive a burned-value residual. All-covenant and confirmed/current accounting
remain in Balance details. The localized public balance guide stays visible.

## Diagnosis and boundaries

The previous `fromNames` awaited a Shakeshift HTTP request for each eligible
registration. Per-socket timeouts could accumulate across many names. These
optional requests have been removed from this summary calculation. Local
`highest - value` estimates retain the existing fallback math and explicitly set
`verified: false`; financial construction and price validation are unchanged.
An isolated `getauctioninfo` log does not prove which Overview await was pending.

Core statistics have a 30-second read-only backend budget and a 35-second renderer
response budget. Neither timeout applies to signing, broadcasting, registration,
rescan or another financial operation. Diagnostics include only request ID,
generation, fixed method/stage names, event and elapsed milliseconds; no wallet
names, domain lists, balances or secrets. Backend timeout identifies the pending
method(s), including wallet loading. The UI shows a safe localized reason and a
read-only Retry, never an automatic rescan or deep clean.

Same-context requests are deduplicated. A mutation-invalidated request is followed
by a new read after the older request settles, not reused as a fresh snapshot.
Node or wallet height changes likewise queue a fresh snapshot and reject the
older block's completion; backend deduplication also includes wallet DB height.
Backend wallet-selection contexts separate A-B-A sessions. Renderer generation
checks apply before transport and before completion; navigation shares work and
does not attach component-local asynchronous updates.

Local HSD database reads have no abort primitive. A timed-out active read therefore
retains its concurrency slot until it settles; it is not falsely claimed aborted.
At most three underlying reads run, queued reads are bounded and removed on
cancellation, and aborted jobs start no further reads. Renderer transports are
also capped at three if IPC never responds. Retry cannot create unbounded work.

## Display and validation

Loading, slow, failed and successfully empty summaries are distinct. Only complete
validated results can show zero or All clear. Independently ready spendable values
stay visible. Unknown auction counters use a placeholder, never an authoritative
zero. Slow state reports measured elapsed time, not a completion percentage.

Source fixtures cover 128 eligible registrations, hung local reads, deduplicated
requests, timeout/retry, late completion, wallet A-B-A and the Transactions sum.
External enrichment is absent rather than simulated as successful. Four-language
offline fixtures expose ready/loading/slow/failed states. These checks are not
packaged acceptance or evidence about a user's live balance.
