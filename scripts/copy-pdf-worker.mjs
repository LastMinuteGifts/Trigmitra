// pdfjs ka worker public/ me .js extension ke saath copy karo.
// Wajah: host .mjs files ko text/plain serve karta hai, jisse browser
// module worker load nahi kar pata. .js ke saath sahi MIME milta hai.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const source = join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const targetDir = join(projectRoot, 'public')
const target = join(targetDir, 'pdf.worker.min.js')

mkdirSync(targetDir, { recursive: true })
copyFileSync(source, target)

console.log(`pdf worker copied -> ${target}`)
