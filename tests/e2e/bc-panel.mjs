// Business Central: the side panel's tabs, on a real customer card and list.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"

/** Finds the frame running the web client, from the top frame. */
export const CLIENT = `(()=>{const seen=[];const walk=(w)=>{for(let i=0;i<w.frames.length;i++){try{const f=w.frames[i];if(f.document&&f.DN)seen.push(f);walk(f)}catch{}}};walk(window);return seen[0]||null})()`

export const bcUrl = (config, query = "") =>
  `https://businesscentral.dynamics.com/${config.bc.tenant}/${config.bc.environment}/?company=${encodeURIComponent(config.bc.company)}${query ? `&${query}` : ""}`

const GENERIC = /^(Dynamics 365 Business Central|Sign in.*)?$/

/** A BC page that has really opened: its window title names it. */
export async function bcLoaded(b, targetId, timeout = 45000) {
  return until(
    async () => {
      const t = (await b.targets()).find((x) => x.targetId === targetId)
      return t && !GENERIC.test(t.title) ? t.title : null
    },
    { timeout, every: 300, what: "Business Central to open the page" }
  )
}

/** The panel, connected to this BC tab and showing its page. */
export async function panelOnBc(p, tabTarget) {
  await p.front(tabTarget)
  await until(() => p.run(`!!e.tabEl('Page')&&!!e.label('Read the page again')`), { timeout: 30000, what: "the BC panel" })
  await until(() => p.run(`!/Waiting for Business Central to open a page/.test(e.text())`), { timeout: 30000, what: "the panel to read the page" })
}

