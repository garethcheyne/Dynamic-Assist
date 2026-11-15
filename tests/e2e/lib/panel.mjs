// The side panel, driven through the DOM. Chrome only opens the real side panel on
// a user gesture, so this is the same page in a background tab: its "active tab"
// is whichever tab the test brought to the front.
import { sleep, until } from "./browser.mjs"

const HELP = `(function(){ if (window.__e) return;
  const norm=(s)=>(s||'').replace(/\\s+/g,' ').trim();
  const all=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const fire=(el,init={})=>{for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])
    el.dispatchEvent(new (type.startsWith('pointer')?PointerEvent:MouseEvent)(type,{bubbles:true,cancelable:true,composed:true,button:0,pointerId:1,pointerType:'mouse',...init}))};
  window.__e={norm,all,fire,
    label:(l,i=0)=>all('[aria-label="'+CSS.escape(l).replace(/\\\\/g,'')+'"]').filter(x=>true)[i],
    tile:(t)=>all('button').find(b=>norm(b.querySelector('span.font-medium')?.textContent)===t),
    tabEl:(t)=>all('[role=tab]').find(x=>norm(x.textContent).startsWith(t)),
    // A section's header sits directly in the section; field rows are further in
    section:(t)=>{const heads=all('section>div>button[aria-expanded]');return heads.find(b=>norm(b.querySelector('span.truncate')?.textContent)===t)||heads.find(b=>norm(b.textContent).startsWith(t))},
    // Tabs are buttons too, and a tab and a button can share a name (Record)
    button:(t)=>all('button:not([role=tab])').find(b=>norm(b.textContent)===t),
    buttonStarts:(t)=>all('button:not([role=tab])').find(b=>norm(b.textContent).startsWith(t)),
    // Rows inside a section, without the sections' own headers
    rows:()=>{const heads=new Set(all('section>div>button[aria-expanded]'));return all('button[aria-expanded]').filter(b=>!heads.has(b))},
    chip:(t)=>all('[role=checkbox]').find(b=>norm(b.textContent).startsWith(t)),
    radio:(t)=>all('[role=radio]').find(b=>norm(b.textContent)===t),
    menuitem:(t)=>all('[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio]').find(b=>norm(b.textContent).startsWith(t)),
    type:(el,v)=>{const p=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}))},
    toast:()=>all('[aria-live="polite"]').map(x=>norm(x.textContent)).filter(Boolean).join(' / '),
    text:()=>norm(document.body.innerText),
  };
})();`

