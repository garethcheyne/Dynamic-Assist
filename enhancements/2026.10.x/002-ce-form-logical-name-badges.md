# 002 — Logical-name badges on CE form fields

**Reported:** 2026-09-28, against 2026.9.25
**Target release:** 2026.10.x
**Platform:** Dynamics 365 / Dataverse (CE), record forms

## Feedback

With logical names turned on, form field badges show text that looks random,
such as `8bcb-7c212a6cec39-139-hnc_deliv…`, instead of the logical name. The
labels are also squashed to one letter per line ("S / t / a / t / u / s").

## Cause

1. **Wrong name.** A field label's id is
   `id-<guid>-<counter>-<control>-field-label`. The pattern that pulled out the
   control name (`/-\d+-(.+)-field-label$/`) matched the first all-digit
   segment it found. When a segment of the GUID was all digits, the pattern
   matched there and captured the rest of the GUID with the name. That
   "control name" doesn't exist, so the badge fell back to showing it raw.
2. **Squashed labels.** The badge was inserted as a sibling of the label, in the
   same flex row. It kept its full width (up to 180px), which left the label a
   column only a few pixels wide.

## Change

1. The control name is now the last segment without dashes before
   `-field-label`. Control names never contain dashes, and the GUID segments
   before it are skipped. Covered by `tests/unit/ce/form-labels.test.ts`.
2. The badge now sits inside the label on its own line, under the label text,
   and can't be wider than the label. The label keeps its width and wraps
   normally.

Files: `src/platforms/ce/form-labels.ts`, `src/platforms/ce/main-world.ts`.
