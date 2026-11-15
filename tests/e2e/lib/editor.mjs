// The query builders' code editor (CodeMirror), by really typing into it: the
// suggestions and checks only run on real input.
import { sleep, until } from "./browser.mjs"
import { inBuilder } from "./builder.mjs"

export function editorOn(b, targetId) {
  const q = (body, options) => inBuilder(b, targetId, body, options)
  const key = async (key, code, vk, modifiers = 0) => {
    const session = await b.session(targetId)
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, session)
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, session)
  }
  const focus = async () => {
    const session = await b.session(targetId)
    await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, session)
    await q(`(()=>{window.focus();q.dialog().querySelector('.cm-content').focus();return 1})()`)
    await sleep(100)
  }
  const type = async (text) => {
    await b.send("Input.insertText", { text }, await b.session(targetId))
    await sleep(150)
  }
  const editor = {
    key,
    focus,
    type,
    q,
    text: () => q(`q.dialog().querySelector('.cm-content').innerText.replace(/\\u00a0/g,' ')`),
    /** Empties it, ready to type */
    async clear() {
      await focus()
      const session = await b.session(targetId)
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2, commands: ["selectAll"] }, session)
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 }, session)
      await key("Delete", "Delete", 46)
      await sleep(150)
    },
    async set(text) {
      await editor.clear()
      await type(text)
      await sleep(250)
      return editor.text()
    },
    async left(times) {
      for (let i = 0; i < times; i++) await key("ArrowLeft", "ArrowLeft", 37)
      await sleep(100)
    },
    /** What's being suggested now: labels, in order */
    suggestions: () =>
      q(`[...q.root().querySelectorAll('.cm-tooltip-autocomplete li')].map(li=>({label:q.norm(li.querySelector('.cm-completionLabel')?.textContent),detail:q.norm(li.querySelector('.cm-completionDetail')?.textContent)}))`),
    /** Waits for suggestions; asks for them with Ctrl+Space if typing didn't bring them */
    async suggested(test = (list) => list.length > 0, what = "suggestions") {
      const seen = { last: [] }
      const check = async () => {
        seen.last = await editor.suggestions()
        return test(seen.last) ? seen.last : null
      }
      const found = await until(check, { what, timeout: 3000, every: 150 }).catch(() => null)
      if (found) return found
      await key(" ", "Space", 32, 2)
      return until(check, { what, timeout: 8000, every: 150 }).catch(async (error) => {
        const doc = await editor.text().catch(() => "?")
        const at = await q(`q.root().getSelection?.()?.anchorOffset??-1`).catch(() => "?")
        throw new Error(`${error.message}. Suggested instead: ${JSON.stringify(seen.last.slice(0, 10).map((s) => s.label))}; the editor has ${JSON.stringify(doc)}, cursor ${at}`)
      })
    },
    async accept() {
      await key("Enter", "Enter", 13)
      await sleep(250)
      return editor.text()
    },
    closeList: () => key("Escape", "Escape", 27),
    /** How many ranges the checks have marked, once they've run */
    marked: async (severity = "error") => {
      await sleep(700)
      return q(`q.dialog().querySelectorAll('.cm-lintRange-${severity}').length`)
    },
  }
  return editor
}
