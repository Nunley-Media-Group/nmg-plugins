# Claude Design URL — Fetch & Decode

**Consumed by**: `draft-issue` Step 1a.
**Triggering condition**: `session.designUrl` is non-null after Step 1 (the user supplied a `claude.ai` design URL either in the CLI argument or at the single optional prompt).

This reference documents how the skill fetches a Claude Design archive, decodes its payload, extracts the README, and gracefully degrades when anything goes wrong. A design-fetch failure must NEVER abort the `draft-issue` session — the skill continues without design context and logs a single-line failure note consumed by Step 11.

## Procedure

Reuses the same flow as `/onboard-project` §2G.1 to avoid drift.

1. **Validate URL is HTTPS.** If not, log `"Design URL rejected (non-HTTPS)"`, set `session.designContext = null`, set `session.designFailureNote = "non-HTTPS URL"`, and continue to Step 1b.
2. **Fetch** via `WebFetch` with a 15s default timeout.
3. **Decode**: if the response indicates gzip (content-type `application/gzip` / `application/x-gzip` OR magic bytes `1f 8b` at offset 0), decode via:
   ```
   Bash(node -e "process.stdout.write(require('node:zlib').gunzipSync(Buffer.from(process.argv[1],'base64')).toString())" "<base64>")
   ```
   Pass the payload as a base64 argument — never interpolate raw payload bytes into a shell command.
4. **Parse**: locate `README.md` or `README` at the archive root. Archive entry filenames are validated against `[A-Za-z0-9._/-]`; any `..` path component aborts the parse.
5. **Cache**: `session.designContext = { url, fetchedAt, readme, rawSize }`.

## Failure modes (graceful degradation)

| Failure | Handling |
|---------|----------|
| HTTP 4xx/5xx | Log `"Design fetch failed ({status}) — continuing without design context"`; set `session.designContext = null` |
| Timeout | Same log line with `(timeout)`; same null assignment |
| Decode failure (non-gzip, corrupted) | Same log line with `(decode failed)`; same null assignment |
| Archive missing README | Same log line with `(no README found)`; same null assignment |

Any failure sets `session.designFailureNote` (captured for Step 11). The session continues to Step 1b unchanged — a design-fetch failure must NOT abort the batch.

## Output

- `session.designContext` — `{ url, fetchedAt, readme, rawSize }` or `null`
- `session.designFailureNote` — single-line failure description or `null`

## Downstream consumers

`session.designContext` is read-only after this step. Steps 4, 5, and 6 consult it:

- Step 4 weaves design README excerpts into the "Current State" summary (feature path) or root-cause framing (bug path) and cites the design URL inline.
- Step 5 may reference design components as pre-known context rather than re-eliciting them from the user.
- Step 6 cites the design URL in the Background section when `session.designContext` is present.

Iterations of the Per-Issue Loop MUST NOT mutate `session.designContext`.
