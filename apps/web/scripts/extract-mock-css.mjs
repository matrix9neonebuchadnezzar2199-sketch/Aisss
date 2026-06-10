import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const stylesDir = path.join(root, 'apps/web/src/styles')
fs.mkdirSync(stylesDir, { recursive: true })

function extract (htmlPath, outName) {
  const html = fs.readFileSync(path.join(root, htmlPath), 'utf8')
  const m = html.match(/<style>([\s\S]*?)<\/style>/)
  if (!m) throw new Error(`no style in ${htmlPath}`)
  fs.writeFileSync(path.join(stylesDir, outName), m[1])
  return m[1].length
}

const webuiLen = extract('mockups/webui.html', 'mock-webui.css')
const detailLen = extract('mockups/case-detail.html', 'mock-case-detail.css')
console.log('mock-webui.css', webuiLen, 'mock-case-detail.css', detailLen)
