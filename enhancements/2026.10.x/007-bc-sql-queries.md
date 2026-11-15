# 007 — SQL queries in the Business Central query builder

**Reported:** 2026-09-29, against 2026.9.25
**Target release:** after 2026.10.x (phase 1 needs no companion update)
**Platform:** Business Central, query builder (companion app)
**Status:** Phase 1 built and tested in a real browser (see "Built" at the end)
**Builds on:** [005](005-fetchxml-validation-autocomplete.md) and [006](006-dataverse-sql-queries.md): the same editor, SQL reader, suggestion and check plumbing

## Request

Give the Business Central query builder the same SQL mode as Dynamics 365 (006).

## The difference from Dynamics 365

Dataverse **runs** SQL: 006 sends the query to the Web API's `sql` option. Business
Central online has no SQL endpoint. Its only SQL is SQL Server itself, on-premises, which
an extension can't reach. So in BC, SQL is **translated** into the query the builder
already runs through the companion app (`BcQuery` in `src/platforms/bc/query/bridge.ts`,
run by `DAQueryService.RunQuery`). The SQL is a way of writing that query, not a new
engine, and the UI should say so ("SQL is translated to a Business Central query").

A bonus: the BC builder already shows each query as AL and as an API query. A SQL
query becomes a `BcQuery` first, so users see the BC equivalent of what they typed.

## What translates

| SQL | `BcQuery` | Notes |
| --- | --- | --- |
| `SELECT [No.], Name, Balance` | `fields` | By field name, caption or number. FlowFields are calculated by the companion. |
| `FROM Customer`, `FROM [Sales Header]`, `FROM [18]` | `table` | By name, caption or number, from the companion's table list |
| `LEFT JOIN` / `INNER JOIN t ON main.lookup = t.key` | `joins` (`inner` true/false) | Only lookups the companion reports (a field with a TableRelation on the main table) |
| `x = 'A'`, `<>`, `<`, `<=`, `>`, `>=` | filter `A`, `<>A`, `<A`… | Values quoted for BC's filter syntax |
| `x LIKE 'Con%'` / `'_ontoso'` | `Con*` / `?ontoso` | `@` prefix for case-insensitive (a `LIKE` option or a hint) |
| `x BETWEEN 10 AND 20` | `10..20` | |
| `x IN ('NZ','AU')`, `x = 'NZ' OR x = 'AU'` | `NZ\|AU` | OR is fine within one field |
| `x IS NULL` / `IS NOT NULL` | `''` / `<>''` | BC has blanks, not NULL; the check says so |
| `NOT LIKE`, `NOT IN` | `<>Con*`, `<>NZ&<>AU` | |
| Conditions on joined tables | the join's `filters` | Makes a LEFT JOIN restricting, as the builder does today |
| `ORDER BY a, b [DESC]` | `sort`, `descending` | One direction for the whole sort: `SetView('SORTING(…) ORDER(…)')` |
| `TOP n` | `top` | Plus the existing paging (`after`) and `count` |

## What doesn't translate (phase 1 rejects it with a clear message)

- **OR across different fields** (`Name LIKE 'A%' OR City = 'Auckland'`): BC filters AND
  across fields. → Phase 2.
- **GROUP BY, COUNT, SUM, AVG, MIN, MAX**: the companion doesn't aggregate. → Phase 2.
- **Mixed sort directions** (`ORDER BY a ASC, b DESC`): the model has one switch.
  → Phase 2, if wanted.
- **Joins that aren't lookups**, or on more than one field. → Out of scope.
- **Subqueries, UNION, CASE, functions, expressions**: as in 006.

## Plan

### Phase 1: client-side only, no companion release

1. **SQL mode** in `BcQueryApp`: a third mode next to the builder, with the same CodeMirror
   editor, the `sql-parse.ts` reader and a BC colour/keyword setup.
2. **Translator** `src/platforms/bc/query/from-sql.ts`: SQL → `BcQuery`, or a list of
   problems with positions. It resolves names through the companion's table, field and
   lookup lists (already loaded by the builder), and quotes values for BC's filter
   syntax (special characters `& | ( ) < > = . * @ ?` and `'` need quoting).
3. **Checks** (`bc-sql-lint.ts`): everything in the "doesn't translate" list, plus
   unknown tables and fields, joins that aren't lookups, NULL vs blank, option fields
   compared with a caption instead of a value, and FlowFields in WHERE (they filter as
   FlowFilters/CalcFields; say so).
