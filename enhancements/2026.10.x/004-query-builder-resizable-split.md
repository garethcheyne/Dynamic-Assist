# 004 — Resizable split between the query and the results

**Reported:** 2026-09-28, against 2026.9.25
**Target release:** 2026.10.x
**Platform:** Query builder (CE and BC)

## Feedback

The divider between the query and the results should be resizable.

## Change

The fixed 420px query column is now a resizable panel, using
`react-resizable-panels` (the library behind shadcn's Resizable component):

- Drag the divider, or focus it and use the arrow keys. Double-click resets it.
- The query side keeps at least 280px and at most 75% of the width. The results
  side keeps at least 320px.
- The width is remembered in the site's local storage, one setting for the CE
  builder and one for the BC builder.

Files: `src/query-builder/SplitPanes.tsx`,
`src/platforms/ce/query/ui/QueryApp.tsx`, `src/platforms/bc/query/BcQueryApp.tsx`,
`package.json` (`react-resizable-panels`).
