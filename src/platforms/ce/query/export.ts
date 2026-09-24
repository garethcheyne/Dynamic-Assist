/** Query results as Excel, CSV or JSON files, downloaded from the page. */
import { strToU8, zipSync } from "fflate"

import type { Cell, Column, Row } from "./run"

export type ExportFormat = "xlsx" | "csv" | "json"

/** What a cell shows: the formatted value if Dynamics sent one. */
const text = (cell: Cell | undefined) =>
  cell === undefined || cell.value === null || cell.value === undefined
    ? ""
    : (cell.formatted ?? String(cell.value))

export function exportResults(
  format: ExportFormat,
  name: string,
  columns: Column[],
  rows: Row[]
) {
  // Local time, as the user reads the clock: account-2026-09-24-19-57.xlsx
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`
  const file = `${name}-${stamp}.${format}`
  if (format === "json") {
    // Raw values keyed by logical name, plus the formatted value where there is one
    const data = rows.map((row) =>
      Object.fromEntries(
        columns.flatMap((c) => {
          const cell = row[c.key]
          const entries: [string, unknown][] = [[c.key, cell?.value ?? null]]
          if (cell?.formatted && cell.formatted !== String(cell.value))
            entries.push([`${c.key}@formatted`, cell.formatted])
          return entries
        })
      )
    )
    download(file, "application/json", JSON.stringify(data, null, 2))
  } else if (format === "csv") {
    const quote = (s: string) =>
      /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    const lines = [
      columns.map((c) => quote(c.label)).join(","),
      ...rows.map((row) =>
        columns.map((c) => quote(text(row[c.key]))).join(",")
      ),
    ]
    // BOM so Excel opens it as UTF-8
    download(
      file,
      "text/csv;charset=utf-8",
      String.fromCharCode(0xfeff) + lines.join("\r\n")
    )
  } else {
    download(
      file,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xlsx(columns, rows)
    )
  }
}

function download(file: string, type: string, data: string | Uint8Array) {
  const blob = new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// --- A minimal .xlsx: one sheet, inline strings, numbers as numbers ------------

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Characters XML 1.0 forbids
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")

function colName(i: number) {
  let s = ""
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function xlsx(columns: Column[], rows: Row[]): Uint8Array {
  const cell = (ref: string, v: Cell | undefined, header = false) => {
    if (header)
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${esc(String(v?.value ?? ""))}</t></is></c>`
    // Numbers stay numbers when Dynamics didn't format them into something else
    if (typeof v?.value === "number" && !v.formatted?.match(/[^\d.,\-\s]/))
      return `<c r="${ref}"><v>${v.value}</v></c>`
    const t = text(v)
    return t
      ? `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(t)}</t></is></c>`
      : ""
  }
  const sheetRows = [
    `<row r="1">${columns.map((c, i) => cell(`${colName(i)}1`, { value: c.label, formatted: null }, true)).join("")}</row>`,
    ...rows.map(
      (row, r) =>
        `<row r="${r + 2}">${columns.map((c, i) => cell(`${colName(i)}${r + 2}`, row[c.key])).join("")}</row>`
    ),
  ]
  const widths = columns
    .map(
      (c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, c.label.length + 4))}" customWidth="1"/>`
    )
    .join("")

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A1:${colName(Math.max(columns.length - 1, 0))}${rows.length + 1}"/></worksheet>`,
  }
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))
  )
}
