# 0005: Evidence export uses a hand-rolled, store-only ZIP writer

- **Status:** Proposed
- **Date:** 2026-10-04
- **Owners:** DSN-013 implementer (worker subagent) - pending integrator review at merge
- **Related task:** DSN-013
- **PRD references:** C11 evidence/handoff
- **Supersedes:** None
- **Superseded by:** None

## Context

Task 11's `buildExportZip` must package exactly three generated artifacts
(`brief.html`, `provenance.json`, `ncrp-preview.html`) into a single
downloadable archive. Neither the root `package.json` nor
`apps/api/package.json` pins any zip library (checked via `npm ls`/direct
read of both manifests), and adding one is a dependency change - something
this task's owned paths do not cover (lockfile/root `package.json` changes
require serialized integrator ownership per `AGENTS.md`). The content being
archived is small (three short, already-text documents, no binary assets),
so compression has negligible benefit here.

## Decision

Implement a minimal, dependency-free ZIP writer in `apps/api/src/export.ts`
(`buildZip`), storing every entry uncompressed (ZIP compression method 0 -
"store"). It writes the standard local-file-header (`0x04034b50`) + central-
directory (`0x02014b50`) + end-of-central-directory (`0x06054b50`) structure,
using Node's built-in `node:zlib` `crc32` function (confirmed present and
typed in this environment: Node v24.14.1 at runtime; `@types/node` 22.20.4
declares `function crc32(data: string | NodeJS.ArrayBufferView, value?:
number): number;`) rather than hand-rolling a CRC32 table. DOS
time/date header fields are zeroed; `provenance.json`'s own `generatedAt`
field is the real timestamp of record.

## Consequences

- Positive: zero new dependencies, no lockfile/root `package.json` change
  needed, and the archive remains openable by any standard zip tool (store
  method is part of the base ZIP spec, not an extension).
- Cost: ~100 lines of hand-rolled binary-format code to maintain, and no
  compression (acceptable given the archive's small, text-only contents).
- Follow-up: if export ever needs to carry larger or binary content (e.g. an
  attached audio clip), revisit adding a real zip dependency as a serialized
  integrator change rather than extending this writer with compression
  support.

## Alternatives considered

### Add a zip dependency (e.g. `archiver`, `jszip`, `yazl`)
Rejected for this task: `package.json`/lockfile changes are serialized
integrator-only paths, and introducing a new runtime dependency for three
small text files is disproportionate. Worth reconsidering at the integrator
level if export's scope grows.

### Return the three files as separate downloads instead of one archive
Rejected: the plan's acceptance criteria and `EvidenceScreen`'s single
"Download evidence" action both expect one artifact; three separate browser
downloads is a worse, more error-prone handoff experience.

## Verification

- `apps/api/test/evidence.test.ts`: a test-local ZIP-entry reader (scanning
  local file headers by the same `0x04034b50` signature) confirms the
  archive contains exactly `brief.html`, `provenance.json`, and
  `ncrp-preview.html`, and that each entry's content round-trips correctly
  (HTML-escaping assertions read entry content back out of the real
  produced bytes, not a mocked writer).
- Full API regression (`firebase emulators:exec --only auth,firestore 'npm
  run test:api'`) passed 278/278 after this writer was introduced.
