# Tests

| Folder     | What                                                                                                                                                                                                            | Run                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `unit/`    | The query builder's logic, in Node: BC filters to OData, the generated AL (record code and API queries, **compiled with the real AL compiler**), REST endpoint choice, joins, the companion endpoint's requests | `npm test`          |
| `live/`    | The Dynamic Assist Companion against a real Business Central: types of every value across 16 tables, filters, joins, paging, explore (`describe`, `search`), errors                                             | `npm run test:live` |
| `results/` | Reports from each run: Markdown to read, JSON to compare                                                                                                                                                        | written by the runs |

## Unit tests

```powershell
npm test              # run them
npm run test:report   # run them and save tests/results/unit-latest.md (and .json)
```

`unit/bc-query/al-compile.test.ts` compiles the generated AL and the companion app with `alc.exe` against Base Application symbols. It skips itself where they aren't installed; point it at them with `ALC_PATH` and `AL_SYMBOLS` (a `.alpackages` folder with System, System Application, Business Foundation, Base Application and Application).

## Live tests

They run in your browser, as you, through the companion's bridge, the way the query builder does. Read-only: they only query.

1. Start Chrome or Edge with remote debugging: `chrome.exe --remote-debugging-port=9333 --user-data-dir=<a test profile>`.
2. Sign in to Business Central and open **Dynamic Assist Query** (page 77500) in an environment with the companion installed. You need the DA QUERY permission set.
3. `npm run test:live`

Results go to `tests/results/live-<date>-<time>.md` and `.json`, and `live-latest.md`. They hold counts, types and pass/fail, not record data. They do name your environment and table sizes, so `tests/results/` is git-ignored; share a report on purpose if you want to.

The suite checks correctness, not your data: a join reports its match rate (a sandbox can hold entries whose master record was deleted) but fails only when a joined row doesn't match its key.
