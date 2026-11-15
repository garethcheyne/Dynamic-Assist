// Power Automate and Power Apps panels. Turning flows on and off is never done:
// bulk stops at its confirm and cancels; the single flow's toggle has no confirm,
// so it's a skip with its reason.
import { sleep, until } from "./lib/browser.mjs"
import { match, ok } from "./lib/harness.mjs"
import { apiGet, listUrl, panelOnCe, xrmReady } from "./lib/ce.mjs"

export async function flowTests({ b, p, run, config }) {
  // The Dynamics app first: its panel is what records the org for these two
  const org = await b.openTab(listUrl(config))
  await p.front(org)
  await xrmReady(b, org)
  await panelOnCe(p, org)
  await sleep(1500)
  const env = await until(async () => {
    const history = await b.inWorker(`chrome.storage.local.get('history').then(s=>s.history||[])`)
    return history.find((h) => h.environmentId)?.environmentId
  }, { what: "the org's environment ID in History", timeout: 30000 })
  const anySolution = await apiGet(b, org, `solutions?$select=solutionid,friendlyname&$filter=${encodeURIComponent("ismanaged eq false and isvisible eq true and uniquename ne 'Default'")}&$top=1`).catch(() => ({ value: [] }))
  const solution = anySolution.value[0]?.solutionid

  const flowHost = `https://make.powerautomate.com/environments/${env}`
  const makerHost = `https://make.powerapps.com/environments/${env}`

  // ---- Power Automate --------------------------------------------------------------
  const t = run.area("flow-panel")
  const flowTab = await b.openTab(`${flowHost}/solutions`)
  await p.front(flowTab)
  // The portal rewrites its URL as it loads, and the panel starts again each time
  const settled = async () => {
    let last = ""
    let since = Date.now()
    await until(async () => {
      const now = (await b.targets()).find((x) => x.targetId === flowTab)?.url
      if (now !== last) {
        last = now
        since = Date.now()
      }
      return Date.now() - since > 3000
    }, { what: "the portal to settle", timeout: 40000, every: 300 })
  }
  const ready = async () => {
    await p.front(flowTab)
    await until(() => p.run(`document.documentElement.dataset.platform==='flow'`), { what: "the Power Automate panel", timeout: 60000 })
    await settled()
    await until(() => p.run(`/Cloud flows|Flows in this solution|Couldn't find this environment/.test(e.text())`), { what: "the flow tools", timeout: 60000 })
  }
  await t("Detects Power Automate and finds the org", async () => {
    await ready()
    match(await p.text(), /Cloud flows|Flows in this solution/, "flow tools (org found)")
  }, { timeout: 150000 })
  await t("Copy environment id", async () => {
    await ready()
    match(await p.copied(() => p.clickLabel("Copy environment id")), /[0-9a-f-]{36}|Default-/i, "clipboard")
  })
  await t("Copy dataverse org", async () => {
    await ready()
    match(await p.copied(() => p.clickLabel("Copy dataverse org")), /\S/, "clipboard")
  })
  await t("Solution picker lists solutions", async () => {
    await ready()
    const n = await until(() => p.run(`document.querySelector('select[aria-label="Solution"]')?.options.length||0`), { what: "the solution picker", timeout: 30000 })
    return `${n} options`
  })
  const LIST = 'input[placeholder="Filter flows"]'
  await t("Cloud flows: list, filter, which flows", async () => {
    await ready()
    await p.openSection("Cloud flows")
    await until(() => p.run(`!!document.querySelector(${JSON.stringify(LIST)})`), { what: "the flow list", timeout: 40000 })
    await p.run(`e.type(document.querySelector('select[aria-label="Which flows"]'),'all')`)
    await sleep(200)
    await p.type(LIST, "zzz-no-such-flow")
    await sleep(200)
    await p.type(LIST, "")
    return (await p.text()).match(/\d+ off \/ \d+/)?.[0] ?? "list shown"
  }, { timeout: 120000 })
  await t("Bulk: pick flows, confirm appears, Cancel changes nothing", async () => {
    await ready()
    await p.openSection("Cloud flows")
    await until(() => p.run(`!!document.querySelector(${JSON.stringify(LIST)})`), { what: "the flow list", timeout: 40000 })
    await p.run(`e.type(document.querySelector('select[aria-label="Which flows"]'),'all')`)
    await sleep(300)
    const has = await p.run(`!!e.label('Pick every flow shown')`)
    if (!has) return "no solution-aware flows in this environment"
    await p.clickLabel("Pick every flow shown")
    await sleep(250)
    const action = await p.run(`e.all('button').map(x=>e.norm(x.textContent)).find(x=>/^Turn (on|off) \\(\\d+\\)$/.test(x))||''`)
    ok(action, "no Turn on/off (N) button")
    await p.clickButton(action)
    await until(() => p.run(`/They'll start running on their triggers|flows?\\?/.test(e.text())&&!!e.button('Cancel')`), { what: "the inline confirm" })
    await p.clickButton("Cancel")
    await until(() => p.run(`!e.button('Cancel')`), { what: "the confirm to go" })
    await p.clickLabel("Pick every flow shown")
    return `stopped at: ${action}`
  }, { timeout: 120000 })
  t.skip("Bulk: actually turn flows on or off", "Not run, by your choice: flows would start running on their triggers.")
  await t("Failed runs", async () => {
    await ready()
    await p.openSection("Failed runs")
    await until(() => p.run(`/No failed runs|Monitor/.test(e.text())`), { what: "failed runs", timeout: 40000 })
  }, { timeout: 120000 })
  await t("Connection references: list, filter, copy", async () => {
    await ready()
    await p.openSection("Connection references")
    await until(() => p.run(`/\\d+ unconnected|None here/.test(e.text())`), { what: "connection references", timeout: 40000 })
    if (await p.hasLabel("Copy connection references as JSON")) JSON.parse(await p.copied(() => p.clickLabel("Copy connection references as JSON")))
    await p.run(`(()=>{const l=e.all('label').find(x=>/Only ones without a connection/.test(x.textContent));if(l)l.querySelector('input').click();return 1})()`)
  }, { timeout: 120000 })
  await t("Environment variables: list, filter, copy", async () => {
    await ready()
    await p.openSection("Environment variables")
    await until(() => p.run(`/\\d+ unset|None here|No environment variables/.test(e.text())||!!document.querySelector('input[placeholder="Filter variables"]')`), { what: "environment variables", timeout: 40000 })
    if (await p.hasLabel("Copy environment variables as JSON")) JSON.parse(await p.copied(() => p.clickLabel("Copy environment variables as JSON")))
  }, { timeout: 120000 })
  for (const [title, pattern] of [["My flows", /make\.powerautomate\.com\/.*flows/], ["Solutions", /make\.powerapps\.com\/.*solutions|solutions/], ["Power Apps", /make\.powerapps\.com/], ["Admin center", /admin\.powerplatform\.microsoft\.com/]])
    await t(`Go to: ${title}`, async () => {
      await ready()
      await p.openSection("Go to")
      await until(() => p.hasTile(title), { what: `the tile ${title}` })
      match(await p.opens(() => p.clickTile(title), { back: flowTab }), pattern, "URL")
    })

  // This flow, on the first one listed
  const flowId = await (async () => {
    const rows = await apiGet(b, org, `workflows?$select=resourceid,workflowid,name&$filter=${encodeURIComponent("category eq 5")}&$top=1`).catch(() => ({ value: [] }))
    return rows.value[0]?.resourceid ?? rows.value[0]?.workflowid ?? null
  })()
  if (!flowId) {
    for (const name of ["This flow: details", "This flow: Show JSON, Copy JSON, download", "This flow: runs"])
      t.skip(name, "No solution-aware flow in this environment")
  } else {
    await b.send("Page.navigate", { url: `${flowHost}/flows/${flowId}/details` }, await b.session(flowTab))
    await t("This flow: details", async () => {
      await ready()
      await p.openSection("This flow")
      await until(() => p.run(`/(On|Off) · /.test(e.text())|| /isn't in Dataverse/.test(e.text())`), { what: "the flow's details", timeout: 40000 })
    }, { timeout: 120000 })
    await t("This flow: Show JSON, Copy JSON, download", async () => {
      await ready()
      await p.openSection("This flow")
      await until(() => p.hasButton("Show JSON"), { what: "Show JSON", timeout: 40000 })
      await p.clickButton("Show JSON")
      await until(() => p.run(`!!document.querySelector('pre')`), { what: "the JSON" })
      JSON.parse(await p.copied(() => p.clickButton("Copy JSON")))
      await p.toast(/Copied flow definition/)
      const from = b.downloadsSeen.length
      await p.clickLabel("Download the definition as a .json file")
      const dl = await until(() => b.downloadsSeen[from], { what: "the download", timeout: 10000 })
      match(dl.suggestedFilename, /\.json$/, "file name")
      await p.clickButton("Hide JSON")
    }, { timeout: 120000 })
    await t("This flow: runs", async () => {
      await ready()
      await until(() => p.run(`/No runs in the last 28 days|Runs|Succeeded|Failed/.test(e.text())`), { what: "the runs", timeout: 30000 })
    }, { timeout: 90000 })
    t.skip("This flow: Turn on or Turn off", "Not run, by your choice: there's no confirm step and the flow really changes.")
  }
  await b.closeTab(flowTab)

  // ---- Power Apps ---------------------------------------------------------------------
  const m = run.area("maker-panel")
  const makerTab = await b.openTab(`${makerHost}/home`)
  await p.front(makerTab)
  const makerReady = async () => {
    await p.front(makerTab)
    await until(() => p.run(`document.documentElement.dataset.platform==='maker'`), { what: "the Power Apps panel", timeout: 60000 })
    await until(() => p.run(`/This environment/.test(e.text())`), { what: "its sections", timeout: 40000 })
  }
  await m("Detects Power Apps, and links this environment's org", async () => {
    await makerReady()
    await p.openSection("Dynamics 365")
    match(await p.text(), /Web API/, "the Dynamics 365 section")
  }, { timeout: 150000 })
  await m("Copy Environment ID", async () => {
    await makerReady()
    match(await p.copied(() => p.clickLabel("Copy environment id")), /[0-9a-f-]{36}|Default-/i, "clipboard")
  })
  await m("Read the page again", async () => {
    await makerReady()
    await p.clickLabel("Read the page again")
    await sleep(500)
    ok(await p.hasLabel("Read the page again"), "panel lost")
  })
  await m("Web API tile", async () => {
    await makerReady()
    await p.openSection("Dynamics 365")
    match(await p.opens(() => p.clickTile("Web API"), { back: makerTab }), /\/api\/data\/v9\.2\//, "URL")
  })
  for (const [title, pattern] of [["Home", /\/home/], ["Solutions", /\/solutions/], ["Tables", /\/entities/], ["Apps", /\/apps/], ["Flows", /powerautomate.*flows/], ["Solution history", /\/history/], ["Admin center", /admin\.powerplatform/]])
    await m(`This environment: ${title}`, async () => {
      await makerReady()
      await p.openSection("This environment")
      await until(() => p.hasTile(title), { what: `the tile ${title}` })
      match(await p.opens(() => p.clickTile(title), { back: makerTab }), pattern, "URL")
    })
  if (!solution) {
    m.skip("In a solution: flows, connection references, variables", "No unmanaged solution in this environment")
  } else {
    await b.send("Page.navigate", { url: `${makerHost}/solutions/${solution}` }, await b.session(makerTab))
    await m("In a solution: Copy Solution ID", async () => {
      await makerReady()
      match(await p.copied(() => p.clickLabel("Copy solution id")), /[0-9a-f-]{36}/i, "clipboard")
    }, { timeout: 120000 })
    await m("In a solution: Flows in this solution", async () => {
      await makerReady()
      await p.openSection("Flows in this solution")
      await until(() => p.run(`!!document.querySelector(${JSON.stringify(LIST)})||/Every flow here is on|No flows|\\d+ off/.test(e.text())`), { what: "the flows", timeout: 40000 })
    }, { timeout: 120000 })
    await m("In a solution: Connection references and variables", async () => {
      await makerReady()
      await p.openSection("Connection references")
      await p.openSection("Environment variables")
      await until(() => p.run(`/\\d+ unconnected|None here/.test(e.text())`), { what: "connection references", timeout: 40000 })
    }, { timeout: 120000 })
  }
  await b.closeTab(makerTab)
  await b.closeTab(org)
}
