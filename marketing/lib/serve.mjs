/** A static server for the built extension (dist/) and the marketing folder. */
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
}

/** Serves `/` from dist and `/marketing/` from the marketing folder. */
export function serve(root, port = 4180) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname)
    const file = url.startsWith("/marketing/")
      ? path.join(root, url)
      : path.join(root, "dist", url)
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404)
        return res.end()
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      })
      res.end(buf)
    })
  })
  return new Promise((resolve) =>
    server.listen(port, () =>
      resolve({ url: `http://localhost:${port}`, close: () => server.close() })
    )
  )
}
