// Business Central: the right-click menu. Chrome's own menu can't be scripted, so a
// test right-clicks the element (the page records what was under the mouse) and then
// fires the click event the menu would send, with the frame it would name. The menu
// handler and everything behind it are real; drawing the menu isn't covered.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { bcLoaded, bcUrl, CLIENT, panelOnBc } from "./bc-panel.mjs"
import { builderReady, closeBuilder, inBuilder } from "./lib/builder.mjs"

export async function bcMenuTests({ b, p, run, config }) {
  const t = run.area("bc-right-click")
  const clientEval = (targetId, body) => b.evaluate(targetId, `(()=>{const w=${CLIENT};if(!w)return null;const d=w.document;return (${body})})()`)

  const card = await b.openTab(bcUrl(config, "page=21"))
  await p.front(card)
  await bcLoaded(b, card)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(card))
  await b.send("Browser.grantPermissions", { origin: "https://businesscentral.dynamics.com", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  await until(() => clientEval(card, `!!d`), { what: "the web client's frame", timeout: 30000 })
  await panelOnBc(p, card)

  /** Fires a menu click on the active BC tab, naming the web client's frame. */
  const menu = (id, { selectionText, top = false } = {}) =>
    b.inWorker(`(async()=>{
      const [tab]=await chrome.tabs.query({active:true,url:'https://businesscentral.dynamics.com/*'});
      if(!tab)throw new Error('No active BC tab');
      const frames=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},world:'MAIN',func:()=>!!window.DN&&window!==top});
      const frameId=${top ? 0 : `(frames.find(f=>f.result)?.frameId??0)`};
      chrome.contextMenus.onClicked.dispatch({menuItemId:${JSON.stringify(id)},frameId,selectionText:${JSON.stringify(selectionText ?? null)}||undefined,editable:false,pageUrl:tab.url},tab);
      return frameId})()`)
  const note = (pattern, what = "the page's note") =>
    until(
      async () => {
        const text = await b.evaluate(card, `(()=>{const out=[];const walk=(w)=>{try{const n=w.document.getElementById('dynamic-assist-note');if(n)out.push(n.textContent);for(let i=0;i<w.frames.length;i++)walk(w.frames[i])}catch{}};walk(window);return out.join(' / ')})()`)
        return pattern.test(text) ? text : null
      },
      { timeout: 10000, every: 100, what: `${what} to match ${pattern}` }
    )
  /** Right-clicks the first element matching, in the web client's frame */
  const rightClick = (selector) =>
    // A real right-click focuses the frame, which is what lets the page copy
    clientEval(card, `(()=>{const el=d.querySelector(${JSON.stringify(selector)});if(!el)return false;w.focus();for(const type of ['mousedown','contextmenu'])el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,cancelable:true,button:2}));return true})()`)
  const FIELD = `[id$="lbl"]`
  const noteNow = (id) => b.evaluate(id, `(()=>{const out=[];const walk=(w)=>{try{const n=w.document.getElementById('dynamic-assist-note');if(n)out.push(n.textContent);for(let i=0;i<w.frames.length;i++)walk(w.frames[i])}catch{}};walk(window);return out.join(' / ')})()`)
  /** The page's own message is what says why a copy didn't happen */
  const copiedFromMenu = (id, tabId = card) =>
    p.copied(() => menu(id)).catch(async (error) => {
      throw new Error(`${error.message}. The page says: "${await noteNow(tabId)}"`)
    })

  await t("Copy field name, from a field's caption", async () => {
    ok(await rightClick(FIELD), "no field caption on the page")
    const name = await copiedFromMenu("bc-copy-name")
    ok(name.length > 0, "empty")
    await note(new RegExp(`Copied `))
    return name
  })
  await t("Copy field number", async () => {
    ok(await rightClick(FIELD), "no field caption on the page")
    match(await p.copied(() => menu("bc-copy-number")), /^\d+$/, "clipboard")
    await note(/Copied \d+ \(/)
  })
  await t("Copy field name says so when nothing's under the mouse", async () => {
    await rightClick("body")
    await menu("bc-copy-name")
    await note(/Right-click a field's caption or value, or a list column, first/)
  })
  await t("Field names on/off", async () => {
    await menu("bc-field-names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length>0`), { what: "badges" })
    await note(/Field names on/)
    await menu("bc-field-names")
    await until(() => clientEval(card, `d.querySelectorAll('.da-fieldname').length===0`), { what: "badges to go" })
    await note(/Field names off/)
  })
  await t("Field names from the menu doesn't open a query page", async () => {
    const before = (await b.pages()).length
    await menu("bc-field-names")
    await sleep(2500)
    eq((await b.pages()).length, before, "open tabs")
    await menu("bc-field-names")
  })
  await t("Blur data on/off", async () => {
    await menu("bc-blur")
    await until(() => clientEval(card, `d.documentElement.classList.contains('da-blur')`), { what: "blur" })
    await note(/Values blurred/)
    await menu("bc-blur")
    await until(() => clientEval(card, `!d.documentElement.classList.contains('da-blur')`), { what: "blur to clear" })
    await note(/Values shown/)
  })
  await t("Expand FastTabs", async () => {
    await menu("bc-expand")
    await note(/Opened \d+ FastTab|Every FastTab is already open/)
  })
  await t("Copy record link", async () => {
    match(await p.copied(() => menu("bc-record-link")), /[?&]page=21&bookmark=/, "clipboard")
    await note(/Copied the record link/)
  })
  await t("Open page %s, from a selected number", async () => {
    const tab = await b.newTabFrom(() => menu("bc-open-page", { selectionText: " 22 " }))
    await b.closeTab(tab.targetId)
    await p.front(card)
    match(tab.url, /[?&]page=22\b/, "URL")
  })
  await t("Open table %s, from a selected number", async () => {
    const tab = await b.newTabFrom(() => menu("bc-open-table", { selectionText: "18" }))
    await b.closeTab(tab.targetId)
    await p.front(card)
    match(tab.url, /[?&]table=18\b/, "URL")
  })
  await t("Open page %s refuses what isn't a number", async () => {
    await menu("bc-open-page", { selectionText: "hello" })
    await note(/Select an object number, not "hello"/)
  })
  await t("Microsoft links: a link opens", async () => {
    const tab = await b.newTabFrom(() => menu("link|bc|https://learn.microsoft.com/dynamics365/business-central/"))
    await b.closeTab(tab.targetId)
    await p.front(card)
    match(tab.url, /learn\.microsoft\.com/, "URL")
  })
  await t("Toolbar icon's menu: a link opens", async () => {
    const tab = await b.newTabFrom(() => menu("link|action|https://admin.microsoft.com/"))
    await b.closeTab(tab.targetId)
    await p.front(card)
    match(tab.url, /microsoft/, "URL")
  })
  t.skip("Menu items appear when you right-click", "Chrome's own menu can't be read or clicked by a script; check it by hand")
  // A query page already open: otherwise the builder's first run takes this tab there
  const queryPage = await b.openTab(bcUrl(config, "page=77500"), { background: true })
  await until(() => inBuilder(b, queryPage, `q.open()`).catch(() => false), { what: "the query page to be up", timeout: 90000 })
  await closeBuilder(b, queryPage)
  await p.front(card)
  await t("Query this table opens the builder on the table and runs", async () => {
    await menu("bc-query-table")
    await builderReady(b, card)
    const r = await until(async () => {
      const v = await inBuilder(b, card, `q.result()`)
      return v.status || v.error ? v : null
    }, { what: "the query to run", timeout: 60000 })
    ok(!r.error, `error: ${r.error}`)
    await closeBuilder(b, card)
    return r.status
  }, { timeout: 200000 })
  await t("All fields of this record opens the builder on the one record", async () => {
    await menu("bc-all-fields")
    await builderReady(b, card)
    const r = await until(async () => {
      const v = await inBuilder(b, card, `q.result()`)
      return v.status || v.error ? v : null
    }, { what: "the query to run", timeout: 60000 })
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /^1 row\b/, "row count")
    await closeBuilder(b, card)
  }, { timeout: 200000 })
  await b.closeTab(queryPage)

  // On a page with no record
  const list = await b.openTab(bcUrl(config, "page=22"))
  await bcLoaded(b, list)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(list))
  await panelOnBc(p, list)
  await until(() => p.run(`/Table/.test(e.text())`), { what: "the panel to read the list", timeout: 20000 })
  const noteOn = (targetId, pattern) =>
    until(
      async () => {
        const text = await b.evaluate(targetId, `(()=>{const out=[];const walk=(w)=>{try{const n=w.document.getElementById('dynamic-assist-note');if(n)out.push(n.textContent);for(let i=0;i<w.frames.length;i++)walk(w.frames[i])}catch{}};walk(window);return out.join(' / ')})()`)
        return pattern.test(text) ? text : null
      },
      { timeout: 10000, every: 100, what: `the note to match ${pattern}` }
    )
  await t("Copy field name, from a list column", async () => {
    const r = await clientEval(list, `(()=>{const el=d.querySelector('th[abbr]');if(!el)return null;w.focus();for(const type of ['mousedown','contextmenu'])el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,cancelable:true,button:2}));return el.getAttribute('abbr')})()`)
    ok(r, "no list column")
    const name = await copiedFromMenu("bc-copy-name", list)
    ok(name.length > 0, "empty")
    return `${r} → ${name}`
  })
  await t("Copy record link and All fields on a list say what's needed, or use the row", async () => {
    await menu("bc-record-link")
    return noteOn(list, /Copied the record link|Open a single record/)
  })
  await b.closeTab(list)
  await b.closeTab(card)
}
