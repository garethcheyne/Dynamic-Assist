# Tests

| Folder     | What                                                                                                                                                                                                            | Run                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `unit/`    | The query builder's logic, in Node: BC filters to OData, the generated AL (record code and API queries, **compiled with the real AL compiler**), REST endpoint choice, joins, the companion endpoint's requests | `pnpm test`         |
| `live/`    | The Dynamic Assist Companion against a real Business Central: types of every value across 16 tables, filters, joins, paging, explore (`describe`, `search`), errors                                             | `pnpm test:live`    |
| `results/` | Reports from each run: Markdown to read, JSON to compare                                                                                                                                                        | written by the runs |

## Browser tests

`pnpm test:e2e` clicks through the whole extension in a real Chrome, on a real Business Central and Dynamics 365: every panel tab, tile and copy button, the query builders, the right-click menu's handlers, Power Automate and Power Apps. Every function ends as passed, failed or skipped with its reason, in `tests/results/e2e-latest.md`. With a failure, what the browser showed goes in `tests/results/e2e-shots/`.

1. `pnpm build`: it tests `dist/`.
2. Copy `.env.example` to `.env` (git-ignored) and fill it in. Use a sandbox and a dev org. **Your real environment names go only in `.env`:** both repositories are public, and `pnpm test` fails if one of its values turns up in a file git would commit.
3. `pnpm test:e2e`. Chrome opens with its own profile, outside the repository, and loads the extension itself. Sign in when it asks, the first time. Each run installs the extension afresh: Chrome otherwise keeps running a stored service worker from an older build for as long as the version stays the same. So its storage starts empty each run.

`pnpm test:e2e bc-panel ce-builder` runs only those areas, and `--only=blur` only tests whose name matches. Areas: `bc-panel`, `bc-menu`, `bc-builder`, `bc-sql`, `shell`, `ce-panel`, `ce-write`, `ce-builder`, `ce-sql`, `ce-menu`, `flow`, `layout`.

**What it changes.** Each Business Central query adds a row to the companion's own Query Log, as it does for anyone. `ce-write` and `ce-panel` create accounts named `DA E2E test …`, edit and save them, and delete them again, so plug-ins and flows on account may fire. Nothing else is written. It never turns a flow on or off: bulk stops at its confirm and cancels. Impersonation only runs if you name a test user in `impersonateUser`, and it only reads.

**What it can't cover.** Chrome's own right-click menu can't be scripted: tests right-click the element, then fire the click the menu would send. Chrome only opens the real side panel on a user gesture, so the panel runs as a background tab. Each is a skip or a note in the report, with what to check by hand.

**A trap for new tests in Dynamics 365:** don't read `Xrm.Page` until the form has rendered. Reading it during loading pins an empty form until the page reloads. Use `formReady` in `tests/e2e/lib/ce.mjs`.

## Unit tests

```powershell
pnpm test             # run them
pnpm test:report      # run them and save tests/results/unit-latest.md (and .json)
```

`unit/bc-query/al-compile.test.ts` compiles the generated AL and the companion app with `alc.exe` against Base Application symbols. It skips itself where they aren't installed; point it at them with `ALC_PATH` and `AL_SYMBOLS` (a `.alpackages` folder with System, System Application, Business Foundation, Base Application and Application).

## Live tests

They run in your browser, as you, through the companion's bridge, the way the query builder does. Read-only: they only query.

1. Start Chrome or Edge with remote debugging: `chrome.exe --remote-debugging-port=9333 --user-data-dir=<a test profile>`.
2. Sign in to Business Central and open **Dynamic Assist Query** (page 77500) in an environment with the companion installed. You need the DA QUERY permission set.
3. `pnpm test:live`

Results go to `tests/results/live-<date>-<time>.md` and `.json`, and `live-latest.md`. They hold counts, types and pass/fail, not record data. They do name your environment and table sizes, so `tests/results/` is git-ignored; share a report on purpose if you want to.

The suite checks correctness, not your data: a join reports its match rate (a sandbox can hold entries whose master record was deleted) but fails only when a joined row doesn't match its key.