export async function makePanel(b) {
  const targetId = await b.openTab(b.extensionUrl("src/sidepanel/index.html"), { background: true })
  const sessionId = await b.session(targetId)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId)
  await b.send("Browser.grantPermissions", {
    origin: `chrome-extension://${b.extensionId}`,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  })

  const run = (body, options) => b.evaluate(targetId, `${HELP};(function(){const e=window.__e;return (${body})})()`, options)
  const clickBy = async (finder, what) => {
    const r = await run(`(()=>{const el=${finder};if(!el)return false;el.click();return true})()`)
    if (!r) throw new Error(`Couldn't find ${what}. The panel says: ${(await run(`e.text()`)).slice(0, 200)}`)
  }
  const q = JSON.stringify

  const p = {
    targetId,
    run,
    text: () => run(`e.text()`),
    /** A fresh start: the panel stays on whatever view the last test left it. */
    async reset() {
      await b.send("Page.reload", {}, sessionId)
      await until(() => run(`document.readyState==='complete'`), { what: "the panel to reload", timeout: 15000 })
    },
    /** The panel with this tab active; `wait` is what shows it has caught up. */
    async front(tabTarget) {
      p.current = tabTarget
      await b.send("Target.activateTarget", { targetId: tabTarget })
      await sleep(250)
    },
    clickLabel: (l, i = 0) => clickBy(`e.label(${q(l)},${i})`, `a button labelled "${l}"`),
    hasLabel: (l) => run(`!!e.label(${q(l)})`),
    /** A tile is off while busy or until the panel has read the page: a click then does nothing */
    async clickTile(t) {
      await until(() => run(`(()=>{const x=e.tile(${q(t)});return !!x&&x.getAttribute('aria-disabled')!=='true'})()`), { what: `the tile "${t}" to be available`, timeout: 15000, every: 100 })
      await clickBy(`e.tile(${q(t)})`, `the tile "${t}"`)
    },
    hasTile: (t) => run(`!!e.tile(${q(t)})`),
    /** Whether a tile is on (pressed), off, or disabled */
    tileState: (t) => run(`(()=>{const x=e.tile(${q(t)});return x?{pressed:x.getAttribute('aria-pressed'),disabled:x.getAttribute('aria-disabled')==='true'}:null})()`),
    async clickTab(t) {
      await clickBy(`e.tabEl(${q(t)})`, `the tab "${t}"`)
      await until(() => run(`e.tabEl(${q(t)})?.getAttribute('aria-selected')==='true'`), { what: `the tab "${t}" to open`, timeout: 5000 })
    },
    clickButton: (t) => clickBy(`e.button(${q(t)})`, `the button "${t}"`),
    clickButtonStarts: (t) => clickBy(`e.buttonStarts(${q(t)})`, `a button starting "${t}"`),
    hasButton: (t) => run(`!!e.button(${q(t)})`),
    clickChip: (t) => clickBy(`e.chip(${q(t)})`, `the chip "${t}"`),
    clickRadio: (t) => clickBy(`e.radio(${q(t)})`, `the radio "${t}"`),
    async openSection(t) {
      await until(() => run(`!!e.section(${q(t)})`), { what: `section "${t}"`, timeout: 8000 })
      await run(`(()=>{const s=e.section(${q(t)});if(s.getAttribute('aria-expanded')==='false')s.click();return 1})()`)
      await sleep(150)
    },
    async closeSection(t) {
      await run(`(()=>{const s=e.section(${q(t)});if(s&&s.getAttribute('aria-expanded')==='true')s.click();return 1})()`)
      await sleep(100)
    },
    /** Opens a menu by its trigger's label; menus need the full press sequence */
    async openMenu(label) {
      // One left open by a failed test would pass for this one, and hide its items
      if (await run(`e.all('[role=menu]').length>0`)) {
        await p.closeMenus()
        await until(() => run(`e.all('[role=menu]').length===0`), { what: "the open menu to close", timeout: 3000 })
      }
      await clickByFire(`e.label(${q(label)})`, `menu "${label}"`)
      await until(() => run(`e.all('[role=menu]').length>0`), { what: `the menu "${label}"`, timeout: 5000 })
    },
    clickMenuItem: (t) => clickByFire(`e.menuitem(${q(t)})`, `the menu item "${t}"`),
    closeMenus: () => run(`(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`),
    type: (selector, value) =>
      run(`(()=>{const el=document.querySelector(${q(selector)});if(!el)return false;e.type(el,${q(value)});return true})()`).then((r) => {
        if (!r) throw new Error(`No input matching ${selector}`)
      }),
    toast: (pattern, what = "the toast") =>
      until(async () => {
        const text = await run(`e.toast()`)
        return pattern.test(text) ? text : null
      }, { timeout: 12000, every: 100, what: `${what} to match ${pattern}` }),
    /** Runs a click and returns what it put on the clipboard. */
    async copied(action, what = "the clipboard to change") {
      const mark = `e2e-mark-${Date.now()}`
      await run(`navigator.clipboard.writeText(${q(mark)})`)
      await action()
      return until(
        async () => {
          const now = await run(`navigator.clipboard.readText()`)
          return now !== mark ? now : null
        },
        { timeout: 8000, every: 100, what }
      ).catch(async (error) => {
        // What the panel said instead, so a failure says why
        const said = await run(`e.toast()`).catch(() => "")
        throw new Error(`${error.message}; the panel said: ${said || "nothing"}`)
      })
    },
    /** Runs a click, returns the URL of the tab it opened, and closes the tab. */
    async opens(action, { back } = {}) {
      const tab = await b.newTabFrom(action)
      const url = tab.url
      await b.closeTab(tab.targetId)
      if (back) await p.front(back)
      return url
    },
    /** chrome.tabs.create recorded, not done: for what mustn't really open */
    async recordsTab(action) {
      await run(`(()=>{window.__real=chrome.tabs.create;window.__made=[];chrome.tabs.create=(o)=>{window.__made.push(o);return Promise.resolve({id:-1})};return 1})()`)
      try {
        await action()
        await until(() => run(`window.__made.length>0`), { what: "a tab to be requested", timeout: 6000 })
        return await run(`window.__made[0]`)
      } finally {
        await run(`(()=>{chrome.tabs.create=window.__real;return 1})()`)
      }
    },
  }
  const clickByFire = async (finder, what) => {
    const r = await run(`(()=>{const el=${finder};if(!el)return false;e.fire(el);return true})()`)
    if (!r) throw new Error(`Couldn't find ${what}. The panel says: ${(await run(`e.text()`)).slice(0, 200)}`)
  }
  return p
}