4. **Suggestions** (`bc-sql-complete.ts`): tables by name and caption; fields per
   alias, with type and class (Normal, FlowField, FlowFilter); join conditions from the
   companion's lookups after `ON`; option values; only the keywords that translate.
5. **Builder → SQL**: a SQL tab next to AL and API query, generated from the builder's
   `BcQuery`.
6. **Saved queries** keep BC SQL like CE SQL (`sql` on the saved query).

Tests: translator round trips (SQL → `BcQuery` → SQL), filter quoting, each rejection
message, and suggestions against a fixture of tables, fields and lookups.

### Phase 2: companion release (optional)

- **Cross-field OR**: `FilterGroup(-1)` in `DAQueryService`, with a new `BcQuery` field
  (for example `orFilters`).
- **Aggregates**: `GROUP BY` with `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, looping in AL
  (or `CalcSums` where there's a SumIndexField key), with a row cap like Dataverse's
  50,000.
- **Per-field sort direction**, if phase 1 shows people need it.

Each needs a companion version bump and a check in the builder that the installed
companion supports it, as paging does today (`after`, companion 2026.9.24.6+).

## Later: BC 29's MCP server

BC 29 adds an MCP server with "run data queries". It's closer to real querying, but it
needs OAuth, which the extension deliberately avoids (see the roadmap: no token capture).
Keep it on the watch list, not the plan.

## Open questions

1. Name resolution: when a field name and a caption differ (`"No."` vs `"Customer No."`),
   prefer the name, and say which was matched in the hover.
2. Should `LIKE` be case-insensitive by default (`@`), as SQL Server usually is, or match
   BC's case-sensitive default? Proposal: case-insensitive, with a note in the check.
3. Do we allow `FROM [18]` (table numbers) and `[1]`-style field numbers? Handy for BC
   developers; harmless.

## Built (2026-11-06)

Phase 1, in `src/platforms/bc/query/sql/`, with the open questions settled: names match
by number, then name, then caption; `LIKE` ignores case (`@`); table and field numbers
are allowed.

**Added to the plan, at the user's request: SQL-like functions in the suggestions, that
compile to a proper query.**

| SQL | Becomes |
| --- | --- |
| `TODAY()`, `GETDATE()`, `NOW()` | BC's `t` |
| `WORKDATE()` | BC's `w` |
| `DATEADD(day, -30, TODAY())` | A date, worked out when it runs. day, week, month, year |
| `YEAR(field) = 2025` | `2025-01-01..2025-12-31` |
| `UPPER(field)`, `LOWER(field)` | Ignores case (`@`) |
| `COUNT(*)` alone | The companion's own count |
| `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP BY` | Worked out in the browser, from every matching row a page at a time, up to 50,000; over that it says the totals are short (`aggregate.ts`). So phase 2's aggregates aren't needed for this, only for tables far bigger than that |

**Changed from the plan:** checks are the translator's own problems, so what's flagged and
what runs can't disagree. Going back to Builder loads what the SQL compiled to, unless it
adds rows up, which the builder can't show. Still not built: OR across different fields
and mixed sort directions on plain queries (totals can already mix directions, because
they're sorted in the browser).

Tests: `tests/unit/bc-query/bc-sql.test.ts` and the browser area `bc-sql`.

## Checked against the code and Microsoft's docs (2026-11-07)

- **Fixed: AND and OR mixed without brackets.** `a AND b OR c` means `(a AND b) OR c` in
  SQL, but it ran as `a AND (b OR c)`: different rows, with no warning. It's now an error
  that asks for brackets. `(a OR b) AND c` on one field's ORs still runs.
- **Cross-field OR is possible, with limits the plan didn't list.** `FilterGroup(-1)`
  matches records meeting at least one filter in the group, and `RecordRef` has it. But
  [Microsoft's docs](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/record/record-filtergroup-method#remarks)
  say group -1 doesn't filter on FlowFields, and there's one such group, so
  `(a OR b) AND (c OR d)` can't be written. The companion doesn't use it yet.
- **Mixed sort doesn't need the companion, and the companion can't do it cheaply.** The
  companion sorts through `SetView`, whose `ORDER()` has one direction for the whole
  sort, so phase 2's "per-field sort direction" would mean reading and sorting in AL. The
  browser can do that the way totals do, up to 50,000 rows, with no companion release.
