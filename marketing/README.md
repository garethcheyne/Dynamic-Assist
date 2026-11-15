# Marketing images

Store promo tiles and the brochure, rendered from code, so they can be
edited and re-rendered whenever the UI changes.

```sh
pnpm marketing        # build the extension, capture panels, render the tiles
pnpm marketing:shots  # just the panel screenshots
pnpm marketing:brochure  # capture, then the A4 brochure PDF
pnpm marketing:videos    # every demo video, light and dark
```

- `videos.mjs`: short MP4 demos for the website and store listings, of the
  real built side panel and query builder. Scenes: `ce-builder` and `ce-sql`
  (the Dynamics 365 query builder), `ce-tour` (the panel on a record: search,
  filters, Logical names, Blur data, Go to), `flow-bulk` (turning a
  solution's flows on at once) and `bc-builder` (the Business Central query
  builder, through a stand-in companion app). `node marketing/videos.mjs
  flow-bulk` records one. Each plays on a stage
  (`stage/stage.html?product=ce|flow|bc`): a browser window with a made-up
  product page (`stage/ce-page.html`, `stage/flow-page.html`,
  `stage/bc-page.html`) and the panel beside it. What the panel does to the
  page shows there: Logical names and Blur data change the form, and a flow
  turned on changes in the portal's list. A script moves a drawn cursor, clicks
  and types, and shows a caption for each step. Chrome records the frames and
  `ffmpeg` (which must be installed) encodes them to
  `out/videos/{scene}-{light|dark}.mp4`, with a poster `.jpg` and a `.json`
  of when each step starts. `--probe` lists the builder's controls without
  recording. The website copies them in with `pnpm videos`.
- `lib/query-mock.mjs` and `fixtures/ce-query.json`: the builder's side of the
  stage. It stands in for the `chrome.*` calls the injected builder makes, and
  is a small Dataverse Web API that runs FetchXML and simple SQL against the
  demo data, so filters and sorting really work. Fictitious data only.
- `lib/bc-query-mock.mjs` and `fixtures/bc-query.json`: the same for the
  Business Central builder. It stands in for the companion app the builder
  reaches through the worker (info, tables, fields, query), and applies the
  query's conditions or BC filter expressions, sort and row limit to the demo
  customers. `--probe=bc` lists that builder's controls.

- `capture.mjs`: opens the real built side panel (`dist/`) in a headless
  Chrome of its own (a throwaway profile, no sign-ins) with the `chrome.*` APIs
  and the Dataverse Web API mocked, and screenshots each scene at 2x into
  `out/shots/{scene}-{light|dark}.png`.
- `lib/mock.mjs` and `fixtures/`: the demo data. Flows turned on or off stay
  that way (the SharePoint one won't turn on: its connection reference has no
  connection), the Dynamics 365 record is coupled to a CRONUS NZ customer, and
  Logical names and Blur data are kept in the page state. Only fictitious names:
  CRONUS, Contoso, Adventure Works (sample), invented flows and GUIDs. Never put
  real tenant, customer or user data here.
- `templates/promo.html`: the promo tile design (`?size=marquee|small`,
  `&panels=dark` for dark panels). Plain HTML and CSS; open it through the
  server in `lib/serve.mjs` to iterate.
- `build.mjs`: renders the tiles at the stores' exact sizes into
  `store/images/`.
- `templates/brochure.html` and `brochure.mjs`: the 8-page A4 brochure, printed
  to `out/dynamic-assist-brochure.pdf` with a PNG of each page in
  `out/brochure/`. `--theme=dark` uses the dark panels. It leaves out any shot
  with the Microsoft Entra icon (home-bottom, launcher-bottom): its icon terms
  don't allow marketing use.
