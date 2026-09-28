# 007 — SQL queries in the Business Central query builder

**Reported:** 2026-09-29, against 2026.9.25
**Target release:** after 2026.10.x (phase 1 needs no companion update)
**Platform:** Business Central, query builder (companion app)
**Status:** Planned
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
