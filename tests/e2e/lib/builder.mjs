// The query builder, in a page's shadow root. Same driving as tests/live/builder.live.js.
import { until } from "./browser.mjs"

const HELP = `(function(){ if (window.__q) return;
  const root=()=>document.getElementById('dynamic-assist-query')?.shadowRoot;
  const norm=(s)=>(s||'').replace(/\\s+/g,' ').trim();
  const wait=(ms)=>new Promise(res=>{const end=performance.now()+ms;const {port1,port2}=new MessageChannel();port1.onmessage=()=>performance.now()>=end?res():port2.postMessage(0);port2.postMessage(0)});
  const dialog=()=>[...(root()?.querySelectorAll('[role=dialog][aria-label="Query builder"]')||[])].find(d=>getComputedStyle(d).display!=='none'&&d.closest('[style*="display: none"]')===null);
  const within=()=>dialog()||root();
  const all=(sel)=>[...within().querySelectorAll(sel)];
  const until=async(test,ms=30000)=>{const s=Date.now();while(Date.now()-s<ms){const v=test();if(v)return v;await wait(120)}return null};
  const button=(t)=>all('button').find(b=>norm(b.textContent)===t);
  const starts=(t)=>all('button').find(b=>norm(b.textContent).startsWith(t));
  const label=(l)=>all('[aria-label="'+l+'"]')[0];
  const type=(el,v)=>{const p=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
  const choose=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('change',{bubbles:true}))};
  const pick=async(input,text)=>{if(!input)throw new Error('no picker for '+text);input.focus();input.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));await wait(100);type(input,text);await wait(350);const o=[...root().querySelectorAll('li[role="option"]')];const t=o.find(li=>norm(li.querySelector('span')?.textContent).toLowerCase()===text.toLowerCase())??o[0];if(!t)throw new Error('nothing matches '+text);t.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));await wait(150);const add=root().querySelector('[data-add-ticked]');if(add&&!add.disabled){add.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))}await wait(300)};
  const runEnabled=()=>{const b=button('Run');return b&&!b.disabled};
  const result=()=>({rows:all('tbody tr:not([aria-hidden])').length,
    headers:all('thead th').map(h=>norm(h.textContent)),
    cells:all('tbody tr:not([aria-hidden])').slice(0,3).map(r=>[...r.children].map(c=>norm(c.textContent))),
    status:all('span').map(s=>norm(s.textContent)).find(t=>/[\\d,]+ rows?.* · [\\d,]+ ms/.test(t))??'',
    empty:/No rows match/.test(within().textContent),
    error:(all('div').find(d=>d.className.includes&&d.className.includes('text-destructive')&&d.className.includes('border'))?.textContent??null)});
  window.__q={norm,root,dialog,within,all,button,starts,label,type,choose,pick,wait,until,result,
    open:()=>!!dialog(),
    text:()=>norm(within()?.textContent||'').replace(/@layer.*$/,'').slice(0,600),
    ready:()=>!!dialog()&&!!button('Run')&&!!starts('Saved')&&!!dialog().querySelector('input[aria-label="Table"]')&&!/Read the list of tables|Load the fields/.test(dialog().textContent.slice(0,1500)),
    loaded:()=>until(()=>!/Loading fields|Loading columns/.test(dialog().textContent)&&runEnabled(),60000),
    table:async(n)=>{await pick(label('Table'),n);await wait(300);await until(()=>!/Loading fields|Loading columns/.test(dialog().textContent)&&runEnabled(),60000);await wait(200);return 1},
    run:async(ms=120000)=>{await until(runEnabled,60000);const before=result().status;const r=button('Run');const t0=performance.now();r.click();await until(()=>r.disabled||!button('Run'),3000);await until(()=>button('Run')&&!button('Run').disabled,ms);await wait(250);return {...result(),ms:Math.round(performance.now()-t0),before}},
  };
})();`

/** Runs code in the page with the builder's helpers as `q`. */
export const inBuilder = (b, targetId, body, options) =>
  b.evaluate(targetId, `${HELP};(function(){const q=window.__q;return (${body})})()`, options)

export async function builderReady(b, targetId, { timeout = 150000, what = "the query builder" } = {}) {
  await until(() => inBuilder(b, targetId, `q.ready()`), { timeout, every: 300, what })
  // Everything else still works without its stylesheet, so nothing else would notice
  const position = await inBuilder(b, targetId, `getComputedStyle(q.dialog()).position`)
  if (position !== "fixed") throw new Error(`The query builder opened without its styles (its window is ${position}, not fixed)`)
  return true
}

/**
 * Hovers a builder button with the real mouse, then asks what's drawn on top in the
 * middle of its tooltip: being in the page isn't the same as being seen.
 */
export async function tooltipOf(b, targetId, button) {
  const spot = await inBuilder(b, targetId, `(()=>{const r=q.button(${JSON.stringify(button)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  const session = await b.session(targetId)
  const mouse = (x, y) => b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, session)
  await mouse(1, 1)
  await mouse(spot.x, spot.y)
  try {
    return await until(
      () => inBuilder(b, targetId, `(()=>{const t=q.root().querySelector('[data-slot=tooltip-content]');if(!t)return null;const r=t.getBoundingClientRect();const top=q.root().elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:q.norm(t.textContent),onTop:t.contains(top),height:Math.round(r.height)}})()`),
      { what: `the tooltip of ${button}`, timeout: 8000 }
    )
  } finally {
    await mouse(1, 1)
  }
}

export const closeBuilder = (b, targetId) =>
  inBuilder(b, targetId, `(()=>{const c=q.label('Close');if(c)c.click();return 1})()`).catch(() => undefined)
