# Decision log

## What I assumed and why

**The model should never see the raw GA4 schema.** GA4 stores event parameters as a repeated struct where every value is a four-field struct (`string_value`, `int_value`, `float_value`, `double_value`) and three of the four are always null. Picking the wrong field returns NULL _silently_ — no error, just a confidently wrong answer. On top of that, available keys vary per event, some are always null, and similar concepts use different types (`session_engaged` arrives as a string `"1"`, `engaged_session_event` as an int `1`). Nothing in the schema tells the model any of this.

So I wrote the UNNEST logic once, by hand, verified it, and exposed two flat relations: `sessions` (one row per session per day) and `items` (one row per product line). The model writes plain SQL against clean column names. I kept this layer in application code as CTEs rather than as BigQuery views, so the app carries its own schema instead of depending on views existing in whatever project it runs against.

**Session grain is session-day, not session.** I measured this: 116,256 rows against 114,882 distinct session ids over January, so ~1.2% of sessions cross midnight and appear on two dates. Counting rows therefore overstates sessions by about 1%. I kept it, because it is how daily traffic is normally reported and it keeps "how many sessions on the 15th" meaningful. It is documented in the model-facing schema description rather than left implicit.

**GA4 placeholder values are documented, not filtered.** `<Other>`, `(none)`, `(direct)`, `(data deleted)` and `(not set)` look like real channels and products. A naive ranking puts them at the top and reads as a finding. Rather than strip them, I explained what each one means in the schema description so the model handles them honestly.

**Correctness needs a baseline.** I checked two months by hand against the raw export: January 2021 (114,882 sessions, $57,350) and December 2020 (129,376 sessions, $160,555). The agent reproduces both exactly. I also ran the same question three times to confirm the answers are stable, not merely plausible.

## What I cut

Streaming, tests, a compiled/typed frontend, real SQL parsing in the validator, and support for multiple date ranges in one query. Each is listed below with what I would do instead.

## Where I got stuck

**The date filter could not live where I first planned it.** I intended to let the model write its own `_TABLE_SUFFIX` filter and validate that it was present. Implementing it, I found that table pruning only works _inside_ the CTE — a filter in the model's outer query runs after everything has already been scanned, so it controls nothing. Since the model does not write the CTE, the filter had to become structural: the CTEs carry date placeholders, the model passes the range as tool arguments, and substitution happens in code. The model chooses which range; the code guarantees there is one.

That substitution is string concatenation, so the dates are untrusted input. An eight-digit regex closes injection outright, plus checks for a real calendar date, a range inside the dataset bounds, and start ≤ end.

**Prompt instructions are probabilistic.** Two cases, both found by running the same question repeatedly. The model sometimes charted sessions and revenue on one shared y-axis despite an instruction not to mix units — the instruction was buried at the end of a long property description. Moving it into the tool's own description, with an explicit instruction to call the tool twice instead, made it much less frequent, but I have still seen it recur. And "chart it when a chart helps" produced different decisions across identical runs, until I replaced it with a checkable rule (three or more rows and at least one numeric column).

The mixed-unit case is the one I would close in code rather than prose: a check in the chart validator comparing the magnitude of each series, rejecting the spec and telling the model to split it when one series dwarfs another. That is heuristic and would occasionally reject a legitimate chart, but it converts a request into a guarantee, and a rejected spec goes back to the model to fix rather than reaching the user.

**API errors do not arrive as exceptions.** Found while testing edge cases, not while reading code: a deliberately vague question ("how are we doing?") made the next request fail with Cannot read properties of undefined. The cause is that fetch only throws on network failure, so an API error comes back as a perfectly valid HTTP response whose body is { type: "error", ... } with no content field. My loop read content straight away and blew up three functions later, far from the real cause. The fix is to check the response shape before reading it and throw with the API's own message, so the failure is legible where it happens.

Neither prompt fix is a guarantee, which is the point. The contrast with the date filter is the thing I would keep from this project: **a prompt instruction is a request, a code check is a guarantee.** Where cost or correctness is at stake, the constraint belongs in code. Where it is a presentation judgement, a prompt is the right tool and the residual variance is acceptable. Colour belongs to neither — it is presentation, so the frontend owns it with a fixed palette.

## What I would build with another 40 hours

- **Tests:** The validators are pure functions and the obvious first target: `20210231` passes the regex but is not a real date; out-of-range dates; non-SELECT statements; series whose length does not match labels. Then an integration test of the loop with the model mocked, asserting that a failed validation returns as a tool result and the loop retries rather than throws.
- **Streaming:** Each turn is a full round trip, so answers take several seconds. Server-Sent Events would change how slow it feels far more than any real speedup would.
- **Conversation storage:** History lives in an in-memory `Map`: lost on restart, never expires, single process only. Redis or a database with a TTL would fix that and make the server stateless.
- **Real SQL parsing in the validator:** The current check is prefix-based. I deliberately dropped a keyword blocklist because scanning for `CREATE` or `DROP` also matches inside string literals, so `WHERE medium = 'CREATE'` would be rejected. Worth saying plainly: the real guarantee against writes is that the BigQuery credential has no write permission. The validator is a first layer that catches mistakes early and hands the model something it can act on, not a security boundary.
- **Shared types across the HTTP boundary**, so the chart spec has one definition instead of one on the server and one implied in the browser.
