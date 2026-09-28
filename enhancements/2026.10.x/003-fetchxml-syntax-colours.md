# 003 — FetchXML syntax colours in the query builder

**Reported:** 2026-09-28, against 2026.9.25
**Target release:** 2026.10.x
**Platform:** Dynamics 365 / Dataverse (CE), query builder

## Feedback

Colour the FetchXML, as XrmToolBox's FetchXML Builder does.

## Change

FetchXML is coloured in both places the query builder shows it:

- The **FetchXML** tab of the results pane (read-only).
- The **FetchXML** editing mode, while you type. The textarea sits over a
  coloured copy of its own text, so editing, selecting and pasting work as
  before.

Light mode uses Visual Studio's XML colours (blue brackets and values, dark red
element names, red attribute names, green comments). Dark mode uses VS Code's.

A small built-in tokenizer does the colouring, so no new dependency. It copes
with half-typed markup: an unclosed value stops at the end of its line.

Files: `src/lib/xml-tokens.ts`, `src/query-builder/XmlCode.tsx`,
`src/query-builder/query.css`, `src/platforms/ce/query/ui/QueryApp.tsx`.
Tests: `tests/unit/query-builder/xml-tokens.test.ts`.
