# 005 — FetchXML validation and metadata-aware autocomplete

**Reported:** 2026-09-28, against 2026.9.25
**Target release:** 2026.10.x (may slip to a later release; this is the largest item)
**Platform:** Dynamics 365 / Dataverse (CE), query builder, FetchXML mode
**Status:** Planned

## Request

When editing FetchXML by hand, the query builder should:

- suggest what can go where: elements, attributes, and values drawn from the
  org's metadata (tables, columns, operators, choice values, relationships);
- flag mistakes as you type, with a message for each.

Port the logic from existing open-source C# tools rather than invent it.

## Where the logic lives on GitHub

| Source | What it has | Licence | Use it how |
| ------ | ----------- | ------- | ---------- |
| [MarkMpn/MarkMpn.XmlSchemaAutoComplete](https://github.com/MarkMpn/MarkMpn.XmlSchemaAutoComplete): `Autocomplete.cs` (~860 lines), `PartialXmlReader.cs`, `PartialXmlNode.cs` | The autocomplete engine FetchXML Builder uses. It reads half-typed XML, works out where the cursor is against the schema, and suggests the elements and attributes allowed there. Values come from two hooks, `AutocompleteValue` and `AutocompleteAttributeValue`, which the host fills from metadata. | **MIT** | **Port.** Keep the MIT notice with the ported code. |
| [MarkMpn/Sql4Cds](https://github.com/MarkMpn/Sql4Cds) | SQL 4 CDS engine: builds and checks FetchXML against metadata. | **MIT** | Reference for metadata rules if needed. |
| [rappen/FetchXMLBuilder](https://github.com/rappen/FetchXMLBuilder): `FetchXmlBuilder/Builder/Validations.cs` (~400 lines), `DockControls/XmlContentControl.cs` (`InitIntellisense`), `Resources/fetch.xsd`, `FXBTests/AutocompleteTests.cs` | The validation rules (one method per element) and how FetchXML Builder wires metadata into the autocomplete hooks. | **GPL-3.0** | **Do not port the code.** See below. |
| [Microsoft Learn FetchXML reference](https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/reference/) | Every element, its attributes and allowed values, operators, and the rules behind most of FetchXML Builder's checks. | Docs, free to use | **Source of truth** for our schema table and rule list. |
| [MarkMpn/MarkMpn.FetchXmlToWebAPI](https://github.com/MarkMpn/MarkMpn.FetchXmlToWebAPI) | FetchXML → Web API conversion. | None stated (all rights reserved by default) | Don't use. |

### The GPL problem

FetchXML Builder is GPL-3.0. Porting its C# into Dynamic Assist would make
Dynamic Assist a derivative work, which would then have to be released under the
GPL with its source. The Chrome Web Store listing isn't set up for that.

What we can do is take the **rules** from it, not the **code**. A rule like
"aggregate queries should alias every attribute" is a documented fact about
FetchXML. Almost every rule in `Validations.cs` links to the Microsoft Learn page
or Mark Carrington's blog post it comes from. We write our own implementation
from those sources. The same goes for `fetch.xsd`: build the schema table from
the Microsoft Learn element reference, not from FetchXML Builder's copy of the
file.

## Plan

### 1. Editor: CodeMirror 6

Replace the textarea overlay from 003 with CodeMirror 6 (`@codemirror/view`,
`@codemirror/state`, `@codemirror/lang-xml`, `@codemirror/autocomplete`,
`@codemirror/lint`). About 150–200 KB, and it runs inside the query builder's
shadow root (`EditorView({ root: shadowRoot })`). Monaco was rejected as too
heavy (several MB and web workers) for a content-script UI.

Keep the 003 colours as a CodeMirror highlight theme (VS light, VS Code dark).

CodeMirror moved off GitHub in April 2026. Its home, bug tracker and source are
now at [code.haverbeke.berlin/codemirror](https://code.haverbeke.berlin/codemirror/dev/)
(the old github.com/codemirror repos are stale). Install from npm as usual. All
packages are MIT. Current versions (2026-09-29): `@codemirror/view` 6.43,
`@codemirror/state` 6.7, `@codemirror/autocomplete` 6.20, `@codemirror/lint` 6.9,
`@codemirror/lang-xml` 6.1, `@codemirror/lang-sql` 6.10. Use the separate
packages rather than the `codemirror` bundle, to keep only what the builder needs.

### 2. FetchXML schema table

A TypeScript table of every element: its allowed children, its attributes, and
each attribute's allowed values (`link-type`, `type="and|or"`, `aggregate`,
`dategrouping`, `datasource`…). Built from the Microsoft Learn reference pages.
It drives both structural suggestions and structural checks.

`@codemirror/lang-xml` takes this shape directly (`elements`, `attributes`,
`children`, `values`), which covers most of what `XmlSchemaAutoComplete` does
for structure. Port `PartialXmlReader`'s context logic only if CodeMirror's
syntax tree isn't enough to find the enclosing entity or link-entity.

### 3. Metadata suggestions

The CE query builder already loads what's needed: `metadata.ts` (tables,
columns, types), `lib/enrichment.ts` (choice values, lookup targets) and
`lib/operators.ts` (operators by type). Add relationships
(`ManyToOneRelationships` and `OneToManyRelationships` from `EntityDefinitions`).

| Cursor in | Suggest |
| --------- | ------- |
| `entity/@name`, `link-entity/@name` | Tables (display name shown, logical name inserted) |
| `attribute/@name`, `order/@attribute`, `condition/@attribute` | Columns of the nearest enclosing `entity` or `link-entity` |
| `condition/@operator` | Operators valid for that column's type |
| `condition/@value`, `<value>` on a choice column | Option values, labelled (`100000001 — Assigned`) |
| `link-entity/@from`, `@to` | Relationship columns between the two tables; picking a relationship fills both |
| `condition/@entityname` | Aliases defined in the query |

### 4. Checks (as-you-type, CodeMirror lint)

1. **Well-formed XML:** the browser's `DOMParser`, with line and column.
2. **Structure:** elements and attributes against the schema table.
3. **Metadata:** unknown table or column, an operator that doesn't fit the
   column type, a non-numeric value on a choice column, an alias used but never
   defined, a `link-entity` missing `name`, `from` or `to`.
4. **Documented rules**, written from Microsoft Learn with a link on each message:
   - aggregate queries: alias every attribute, no `order/@attribute` (use
     `@alias`), sort by every grouped column for correct paging;
   - `link-entity` types `any`, `not any`, `all` and `not all` only inside a
     `filter`, return no attributes there, and a `filter` link can't be another
     type;
   - `distinct` queries: sort by every attribute for correct paging;
   - sorting on a `link-entity` triggers legacy paging;
   - `datasource="retained"` (long-term retention): no `link-entity`, no
     aggregates;
   - aliases: letters, digits and `_` only, and not starting with a digit;
   - an empty `filter` or a `condition` with no attribute.

   Levels: error (Dataverse will reject it), warning (probably wrong), info
   (works, with a caveat).

### 5. Server check (optional, on pause or a Validate button)

Dataverse can check a query without running it, as the signed-in user:

- [`FetchXmlToQueryExpression`](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/reference/fetchxmltoqueryexpression)
  (Web API function): parses the query and returns the same error a run would.
- `ValidateFetchXmlExpression`: reports performance issues (for example
  unindexed or leading-wildcard filters).

Show their messages in the same lint gutter.

## Build order

1. CodeMirror swap, keeping the 003 colours. Ships on its own.
2. Schema table: structural suggestions and checks 1–2.
3. Metadata suggestions and check 3.
4. Documented rules (check 4).
5. Server check.

Each step is releasable on its own.

## Tests

- Unit tests for the schema table, the context resolver (cursor → enclosing
  table), and each rule, with FetchXML fixtures in `tests/unit/query-builder/`.
- Use `FXBTests/AutocompleteTests.cs` only as a list of scenarios to cover.
  Write the cases fresh; don't copy them.
