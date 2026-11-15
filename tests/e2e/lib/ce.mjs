// Dynamics 365 helpers. Anything this suite writes to Dataverse goes through here,
// is an account whose name starts with PREFIX, and is deleted again afterwards.
import { sleep, until } from "./browser.mjs"

export const PREFIX = "DA E2E test"

export const listUrl = (config, entity = "account") => `${config.ce.org}/main.aspx?pagetype=entitylist&etn=${entity}`
export const formUrl = (config, id, entity = "account") => `${config.ce.org}/main.aspx?pagetype=entityrecord&etn=${entity}&id=${id}`
export const newFormUrl = (config, entity = "account") => `${config.ce.org}/main.aspx?pagetype=entityrecord&etn=${entity}`

/**
 * Someone to impersonate: an enabled person, not you, with a role of their own and
 * no System Administrator, directly or through a team. Null if there's nobody. It
 * goes by their email and is never written to a report.
 */
export const nonAdminUser = (b, targetId) =>
  b.evaluate(
    targetId,
    `(async()=>{
      const ADMIN='627090ff-40a3-4053-8790-584edc5be201';
      const ctx=Xrm.Utility.getGlobalContext();
      const me=ctx.userSettings.userId.replace(/[{}]/g,'').toLowerCase();
      const api=ctx.getClientUrl()+'/api/data/v9.2/';
      const get=async(p)=>{const r=await fetch(api+p,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error(p+': '+r.status);return r.json()};
      const isAdmin=(r)=>(r._roletemplateid_value||'').toLowerCase()===ADMIN;
      const users=(await get("systemusers?$select=fullname,domainname&$filter=isdisabled eq false and accessmode eq 0 and applicationid eq null and domainname ne ''&$expand=systemuserroles_association($select=_roletemplateid_value),teammembership_association($select=teamid)&$top=200")).value;
      for(const u of users){
        if(u.systemuserid.toLowerCase()===me||!u.systemuserroles_association.length||u.systemuserroles_association.some(isAdmin))continue;
        const teams=await Promise.all(u.teammembership_association.map((t)=>get('teams('+t.teamid+')/teamroles_association?$select=_roletemplateid_value')));
        if(teams.some((t)=>t.value.some(isAdmin)))continue;
        return {id:u.systemuserid.toLowerCase(),search:u.domainname};
      }
      return null;
    })()`,
    { timeout: 60000 }
  )

/**
 * Who Dataverse is running these requests as. Not WhoAmI, which names the signed-in
 * user whatever MSCRMCallerID says: "the current user" in a filter follows it.
 */
export const whoAmI = (b, targetId) =>
  b.evaluate(
    targetId,
    `fetch(Xrm.Utility.getGlobalContext().getClientUrl()+"/api/data/v9.2/systemusers?$select=systemuserid&$filter=Microsoft.Dynamics.CRM.EqualUserId(PropertyName='systemuserid')",{cache:'no-store',headers:{Accept:'application/json'}}).then(r=>r.json()).then(r=>(r.value?.[0]?.systemuserid||'').toLowerCase())`,
    { timeout: 30000 }
  )

/** The model-driven app has loaded in this tab. */
export const xrmReady = (b, targetId, timeout = 60000) =>
  until(() => b.evaluate(targetId, `typeof Xrm!=='undefined'&&!!Xrm.Utility?.getGlobalContext&&!!Xrm.Utility.getGlobalContext().getClientUrl`).catch(() => false), {
    timeout,
    every: 500,
    what: "Dynamics 365 to load",
  })

/** The form has loaded, with its attributes. */
// Not Xrm.Page until the form has rendered: reading it during loading pins an
// empty form (see formHasRendered in src/platforms/ce/main-world.ts)
const RENDERED = `!!document.querySelector('[role=tablist] [role=tab][data-id^="tablist-"], label[id$="-field-label"]')`

