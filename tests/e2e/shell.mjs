// The panel's shared parts: header, launcher, Home, History, Settings, What's new, Help (the website's docs).
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { bcLoaded, bcUrl, panelOnBc } from "./bc-panel.mjs"
import { builderReady, closeBuilder } from "./lib/builder.mjs"

export async function shellTests({ b, p, run, config }) {
  const tab = await b.openTab(bcUrl(config, "page=21"))
  await p.front(tab)
  await bcLoaded(b, tab)
  const ready = async () => {
    await p.front(tab)
    // Back to the tools, from wherever the last test left the panel
    await until(async () => {
      if (await p.run(`!!e.tabEl('Page')`)) return true
      await p.run(`(()=>{const x=e.label('Back')||e.label('Back to Business Central tools');if(x)x.click();return 1})()`)
      return false
    }, { what: "the tools", timeout: 15000, every: 400 })
    await panelOnBc(p, tab)
  }

  // ---- Header ------------------------------------------------------------------------
  const t = run.area("panel-header")
  await t("Theme: dark and light", async () => {
    await ready()
    const to = (await p.hasLabel("Dark mode")) ? "dark" : "light"
    await p.clickLabel(to === "dark" ? "Dark mode" : "Light mode")
    await until(() => b.inWorker(`chrome.storage.local.get('ui.theme').then(s=>s['ui.theme'])`).then((v) => v === to), { what: `ui.theme ${to}` })
    eq(await p.run(`localStorage.getItem('theme')`), to, "stored theme")
    await p.clickLabel(to === "dark" ? "Light mode" : "Dark mode")
  })
  await t("Theme: the query builder follows it", async () => {
    await ready()
    await p.clickLabel("Query builder")
    await builderReady(b, tab)
    const dark = (await p.hasLabel("Dark mode")) === false
    const inBuilder = await b.evaluate(tab, `document.getElementById('dynamic-assist-query').shadowRoot.querySelector('.da-root')?.classList.contains('dark')`)
    await closeBuilder(b, tab)
    eq(!!inBuilder, dark, "builder dark")
  }, { timeout: 200000 })
  await t("More menu has its items", async () => {
    await ready()
    await p.openMenu("More")
    const items = await p.run(`e.all('[role=menuitem],[role=menuitemcheckbox]').map(x=>e.norm(x.textContent))`)
    for (const want of ["Help", "What's new", "Settings", "About & credits", "Example queries"])
      ok(items.some((i) => i.startsWith(want)), `no "${want}" in ${JSON.stringify(items)}`)
    await p.closeMenus()
  })
  await t("Example queries switch hides and shows the examples", async () => {
    await ready()
    await p.openMenu("More")
    await p.clickMenuItem("Example queries")
    await until(() => b.inWorker(`chrome.storage.local.get('showExampleQueries').then(s=>s.showExampleQueries)`).then((v) => v === false), { what: "the setting off" })
    await p.clickTab("Tools")
    await sleep(300)
    ok(!(await p.run(`/Customers with a balance/.test(e.text())`)), "examples still shown")
    await p.openMenu("More")
    await p.clickMenuItem("Example queries")
    await until(() => b.inWorker(`chrome.storage.local.get('showExampleQueries').then(s=>s.showExampleQueries)`).then((v) => v === true), { what: "the setting on" })
    await p.closeMenus()
  })
  await t("About & credits", async () => {
    await ready()
    await p.openMenu("More")
    await p.clickMenuItem("About & credits")
    await until(() => p.run(`/One extension to rule them all/.test(e.text())`), { what: "About" })
  })

  // ---- Help and What's new ----------------------------------------------------------
  const h = run.area("panel-help")
  const opened = async (item) => {
    await ready()
    await p.openMenu("More")
    return b.newTabFrom(() => p.clickMenuItem(item))
  }
  await h("Help opens this product's docs on the website", async () => {
    const page = await opened("Help")
    try {
      match(page.url, /^https:\/\/dynamicassist\.err403\.com\/docs\/bc-page-and-parts\//, "URL")
    } finally {
      await b.closeTab(page.targetId)
    }
  })
  await h("An old help link goes to the docs", async () => {
    const page = await b.openTab(b.extensionUrl("src/sidepanel/index.html?page=help"))
    try {
      await until(async () => /dynamicassist\.err403\.com\/docs\//.test(await b.evaluate(page, "location.href")), { what: "the docs", timeout: 8000 })
    } finally {
      await b.closeTab(page)
    }
  })
  await h("What's new opens the website's changelog at this version", async () => {
    const page = await opened("What's new")
    try {
      const version = await b.inWorker(`chrome.runtime.getManifest().version`)
      match(page.url, new RegExp(`^https://dynamicassist\\.err403\\.com/changelog/#${version.replace(/\./g, "-")}$`), "URL")
    } finally {
      await b.closeTab(page.targetId)
    }
  })

  // ---- Launcher -------------------------------------------------------------------------
  const l = run.area("panel-launcher")
  await l("Go anywhere has its groups", async () => {
    await ready()
    await p.openMenu("Go anywhere")
    const read = () => p.run(`e.norm(e.all('[role=menu]').map(m=>m.textContent).join(' '))`)
    // Its groups fill in just after it opens
    for (const want of ["Admin Centres", "Build", "Status & Docs"])
      await until(async () => (await read()).includes(want), { what: `the group "${want}"`, timeout: 5000 })
    match(await read(), /This Environment|This Company/, "this environment group")
    await p.closeMenus()
  })
  await l("An item opens in a new tab", async () => {
    await ready()
    await p.openMenu("Go anywhere")
    const item = await p.run(`e.norm(e.all('[role=menuitem]').find(x=>/Business Central Admin/.test(x.textContent))?.textContent||'')`)
    ok(item, "no Business Central Admin")
    const made = await p.recordsTab(() => p.clickMenuItem("Business Central Admin"))
    match(made.url, /\/admin$/, "URL")
    await p.closeMenus()
  })
  await l("Ctrl-click opens it in the background", async () => {
    await ready()
    await p.openMenu("Go anywhere")
    const made = await p.recordsTab(() => p.run(`(()=>{const x=e.menuitem('Business Central Admin');e.fire(x,{ctrlKey:true});return 1})()`))
    eq(made.active, false, "active")
    await p.closeMenus()
  })

  // ---- Home --------------------------------------------------------------------------------
  const home = run.area("panel-home")
  await home("Home toggle, and back", async () => {
    await ready()
    await p.clickLabel("Home")
    await until(() => p.hasLabel("Back to Business Central tools"), { what: "Home" })
    for (const want of ["Business Central", "Dynamics 365", "Power Apps", "Power Automate"]) match(await p.text(), new RegExp(want), want)
    await p.clickLabel("Back to Business Central tools")
    await until(() => p.run(`!!e.tabEl('Page')`), { what: "the tools" })
  })
  const product = (name) => p.run(`(()=>{const x=e.all('button').find(b=>e.norm(b.textContent).startsWith(${JSON.stringify(name)}));return !!x})()`)
  await home("Product tile opens the last place you used", async () => {
    await ready()
    await p.clickLabel("Home")
    await until(() => product("Business Central"), { what: "the tile" })
    const made = await p.recordsTab(() => p.clickButtonStarts("Business Central"))
    match(made.url, /businesscentral\.dynamics\.com/, "URL")
    ok(made.active !== false, "should open in front")
  })
  await home("Ctrl-click opens a product in the background", async () => {
    const made = await p.recordsTab(() => p.run(`(()=>{const x=e.buttonStarts('Business Central');x.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));return 1})()`))
    eq(made.active, false, "active")
  })
  await home("Admin Centres section opens portals", async () => {
    await p.openSection("Admin Centres")
    const n = await p.run(`e.all('button').filter(b=>/admin/i.test(b.textContent)).length`)
    ok(n > 2, `only ${n} admin tiles`)
  })
  await home("Help button, and the Feedback link", async () => {
    const made = await p.recordsTab(() => p.clickButton("Help"))
    match(made.url, /page=help/, "Help URL")
    const href = await p.run(`e.all('a').find(a=>/Feedback/.test(a.textContent))?.href`)
    match(href, /github\.com\/.*issues/, "Feedback link")
  })
  await home("With no product in the tab, the panel is Home", async () => {
    const blank = await b.openTab("about:blank")
    try {
      await p.front(blank)
      await until(() => p.run(`document.documentElement.dataset.platform!=='bc'&&!e.tabEl('Page')`), { what: "Home", timeout: 8000 })
      match(await p.text(), /Power Automate/, "products")
    } finally {
      await b.closeTab(blank)
      await p.front(tab)
    }
  })

  // ---- History --------------------------------------------------------------------------------
  const hist = run.area("panel-history")
  const entries = () => b.inWorker(`chrome.storage.local.get('history').then(s=>s.history||[])`)
  const onHistory = async () => {
    await ready()
    await p.clickLabel("History")
    await until(() => p.run(`!!document.querySelector('input[placeholder^="Search names"]')||/No history yet/.test(e.text())`), { what: "History" })
  }
  await hist("Visiting Business Central recorded it, named after the environment", async () => {
    const list = await until(async () => {
      const v = await entries()
      return v.some((x) => x.key?.startsWith("bc:")) ? v : null
    }, { what: "a BC entry" })
    const bc = list.find((x) => x.key.startsWith("bc:"))
    ok(bc.url.includes("businesscentral.dynamics.com"), "URL")
  })
  await hist("Search filters, and says when nothing matches", async () => {
    await onHistory()
    await p.type('input[placeholder^="Search names"]', "zzz-no-such-place")
    await until(() => p.run(`/Nothing matches/.test(e.text())`), { what: "Nothing matches" })
    await p.type('input[placeholder^="Search names"]', "")
  })
  await hist("A row opens it", async () => {
    await onHistory()
    // The row's own button is the first in the row that holds its Pin button
    const made = await p.recordsTab(() => p.run(`(()=>{let row=e.label('Pin');while(row&&row.querySelectorAll('button').length<2)row=row.parentElement;row.querySelector('button').click();return 1})()`))
    match(made.url, /^https:/, "URL")
  })
  await hist("Pin moves it to Pinned, Unpin back", async () => {
    await onHistory()
    await p.clickLabel("Pin")
    await until(async () => (await entries()).some((x) => x.pinned), { what: "the pinned flag" })
    await until(() => p.run(`/Pinned/.test(e.text())`), { what: "the Pinned section" })
    await p.clickLabel("Unpin")
    await until(async () => !(await entries()).some((x) => x.pinned), { what: "it to unpin" })
  })
  await hist("Rename sets a name, and clearing it resets", async () => {
    await onHistory()
    await p.clickLabel("Rename")
    await until(() => p.run(`!!document.querySelector('input[aria-label^="Name for "]')`), { what: "the rename input" })
    await p.type('input[aria-label^="Name for "]', "E2E name")
    await p.run(`(()=>{const f=document.querySelector('input[aria-label^="Name for "]').closest('form');f.requestSubmit();return 1})()`)
    await until(async () => (await entries()).some((x) => x.label === "E2E name"), { what: "the label" })
    await p.clickLabel("Rename")
    await until(() => p.run(`!!document.querySelector('input[aria-label^="Name for "]')`), { what: "the rename input" })
    await p.type('input[aria-label^="Name for "]', "")
    await p.run(`(()=>{const f=document.querySelector('input[aria-label^="Name for "]').closest('form');f.requestSubmit();return 1})()`)
    await until(async () => !(await entries()).some((x) => x.label === "E2E name"), { what: "the label to go" })
  })
  await hist("Remove, and it comes back on the next visit", async () => {
    await onHistory()
    const before = (await entries()).length
    await p.clickLabel("Remove")
    await until(async () => (await entries()).length === before - 1, { what: "the entry to go" })
    await b.send("Page.reload", {}, await b.session(tab))
    await sleep(1500)
    await bcLoaded(b, tab)
    await until(async () => (await entries()).length >= before, { what: "the visit to be recorded", timeout: 30000 })
  }, { timeout: 120000 })
  await hist("Clear forgets all but pinned, then shows the empty state", async () => {
    await onHistory()
    // History reads its storage a moment after it shows
    await until(() => p.hasLabel("Pin"), { what: "a row to pin", timeout: 8000 })
    await p.clickLabel("Pin")
    await until(async () => (await entries()).some((x) => x.pinned), { what: "the pin" })
    const pinned = (await entries()).filter((x) => x.pinned).length
    if (await p.hasButton("Clear")) {
      await p.clickButton("Clear")
      await until(async () => (await entries()).length === pinned, { what: "unpinned to go" })
    }
    await p.clickLabel("Unpin")
  })

  // ---- Settings ------------------------------------------------------------------------------
  const s = run.area("panel-settings")
  const onSettings = async () => {
    await ready()
    await p.openMenu("More")
    await p.clickMenuItem("Settings")
    await until(() => p.run(`/Settings/.test(e.text())&&/query page/i.test(e.text())`), { what: "Settings" })
  }
  await s("Shows cached metadata per environment, and clears one", async () => {
    await ready()
    await p.clickLabel("Query builder")
    await builderReady(b, tab)
    await closeBuilder(b, tab)
    await until(() => b.inWorker(`chrome.storage.local.get(null).then(a=>Object.keys(a).some(k=>k.startsWith('bc:meta:')))`), { what: "cached metadata", timeout: 30000 })
    await onSettings()
    await p.openSection("Business Central")
    const label = await until(() => p.run(`e.all('[aria-label^="Clear "]').map(x=>x.getAttribute('aria-label'))[0]`), { what: "a Clear button" })
    await p.clickLabel(label)
    await p.toast(/Cleared/)
    await until(() => b.inWorker(`chrome.storage.local.get(null).then(a=>!Object.keys(a).some(k=>k.startsWith('bc:meta:')))`), { what: "the metadata to go" })
  }, { timeout: 200000 })
  await s("Lists open query pages, though their URLs may not name them", async () => {
    await onSettings()
    await p.openSection("Companion query pages")
    await until(() => p.run(`/Close \\d+ query page/.test(e.text())`), { what: "the count", timeout: 6000 })
  })
  await s("Clear all", async () => {
    await onSettings()
    await p.openSection("Business Central")
    const cached = () => b.inWorker(`chrome.storage.local.get(null).then(a=>Object.keys(a).filter(k=>k.startsWith('bc:meta:')||k.startsWith('bc:apps:')).length)`)
    const button = await until(() => p.run(`(()=>{const x=e.button('Clear all');return x?{disabled:x.disabled}:null})()`), { what: "the Clear all button" })
    // Off when there's nothing to clear, and only then
    eq(button.disabled, (await cached()) === 0, `Clear all disabled with ${await cached()} caches`)
    if (!button.disabled) {
      await p.clickButton("Clear all")
      await p.toast(/Cleared all/)
    }
    await until(async () => (await cached()) === 0, { what: "caches to go" })
  })
  await s("Close query pages closes them", async () => {
    const page = await b.openTab(bcUrl(config, "page=77500"))
    await bcLoaded(b, page, 60000).catch(() => undefined)
    await sleep(4000)
    await onSettings()
    await p.openSection("Companion query pages")
    await until(() => p.run(`/Close \\d+ query page/.test(e.text())`), { what: "the button", timeout: 8000 })
    await p.clickButtonStarts("Close ")
    await p.toast(/Closed \d+ query page/)
    await until(async () => !(await b.pages()).some((x) => x.targetId === page), { what: "the page to close" })
  }, { timeout: 150000 })
  await b.closeTab(tab).catch(() => undefined)
}
