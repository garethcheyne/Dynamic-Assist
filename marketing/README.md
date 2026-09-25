# Marketing images

Store promo tiles and the brochure, rendered from code, so they can be
edited and re-rendered whenever the UI changes.

```sh
npm run marketing        # build the extension, capture panels, render the tiles
npm run marketing:shots  # just the panel screenshots
npm run marketing:brochure  # capture, then the A4 brochure PDF
```

- `capture.mjs`: opens the real built side panel (`dist/`) in a headless
  Chrome of its own (a throwaway profile, no sign-ins) with the `chrome.*` APIs
  and the Dataverse Web API mocked, and screenshots each scene at 2x into
  `out/shots/{scene}-{light|dark}.png`.
- `lib/mock.mjs` and `fixtures/`: the demo data. Only fictitious names:
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
