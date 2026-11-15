# 009: Pick several fields at once in the query builders

**Platform:** Business Central, Dynamics 365. **Status:** Built, tested.

## What was asked

When choosing fields in the query builder, you should be able to select more than
one at a time. Asked for Business Central, then for both.

## Cause

The field picker is a search box that closes as soon as you choose. Adding five
fields took five rounds of clicking into it and typing again, and the search was
lost each time, so choosing "Address" and "Address 2" meant searching twice.

## What changed

The list stays open after a pick and keeps your search, so you can click or press
Enter on as many as you like. What you've picked drops out of the list and shows
as a chip above it. Esc or clicking away closes it. In Business Central it applies
to the main columns and to a joined table's columns; in Dynamics 365, to the
builder's columns.

The list doesn't move while you're clicking in it, even if the chips wrap onto a
new line and push the input down, so a click can't land on the wrong field. It
catches up when you type.

The other pickers, such as the table, a filter's field and a sort field, still
close on a pick, because each of those takes only one.

## Then: tick boxes, then Add

Asked again on 2026-11-08: picking still added one field per click, so it
didn't feel like choosing several at once. The column list now has a tick box
on each field:

- Clicking a field ticks it; nothing is added yet. Ticks are kept as you search
  again, so "addr" then "city" can be ticked in one go.
- **Select all shown** ticks every field the search shows. It then reads
  **Untick shown**, which unticks just those: ticks from other searches stay.
- **Add N** adds the ticked fields, in the order they were ticked, and closes the
  list.
- Enter with nothing ticked still adds the highlighted field straight away and
  leaves the list open, as before; Shift+Enter ticks it.
- Esc or clicking away closes the list and forgets the ticks: nothing is added.

The browser tests check ticking across searches, Select all shown and Untick
shown, and that Esc adds nothing, in both builders.