export const formReady = (b, targetId, timeout = 60000) =>
  until(() => b.evaluate(targetId, `${RENDERED}&&typeof Xrm!=='undefined'&&!!Xrm.Page?.data?.entity&&Xrm.Page.data.entity.attributes.get().length>0`, { timeout: 8000 }).catch(() => false), {
    timeout,
    every: 500,
    what: "the form to load",
  }).catch(async (error) => {
    // What the tab shows instead is the useful part
    const seen = await b
      .evaluate(targetId, `JSON.stringify({title:document.title.slice(0,60),visibility:document.visibilityState,focus:document.hasFocus(),xrmPage:typeof Xrm==='undefined'?'no Xrm':typeof Xrm.Page,data:typeof Xrm==='undefined'?0:typeof Xrm.Page?.data,entity:typeof Xrm==='undefined'?0:typeof Xrm.Page?.data?.entity,attrs:(()=>{try{return Xrm.Page.data.entity.attributes.get().length}catch(e){return 'threw: '+e.message}})(),page:(()=>{try{return Xrm.Utility.getPageContext().input.pageType}catch(e){return 'none'}})(),dialogs:[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map(d=>d.innerText.slice(0,120))})`, { timeout: 8000 })
      .catch((e) => `the page didn't answer: ${e.message}`)
    throw new Error(`${error.message}. The tab: ${seen}`)
  })

export const listReady = (b, targetId, timeout = 60000) =>
  until(() => b.evaluate(targetId, `!!document.querySelector('.ag-root-wrapper,[role=grid]')`).catch(() => false), {
    timeout,
    every: 500,
    what: "the list to load",
  })

const api = (path) => `Xrm.Utility.getGlobalContext().getClientUrl()+${JSON.stringify(`/api/data/v9.2/${path}`)}`
const HEADERS = `{'Content-Type':'application/json','OData-Version':'4.0','OData-MaxVersion':'4.0',Accept:'application/json'}`

/** Reads through the page's session. */
export const apiGet = (b, targetId, path) =>
  b.evaluate(targetId, `fetch(${api(path)},{credentials:'include',headers:${HEADERS}}).then(async r=>{if(!r.ok)throw new Error('GET '+r.status+' '+(await r.text()).slice(0,200));return r.json()})`)

export async function createThrowaway(b, targetId, suffix) {
  const name = `${PREFIX} ${suffix}`
  const id = await b.evaluate(
    targetId,
    `fetch(${api("accounts")},{method:'POST',credentials:'include',headers:${HEADERS},body:JSON.stringify({name:${JSON.stringify(name)},description:'Created by the Dynamic Assist browser tests. Safe to delete.'})}).then(async r=>{if(!r.ok)throw new Error('POST '+r.status+' '+(await r.text()).slice(0,200));return (r.headers.get('OData-EntityId')||'').match(/\\(([^)]+)\\)/)[1]})`
  )
  return { id, name }
}

async function retry(work, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await work()
    } catch (error) {
      if (i >= tries) throw error
      await sleep(2000)
    }
  }
}

/** Deletes every account this suite made, and only those: exact prefix, by ID. */
export async function deleteThrowaways(b, targetId) {
  const found = await apiGet(b, targetId, `accounts?$select=accountid,name&$filter=${encodeURIComponent(`startswith(name,'${PREFIX}')`)}&$top=50`)
  let deleted = 0
  for (const row of found.value) {
    if (!row.name?.startsWith(PREFIX)) continue
    // Dynamics 365 now and then answers a delete with a 500, then takes the same
    // delete moments later: try twice more before reporting it
    await retry(() => b.evaluate(targetId, `fetch(${api(`accounts(${row.accountid})`)},{method:'DELETE',credentials:'include',headers:${HEADERS}}).then(async r=>{if(!r.ok&&r.status!==404)throw new Error('DELETE '+r.status+' '+(await r.text()).slice(0,300));return 1})`))
    deleted++
  }
  return deleted
}

/**
 * Throws away a form's unsaved edits, the way a person does: refreshing makes
 * Dynamics 365 ask, and this answers Discard.
 */
export async function discardEdits(b, targetId) {
  await b.evaluate(targetId, `(Xrm.Page.data.refresh(false),1)`)
  await answerDiscard(b, targetId)
}

export async function answerDiscard(b, targetId) {
  await until(
    () => b.evaluate(targetId, `(()=>{const x=[...document.querySelectorAll('[role=dialog] button,[role=alertdialog] button')].find(y=>/Discard changes/.test(y.textContent));if(!x)return false;x.click();return true})()`),
    { what: "Dynamics 365's unsaved changes dialog", timeout: 10000 }
  )
  await sleep(500)
  await formReady(b, targetId)
  await until(() => b.evaluate(targetId, `!Xrm.Page.data.entity.getIsDirty()`), { what: "the form to be clean", timeout: 15000 })
}

export async function panelOnCe(p, tabTarget, timeout = 60000) {
  await p.front(tabTarget)
  await until(() => p.run(`!!e.tabEl('Record')&&!!e.tabEl('Tools')&&!!e.label('Read the page again')`), { timeout, what: "the Dynamics 365 panel" })
  await sleep(150)
}
