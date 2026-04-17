// build.js — Template engine for multi-country pages
// Usage: node build.js
// Reads templates/*.html, replaces {{VAR}} with values from countries/*.json,
// writes output to /<country>/<page>.html
//
// Run this before every deploy when templates or country configs change.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = resolve(__dirname, 'templates')
const COUNTRIES_DIR = resolve(__dirname, 'countries')

// Load all country configs
const countries = readdirSync(COUNTRIES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const config = JSON.parse(readFileSync(resolve(COUNTRIES_DIR, f), 'utf8'))
    config._file = f
    return config
  })

console.log(`[build] ${countries.length} countries: ${countries.map(c => c.CODE).join(', ')}`)

// Load all templates
const templates = readdirSync(TEMPLATES_DIR)
  .filter(f => f.endsWith('.html'))

console.log(`[build] ${templates.length} templates: ${templates.join(', ')}`)

// Replace {{VAR}} patterns — supports nested like {{ART}} inside values
function applyVars(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match
  })
}

let generated = 0

for (const country of countries) {
  const outDir = resolve(__dirname, country.ROUTE)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  for (const tpl of templates) {
    const templateHtml = readFileSync(resolve(TEMPLATES_DIR, tpl), 'utf8')
    const outputHtml = applyVars(templateHtml, country)
    const outPath = resolve(outDir, tpl)
    writeFileSync(outPath, outputHtml, 'utf8')
    generated++
    console.log(`  ✓ /${country.ROUTE}/${tpl}`)
  }
}

console.log(`\n[build] Done: ${generated} pages generated.`)
