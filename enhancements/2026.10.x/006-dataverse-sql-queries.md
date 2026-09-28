# 006 — SQL queries in the CE query builder

**Reported:** 2026-09-29, against 2026.9.25
**Target release:** 2026.10.x or later (shares its editor with 005)
**Platform:** Dynamics 365 / Dataverse (CE), query builder
**Status:** Planned

## Request

Microsoft has released SQL querying for Dataverse. Support it in the query
builder, with the same validation and metadata-aware autocomplete planned for
FetchXML in 005.

## What Microsoft offers, and which one we can use

| Route | Reachable from the extension? |
| ----- | ----------------------------- |
| **Web API `sql` query option** ([docs](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query/sql), updated 2026-06) | **Yes.** It's a plain `GET` on the table's entity set, authenticated by the user's own session cookies, the same way the builder runs FetchXML today. |
| TDS endpoint (SQL Server protocol on port 1433/5558) | No. Browsers can't open TDS connections. |
| Fabric / Synapse Link SQL endpoints | No. They're separate services with their own sign-in, and they hold a copy of the data, not the live org. |

So "SQL" in Dynamic Assist means the Web API `sql` option.

### How the Web API `sql` option works

```http
GET [org]/api/data/v9.2/accounts?sql=SELECT%20a.name%20FROM%20account%20AS%20a%20WHERE%20a.name%20LIKE%20'Fourth%25'
Prefer: odata.include-annotations="*"
Accept: application/json
```

- The URL's entity set (`accounts`) must be the query's base table (`FROM account`).
- The response is ordinary Web API JSON (`value`, formatted-value annotations,
  `@odata.nextLink`). The builder's existing results code reads it as it is.
  Aliased columns come back as `alias` with an
  `alias@OData.Community.Display.V1.AttributeName` annotation naming the column.
- It's read-only and runs with the user's own permissions, like the rest of the
  builder.

### The supported SQL subset

- `SELECT` with named columns (**no `SELECT *`**), `DISTINCT`, column and table
  aliases.
- `INNER JOIN` and `LEFT JOIN` only. `ON` must be `=` between the two tables'
  columns. Extra `ON` conditions are `AND`-ed and apply to the joined table only.