export async function bcPanelTests({ b, p, run, config }) {
  const clientEval = (targetId, body) => b.evaluate(targetId, `(()=>{const w=${CLIENT};if(!w)return null;const d=w.document;return (${body})})()`)

  const card = await b.openTab(bcUrl(config, "page=21"))
  await p.front(card)
  await bcLoaded(b, card)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(card))
  await b.send("Browser.grantPermissions", { origin: "https://businesscentral.dynamics.com", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  await until(() => clientEval(card, `!!d`), { what: "the web client's frame", timeout: 30000 })

  const pageReady = async () => {
    await panelOnBc(p, card)
    await p.clickTab("Page")
    await until(() => p.run(`/Table/.test(e.text())&&!!e.section('Fields')`), { timeout: 30000, what: "the card's page details" })
  }
  const onTab = async (name) => {
    await pageReady()
    await p.clickTab(name)
    await sleep(200)
  }

  // ---- Environment bar ----------------------------------------------------------
  const bar = run.area("bc-environment-bar")
  await bar("detects Business Central and shows the environment and company", async () => {
    await pageReady()
    const text = await p.text()
    match(text, /Business Central/)
    ok(text.includes(config.bc.environment), "environment name isn't shown")
    ok(text.includes(config.bc.company), "company isn't shown")
    eq(await p.run(`document.documentElement.dataset.platform`), "bc", "platform")
  })
  await bar("Business Central admin center opens the tenant's admin page", async () => {
    await pageReady()
    const url = await p.opens(() => p.clickLabel("Business Central admin center"), { back: card })
    ok(url.endsWith("/admin"), `opened ${url}`)
  })
  await bar("Read the page again keeps the page details", async () => {
    await pageReady()
    await p.clickLabel("Read the page again")
    await sleep(800)
    match(await p.text(), /Table/)
  })

  // ---- Page tab -------------------------------------------------------------------
  const page = run.area("bc-page-tab")
  const pageSummary = await (async () => {
    await pageReady()
    return p.run(`e.text()`)
  })()
  await page("shows page 21, its table, type and caption", async () => {
    match(pageSummary, /21/)
    match(pageSummary, /Card/)
    match(pageSummary, /Customer/)
  })
  await page("Copy page ID", async () => {
    await pageReady()
    eq(await p.copied(() => p.clickLabel("Copy page ID 21")), "21", "clipboard")
    await p.toast(/Copied page ID 21/)
  })
  await page("Copy table ID", async () => {
    await pageReady()
    eq(await p.copied(() => p.clickLabel("Copy table ID 18")), "18", "clipboard")
  })
  for (const [label, pattern] of [
    ["Copy app", /[0-9a-f-]{36}/i],
    ["Copy primary key", /No\./],
    ["Copy systemid", /[0-9a-f-]{36}/i],
    ["Copy bookmark", /.{8}/],
  ])
    await page(`Detail: ${label}`, async () => {
      await pageReady()
      match(await p.copied(() => p.clickLabel(label)), pattern, "clipboard")
    })
  await page("Open this page in a new tab", async () => {
    await pageReady()
    match(await p.opens(() => p.clickLabel("Open this page in a new tab"), { back: card }), /[?&]page=21\b/, "URL")
  })
  await page("Open the table's data in a new tab", async () => {
    await pageReady()
    match(await p.opens(() => p.clickLabel("Open the table's data in a new tab"), { back: card }), /[?&]table=18\b/, "URL")
  })
  await page("Fields: section folds and unfolds", async () => {
    await pageReady()
    await p.closeSection("Fields")
    eq(await p.run(`document.querySelector('input[placeholder^="Search caption"]')===null`), true, "search hidden when folded")
    await p.openSection("Fields")
    await until(() => p.run(`!!document.querySelector('input[placeholder^="Search caption"]')`), { what: "the field search" })
  })
  await page("Fields: Copy JSON gives the fields as JSON", async () => {
    await pageReady()
    const json = await p.copied(() => p.clickButton("Copy JSON"))
    const parsed = JSON.parse(json)
    ok(Object.keys(parsed).length > 5, `only ${Object.keys(parsed).length} fields`)
    await p.toast(/Copied \d+ fields as JSON/)
  })
  const rowCount = () => p.run(`e.all('button[aria-expanded]').filter(b=>!b.closest('section>div:first-child')).length`)
  await page("Fields: search narrows the list", async () => {
    await pageReady()
    const before = await rowCount()
    await p.type('input[placeholder^="Search caption"]', "zzzz-nothing")
    await until(() => p.run(`/No fields match/.test(e.text())`), { what: "No fields match" })
    await p.type('input[placeholder^="Search caption"]', "")
    await until(async () => (await rowCount()) >= before, { what: "the list to come back" })
  })
  for (const chip of ["Has value", "Extensions", "FlowFields"])
    await page(`Fields: filter chip ${chip}`, async () => {
      await pageReady()
      await p.clickChip(chip)
      eq(await p.run(`e.chip(${JSON.stringify(chip)}).getAttribute('aria-checked')`), "true", "aria-checked")
      await p.clickChip(chip)
      eq(await p.run(`e.chip(${JSON.stringify(chip)}).getAttribute('aria-checked')`), "false", "aria-checked")
    })
  await page("Fields: Label or Name switch", async () => {
    await pageReady()
    await p.clickRadio("Name")
    await until(() => b.inWorker(`chrome.storage.local.get('ui.fieldNaming').then(s=>s['ui.fieldNaming'])`).then((v) => v === "name"), { what: "ui.fieldNaming to be name" })
    await p.clickRadio("Label")
  })
  await page("Fields: a row expands to its details", async () => {
    await pageReady()
    const clicked = await p.run(`(()=>{const r=e.all('button[aria-expanded]').find(b=>/No\\./.test(b.textContent)&&!b.querySelector('span.truncate.x'));if(!r)return false;r.click();return true})()`)
    ok(clicked, "no row with No. in it")
    await until(() => p.run(`/Schema name/.test(e.text())&&/Field no\\./.test(e.text())`), { what: "the row's details" })
  })
  await page("Fields: Copy schema name, Copy value, More ways to copy", async () => {
    await pageReady()
    const name = await p.copied(() => p.clickLabel("Copy schema name"))
    ok(name.length > 0, "empty name")
    await p.toast(/Copied schema name/)
    const menu = await p.run(`(()=>{const m=e.label('More ways to copy');if(!m)return false;e.fire(m);return true})()`)
    ok(menu, "no More ways to copy")
    await until(() => p.run(`e.all('[role=menu]').length>0`), { what: "the formats menu" })
    const items = await p.run(`e.all('[role=menuitem]').map(x=>e.norm(x.textContent))`)
    for (const want of ["AL reference", "API name", "OData name", "Field number", "Caption", "Name and value"])
      ok(items.some((i) => i.startsWith(want)), `no "${want}" in ${JSON.stringify(items)}`)
    const al = await p.copied(() => p.clickMenuItem("AL reference"))
    match(al, /^Rec\./, "AL reference")
  })
  await page("Fields: every other copy format", async () => {
    for (const [item, pattern] of [["API name", /\S/], ["OData name", /\S/], ["Field number", /^\d+$/], ["Caption", /\S/], ["Name and value", /\S/]]) {
      await pageReady()
      await p.run(`(()=>{e.fire(e.label('More ways to copy'));return 1})()`)
      await until(() => p.run(`e.all('[role=menu]').length>0`), { what: "the formats menu" })
      match(await p.copied(() => p.clickMenuItem(item), `${item} to be copied`), pattern, item)
    }
  })
  await page("Fields: FastTab groups fold", async () => {
    await pageReady()
    const group = await p.run(`(()=>{const g=e.all('button[aria-expanded]').filter(b=>/\\d+$/.test(e.norm(b.textContent))&&!/^Fields/.test(e.norm(b.textContent)));if(!g.length)return null;const x=g[0];const was=x.getAttribute('aria-expanded');x.click();return {name:e.norm(x.textContent),was}})()`)
    ok(group, "no FastTab groups listed")
    await sleep(150)
    ok(await p.run(`e.all('button[aria-expanded]').some(b=>e.norm(b.textContent)===${JSON.stringify(group.name)}&&b.getAttribute('aria-expanded')!==${JSON.stringify(group.was)})`), `${group.name} didn't toggle`)
  })

  // ---- Parts tab -------------------------------------------------------------------
  const parts = run.area("bc-parts-tab")
  // One section per part: its header, not the field rows inside it. Only in the tab on
  // show: as a background tab, the panel keeps the last tab's contents for a while
  const PART_HEADERS = `e.all('section>div>button[aria-expanded]',document.getElementById(e.all('[role=tab]').find((x)=>x.getAttribute('aria-selected')==='true').getAttribute('aria-controls')))`
  const openFirstPart = async () => {
    await onTab("Parts")
    await until(() => p.run(`${PART_HEADERS}.length>0`), { what: "the parts" })
    await p.run(`(()=>{const s=${PART_HEADERS}[0];if(s.getAttribute('aria-expanded')==='false')s.click();return 1})()`)
  }
  await parts("lists the page's parts", async () => {
    await onTab("Parts")
    await until(() => p.run(`${PART_HEADERS}.length>0`), { what: "the parts" })
    return `${await p.run(`${PART_HEADERS}.length`)} parts`
  })
  await parts("a part expands, with its fields and the open button", async () => {
    await openFirstPart()
    await until(() => p.run(`!!e.buttonStarts('Open page')`), { what: "Open page <id> on its own" })
  })
  await parts("Open page <id> on its own", async () => {
    await openFirstPart()
    await until(() => p.run(`!!e.buttonStarts('Open page')`), { what: "the button" })
    match(await p.opens(() => p.clickButtonStarts("Open page"), { back: card }), /[?&]page=\d+/, "URL")
  })
  await parts("Copy a part's page ID", async () => {
    await onTab("Parts")
    const label = await p.run(`e.all('[aria-label^="Copy page ID"]')[0]?.getAttribute('aria-label')`)
    ok(label, "no copy button")
    match(await p.copied(() => p.clickLabel(label)), /^\d+$/, "clipboard")
  })
  await parts("Copy a part's fields as JSON", async () => {
    await onTab("Parts")
    const found = await p.run(`(()=>{const b=e.all('button').find(x=>e.norm(x.textContent)==='Copy JSON');return !!b})()`)
    if (!found) return "no part on this page has fields to copy"
    JSON.parse(await p.copied(() => p.clickButton("Copy JSON")))
  })

  // ---- Tools tab -------------------------------------------------------------------
  const tools = run.area("bc-tools-tab")
  await tools("Field names: no companion known here, so no query page opens for it", async () => {
    await onTab("Tools")
    // What says the companion is here: nothing yet, as on a first visit
    await b.inWorker(`chrome.storage.local.get(null).then(all=>chrome.storage.local.remove(Object.keys(all).filter(k=>k.startsWith('bc:meta:')||k.startsWith('bc:apps:'))))`)
    const bcTabs = async () => (await b.pages()).filter((x) => x.url.startsWith("https://businesscentral.dynamics.com/")).length
    const before = await bcTabs()
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length>0`), { what: "field name badges", timeout: 30000 })
    await sleep(6000)
    eq(await bcTabs(), before, "Business Central tabs")
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length===0`), { what: "the badges to go" })
    return `${before} tabs before and after`
  }, { timeout: 90000 })
  await tools("Field names: on shows badges on the page, off removes them", async () => {
    await onTab("Tools")
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length>0`), { what: "field name badges", timeout: 30000 })
    const n = await clientEval(card, `d.querySelectorAll('.da-fieldname').length`)
    await p.toast(/Field names on|Reading extension names/, "the Field names message")
    await until(async () => (await onToolsPressed("Field names")) === "true", { what: "the tile to read on" })
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length===0`), { what: "the badges to go" })
    return `${n} badges`
  }, { timeout: 150000 })
  async function onToolsPressed(title) {
    return p.run(`e.tile(${JSON.stringify(title)})?.getAttribute('aria-pressed')`)
  }
  await tools("Field names: clicking a badge copies the name", async () => {
    await onTab("Tools")
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length>0`), { what: "badges" })
    const copied = await b.evaluate(card, `(async()=>{const w=${CLIENT};const x=w.document.querySelector('.da-fieldname');const want=x.textContent;await navigator.clipboard.writeText('mark');x.click();await new Promise(r=>setTimeout(r,500));return {want,got:await navigator.clipboard.readText(),flag:x.hasAttribute('data-copied')}})()`)
    ok(copied.want.includes(copied.got) && copied.got !== "mark", `badge "${copied.want}", clipboard "${copied.got}"`)
    await p.clickTile("Field names")
  })
  await tools("Field names: hovering a badge shows its card", async () => {
    await onTab("Tools")
    await p.clickTile("Field names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length>0`), { what: "badges" })
    await clientEval(card, `(()=>{const x=d.querySelector('.da-fieldname');x.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));x.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));return 1})()`)
    await until(() => clientEval(card, `/Click to copy/.test(d.getElementById('dynamic-assist-tip')?.textContent||'')`), { what: "the hover card", timeout: 6000 })
    await clientEval(card, `(()=>{const x=d.querySelector('.da-fieldname');x.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}));return 1})()`)
    await p.clickTile("Field names")
  })
  await tools("Blur data: on blurs the page, off restores it", async () => {
    await onTab("Tools")
    await p.clickTile("Blur data")
    await until(() => clientEval(card, `d.documentElement.classList.contains('da-blur')`), { what: "html.da-blur" })
    await p.toast(/Values blurred/)
    await p.clickTile("Blur data")
    await until(() => clientEval(card, `!d.documentElement.classList.contains('da-blur')`), { what: "blur to clear" })
    await p.toast(/Values shown/)
  })
  await tools("Expand FastTabs", async () => {
    await onTab("Tools")
    await p.clickTile("Expand FastTabs")
    await p.toast(/Opened \d+ FastTab|Every FastTab is already open/)
    await sleep(500)
    eq(await clientEval(card, `d.querySelectorAll('span.ms-nav-columns-caption[aria-expanded="false"]').length`), 0, "FastTabs still folded")
  })
  await tools("Copy record link gives a link to this record", async () => {
    await onTab("Tools")
    const link = await p.copied(() => p.clickTile("Copy record link"))
    match(link, /[?&]page=21&bookmark=/, "link")
    ok(link.includes(`company=${encodeURIComponent(config.bc.company)}`), "no company in the link")
    await p.toast(/Copied Record link/)
  })
  await tools("Record tiles are off on a list page", async () => {
    const list = await b.openTab(bcUrl(config, "page=22"))
    try {
      await bcLoaded(b, list)
      await panelOnBc(p, list)
      await p.clickTab("Tools")
      await until(() => p.hasTile("All fields"), { what: "the tiles" })
      // The panel reads the list's page a moment after it opens
      await until(async () => !(await p.tileState("Table data")).disabled, { what: "Table data to be available on a list", timeout: 25000 })
      for (const tile of ["Copy record link", "All fields", "Dynamics 365 record"])
        eq((await p.tileState(tile)).disabled, true, `${tile} is off`)
    } finally {
      await b.closeTab(list)
      await p.front(card)
    }
  })
  await tools("Table data opens the table", async () => {
    await onTab("Tools")
    match(await p.opens(() => p.clickTile("Table data"), { back: card }), /[?&]table=18\b/, "URL")
  })
  await tools("Dynamics 365 record: says what it finds", async () => {
    await onTab("Tools")
    await p.clickTile("Dynamics 365 record")
    // The answer, not "Opening the companion": that can take a while, and a coupled
    // record then opens in a tab of its own, which would catch the next test out
    const text = await until(async () => {
      const said = await p.run(`e.toast()`)
      return /isn't coupled|Coupled, but|Opened the coupled|Couldn't/.test(said) ? said : null
    }, { timeout: 150000, every: 100, what: "the coupling answer" })
    // A coupled record opens in Dynamics 365: not left lying around
    for (const opened of await b.pages())
      if (/pagetype=entityrecord/.test(opened.url)) await b.closeTab(opened.targetId)
    await p.front(card)
    return text
  }, { timeout: 180000 })

  // ---- Go to tab -------------------------------------------------------------------
  const goTo = run.area("bc-go-to-tab")
  await goTo("Open object: Page", async () => {
    await onTab("Go to")
    await p.type('input[aria-label="Object number"]', "22")
    await until(() => p.run(`!e.button('Open').disabled`), { what: "Open to enable" })
    match(await p.opens(() => p.clickButton("Open"), { back: card }), /[?&]page=22\b/, "URL")
  })
  await goTo("Open object: non-digits are stripped, and empty can't open", async () => {
    await onTab("Go to")
    // The panel can still be catching up with the last test closing its tab
    await until(() => p.run(`!!e.button('Open')`), { what: "the Go to tab", timeout: 15000 })
    eq(await p.run(`e.button('Open').disabled`), true, "Open with nothing typed")
    await p.type('input[aria-label="Object number"]', "2x2")
    eq(await p.run(`document.querySelector('input[aria-label="Object number"]').value`), "22", "stripped value")
  })
  for (const [kind, param, number] of [["Table", "table", "18"], ["Report", "report", "101"], ["Query", "query", "100"]])
    await goTo(`Open object: ${kind}`, async () => {
      await onTab("Go to")
      await p.run(`e.type(document.querySelector('select[aria-label="Object type"]'),${JSON.stringify(param === "table" ? "table" : param)})`)
      await sleep(100)
      const selected = await p.run(`document.querySelector('select[aria-label="Object type"]').value`)
      ok(selected.toLowerCase() === param, `select value ${selected}`)
      await p.type('input[aria-label="Object number"]', number)
      // Only requested, not opened: a report starts as soon as it opens
      const made = await p.recordsTab(() => p.clickButton("Open"))
      match(made.url, new RegExp(`[?&]${param}=${number}\\b`), "URL")
    })
  await goTo("My settings", async () => {
    await onTab("Go to")
    match(await p.opens(() => p.clickTile("My settings"), { back: card }), /[?&]page=9204\b/, "URL")
  })
  await goTo("My user", async () => {
    await onTab("Go to")
    await until(async () => !(await p.tileState("My user")).disabled, { what: "My user to enable" })
    const url = await p.opens(() => p.clickTile("My user"), { back: card })
    match(url, /[?&]page=9800\b/, "URL")
    match(decodeURIComponent(url), /filter=.*User Name/, "filter")
  })
  const SHORTCUTS = {
    Administration: [["Extensions", 2500], ["Users", 9800], ["Permission sets", 9802], ["Effective permissions", 9852], ["Entra applications", 9860], ["Feature management", 2610], ["Company", 1], ["Email accounts", 8887]],
    "Data and jobs": [["Job queue", 672], ["Change log", 595], ["Table information", 8700], ["Retention policies", 3903], ["Data administration", 9035], ["Configuration packages", 8615]],
    Developer: [["Performance profiler", 24], ["Event recorder", 9845], ["Event subscriptions", 9510], ["Web services", 810], ["Report layouts", 9660], ["Sessions", 670], ["Profiles (roles)", 9171], ["Assisted setup", 1801]],
    "Dynamic Assist": [["Query log", 77502]],
  }
  for (const [section, tiles] of Object.entries(SHORTCUTS))
    for (const [title, id] of tiles)
      await goTo(`${section}: ${title} opens page ${id}, and it loads`, async () => {
        await onTab("Go to")
        await p.openSection(section)
        await until(() => p.hasTile(title), { what: `the tile ${title}`, timeout: 6000 })
        const state = await p.tileState(title)
        ok(!state.disabled, `the tile is disabled`)
        // The panel starts again when BC rewrites the card's URL, and a click in
        // that moment is lost. One retry, and the result says if it was needed.
        let retried = false
        const tab = await b.newTabFrom(() => p.clickTile(title), { timeout: 4000 }).catch(() => {
          retried = true
          return b.newTabFrom(() => p.clickTile(title))
        })
        try {
          match(tab.url, new RegExp(`[?&]page=${id}\\b`), "URL")
          return `title: ${await bcLoaded(b, tab.targetId, 40000)}${retried ? " (needed a second click)" : ""}`
        } finally {
          await b.closeTab(tab.targetId)
          await p.front(card)
        }
      })

  // ---- Session tab -----------------------------------------------------------------
  const session = run.area("bc-session-tab")
  await session("You: shows you, and copies", async () => {
    await onTab("Session")
    await p.openSection("You")
    await until(() => p.run(`/user name/i.test(e.text())`), { what: "your details", timeout: 8000 })
    match(await p.copied(() => p.clickLabel("Copy user name")), /\S/, "user name")
    match(await p.copied(() => p.clickLabel("Copy user security id")), /[0-9a-f-]{36}/i, "user security id")
  })
  await session("Company: shows it, and copies its ID", async () => {
    await onTab("Session")
    await p.openSection("Company")
    ok((await p.text()).includes(config.bc.company), "company not shown")
    match(await p.copied(() => p.clickLabel("Copy id")), /[0-9a-f-]{36}/i, "company ID")
  })
  await session("Environment: shows it, and copies the tenant", async () => {
    await onTab("Session")
    await p.openSection("Environment")
    ok((await p.text()).includes(config.bc.environment), "environment not shown")
    match(await p.copied(() => p.clickLabel("Copy tenant")), /\S/, "tenant")
  })
  await session("Admin center tile", async () => {
    await onTab("Session")
    ok((await p.opens(() => p.clickTile("Admin center"), { back: card })).endsWith("/admin"), "not the admin page")
  })

  await b.closeTab(card)
}
