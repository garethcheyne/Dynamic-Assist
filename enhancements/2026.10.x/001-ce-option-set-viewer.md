# 001 — Option set viewer on CE forms

**Reported:** 2026-09-28, against 2026.9.25
**Target release:** 2026.10.x
**Platform:** Dynamics 365 / Dataverse (CE), record forms

## Feedback

The Option Set viewer is missing on CE forms.

## Cause

It was never ported. The CE tool set was rebuilt from Level Up for Dynamics 365,
which has an "Option sets" page listing every choice column on the form with its
values. Dynamic Assist's rebuild left it on the to-do list, so it has never
shipped in Dynamic Assist.

## Change

### Table option sets (Tools → Form → Option sets)

An **Option sets** tile in Tools → Form opens an **Option sets** section just
below it (between Form and List view) and loads it. It works on record forms and
list views, and reads every option set column on the table from its metadata,
including columns the form doesn't show:

- Grouped by type: Choice, Choices (multi-select), Status, Status reason, Yes/No.
- Search by column, option label or value.
- Opening a column lists every option as value and label. Clicking an option
  copies its value, and on a form the record's current choice is highlighted.
- Each column shows its option set name and whether it's global or local, and
  can be copied as JSON or CSV. The section's JSON button copies all of them.

### Form fields (Record → Form fields)

- Choice fields on the form carry their options, read with
  `attribute.getOptions()`, and list them when opened.
- A **Choices** filter chip limits the list to choice fields.

Files: `src/platforms/ce/option-sets.ts`, `src/platforms/ce/types.ts`,
`src/platforms/ce/main-world.ts` (`optionSets` command),
`src/platforms/ce/panel/OptionSetsSection.tsx`,
`src/platforms/ce/panel/OptionList.tsx`, `src/platforms/ce/panel/ToolsView.tsx`,
`src/platforms/ce/panel/CeFieldList.tsx`, `src/components/field-row.tsx`,
`src/components/collapsible-section.tsx` (`reveal`).
Tests: `tests/unit/ce/option-sets.test.ts`.