- `WHERE`: a column compared with a constant (`=`, `!=`, `<>`, `<`, `>`, `<=`,
  `>=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `BETWEEN`, `IS [NOT] NULL`), with
  `AND`, `OR` and parentheses. `DATEADD` and `GETUTCDATE` are allowed on
  constants only, in `WHERE` and `ON`.
- `GROUP BY` with `COUNT(*)`, `SUM`, `AVG`, `MIN`, `MAX`. No `HAVING`.
  Aggregates stop at 50,000 source rows (`AggregateQueryRecordLimit`).
- `ORDER BY` on columns only.
- **Not supported:** subqueries, `EXISTS`, CTEs, `UNION`, `CASE`, `COALESCE`,
  window functions, functions on columns, column-to-column comparisons, more
  than one statement, and anything other than `SELECT`.
- **Paging:** the docs contradict themselves. The feature table lists
  `TOP N (0–5000)` and `OFFSET … FETCH`, while the paging section says neither
  works and to use `Prefer: odata.maxpagesize` with `@odata.nextLink`. Plan on
  `maxpagesize`, and test `TOP` on the dev org (aucmcomcrd01).

## Plan

### 1. A SQL mode in the CE query builder

A third mode next to **Builder** and **FetchXML**. Same results pane, exports,
row limit and saved queries (a saved query records whether it's SQL or
FetchXML).

Running a query:

1. Read the `FROM` table and look up its entity set in the metadata the builder
   already loads.
2. `GET {entitySet}?sql=…`, with `Prefer: odata.include-annotations="*",odata.maxpagesize=N`,
   and follow `@odata.nextLink` up to the builder's row limit (500 by default,
   5,000 at most).
3. Show aliased columns under their alias, with the source column in the header
   tooltip, from the `AttributeName` annotation.

Business Central has no equivalent, so SQL is CE only.

### 2. Editor: CodeMirror 6, shared with 005

`@codemirror/lang-sql` (MSSQL dialect) has metadata-driven autocomplete built in.
Its `schema` option takes `{ table: [columns] }` and completes tables, then
`alias.` columns. Feed it the metadata the builder already loads:

| Cursor after | Suggest |
| ------------ | ------- |
| `FROM`, `JOIN` | Tables (display name shown, logical name inserted) |
| `alias.`, or a bare name in `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY` | Columns of the tables in scope |
| `ON a.x =` | The matching column on the other table, from relationships (`parentcustomerid` ↔ `accountid`) |
| `col =` / `col IN (` on a choice column | Option values, labelled (`100000001 -- Assigned`) |
| `WHERE createdon >` | `DATEADD(day, -7, GETUTCDATE())` snippet |

Same colours as FetchXML (003): VS light, VS Code dark.

CodeMirror's source and bug tracker are now at
[code.haverbeke.berlin/codemirror](https://code.haverbeke.berlin/codemirror/dev/),
with packages still on npm (MIT). Versions are listed in 005.

### 3. Checks before sending

Catch what Dataverse rejects before sending it, with a message that says why:

- `SELECT *` → "Name the columns: Dataverse SQL doesn't support `SELECT *`."
- Subqueries, `EXISTS`, `HAVING`, `UNION`, `CASE`, `RIGHT`, `FULL` or `CROSS`
  joins, more than one statement, anything but `SELECT`.
- Functions on columns, column-to-column comparisons in `WHERE`, `ON` not using
  `=` between the two tables.
- Unknown tables or columns, and a choice column compared with a label instead
  of a value.
- Warn on a leading `LIKE '%…'` (full scan).

To parse, use a JavaScript SQL parser: **node-sql-parser** (Apache-2.0, fine for
the store build) has a T-SQL mode and returns an AST to walk. Fall back to
Dataverse's own error text for anything the parser misses.

### 4. Builder ↔ SQL

- **Builder → SQL:** a **SQL** tab next to **FetchXML** in the results pane,
  generated from the builder's query model, so users can learn and copy it.
  Operators with no Dataverse SQL form (`under`, `above`, `eq-userid`, fiscal
  periods and similar) are called out: "This filter can't be written in
  Dataverse SQL". Relative dates map to `DATEADD(…, GETUTCDATE())`.
- **Operator mapping:** port it from SQL 4 CDS's
  [`FetchXml2Sql.cs`](https://github.com/MarkMpn/Sql4Cds/blob/master/MarkMpn.Sql4Cds.Engine/FetchXml2Sql.cs)
  (**MIT**, ~2,700 lines, built on Microsoft's T-SQL parser library, so port the
  mapping rather than the whole file), with its tests
  (`FetchXml2SqlTests.cs`) as scenarios. Keep the MIT notice.
- **SQL → Builder (later):** parse with node-sql-parser into the builder model.
  Only for queries the builder can represent; otherwise the query stays in SQL
  mode.

## Open questions to test on the dev org

1. Does `?sql=` need the **Enable TDS endpoint** setting or the **Allow user to
   access TDS endpoint** privilege, as the TDS endpoint does? The Web API page
   doesn't say.
2. `TOP` and `OFFSET … FETCH`: accepted or rejected (see the contradiction above)?
3. URL length: long queries in a `GET`. If there's a limit, fall back to a
   `$batch` `POST` that wraps the `GET`.
4. Choice columns: does SQL return `<choice>name` label columns as TDS does, or
   only the value plus the formatted-value annotation?

## Build order

1. SQL mode: run the query and show results, in a plain editor. Proves the
   endpoint and answers the open questions.
2. CodeMirror with `lang-sql` and the metadata schema (after 005 step 1).
3. Checks before sending.
4. Builder → SQL tab.
5. SQL → Builder.
