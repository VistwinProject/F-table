import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// 編輯模式（鍵盤 e）的「存到專案」會 POST 到 /__table-export，內容直接寫成
// table-export.txt 放在 web/ 底下。與 F-wall 的 /__wall-export 是同一個作法：
// 匯出的文字原本只能靠剪貼簿，而 navigator.clipboard 在沒有焦點時會安靜失敗，
// 投影機那台也不見得方便貼上。
//
// ⚠ apply: 'serve' —— 只有 dev server 有這個端點，build 出來的靜態檔沒有這段。
// ⚠ 路徑寫死，不吃 request 給的檔名。
function tableExportSink() {
  return {
    name: 'table-export-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__table-export', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        req.on('data', (c) => {
          body += c
          if (body.length > 1_000_000) req.destroy()
        })
        req.on('end', () => {
          try {
            fs.writeFileSync(path.join(ROOT, 'table-export.txt'), body, 'utf8')
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: 'table-export.txt' }))
          } catch (err) {
            res.statusCode = 500
            res.end(String(err.message || err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tableExportSink()],
  server: {
    port: 5173,
    host: true,
  },
})
