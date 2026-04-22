// lib/motor-que.js
// Motor del QUÉ — Query expansion + RAG por niveles jerárquicos
// Extraído de api/marco.js para ser llamado directamente sin HTTP

import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const ai        = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function geminiConFallback(geminiParams, claudePrompt, { maxTokens = 2000, isJson = false } = {}) {
  try {
    const resp = await generateWithRetry(ai, geminiParams)
    return resp.text
  } catch (err) {
    console.warn('[motor-que] Gemini falló, usando Claude Haiku:', err.message)
    const prompt = isJson ? claudePrompt + '\n\nResponde SOLO con JSON válido, sin markdown.' : claudePrompt
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
    let text = resp.content[0].text.trim()
    if (isJson) text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return text
  }
}

const RAG_TOP       = 12
const RAG_THRESHOLD = 0.30
const RAG_LABEL     = '⚖️ Legislación'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function is503(err) {
  return err?.message?.includes('503') || err?.message?.includes('429') ||
    err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand') || err?.message?.includes('RESOURCE_EXHAUSTED')
}

async function generateWithRetry(ai, params, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      if (is503(err) && i < retries - 1) { await sleep(2000 * Math.pow(2, i)); continue }
      throw err
    }
  }
}

async function rpcWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const r = await fn()
    if (!r.error) return r.data || []
    if (i < retries - 1) { await sleep(800 * (i + 1)); continue }
    console.error('Supabase RPC error:', r.error)
    return []
  }
}

async function embedQuery(text, retries = 6) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 1536
        })
      }
    )
    if (res.ok) return (await res.json()).embedding.values
    const body = await res.text()
    if ((res.status === 503 || res.status === 429 || body.includes('UNAVAILABLE') || body.includes('high demand') || body.includes('RESOURCE_EXHAUSTED')) && i < retries - 1) {
      await sleep(2000 * Math.pow(2, i)); continue
    }
    throw new Error(`Embedding error ${res.status}: ${body}`)
  }
}

const CORPUS_LANG = {
  MX: 'Spanish',
  ES: 'Spanish',
  CZ: 'Czech',
  DE: 'German',
  CH: 'German or French',
  FR: 'French',
  MC: 'French',
}

function getExpansionPrompt(caso, pais, modo = 'normal') {
  if (modo === 'magnus') {
    const lang = CORPUS_LANG[pais] || 'the official language of ' + pais
    return `You are a legal expert in ${pais} law.
Generate 5 search queries in ${lang} using legal terminology from ${pais} jurisdiction.

Case (may be in any language): "${caso}"

Translate the legal concepts to ${lang} legal terminology. The queries will search a ${pais} legal database so they MUST use ${lang} legal terms and citations (e.g. § numbers for CZ/DE, Art. numbers for MX/ES/FR).

Respond ONLY with JSON without markdown: {"queries": ["query 1", "query 2", "query 3", "query 4", "query 5"]}`
  }
  return `You are an expert legal consultant for ${pais} jurisdiction.
A lawyer describes this case: "${caso}"
Generate exactly 5 specific legal search queries for a ${pais} legal database. Each query must cover a different legal aspect: rights, obligations, applicable procedure, consequences, and relevant legal figures.
Use precise legal terminology. Write the queries in the same language as the case description.
Respond ONLY with JSON without markdown: {"queries": ["query 1", "query 2", "query 3", "query 4", "query 5"]}`
}

export function getSintesisPrompt(caso, articulosTexto) {
  return `ABSOLUTE RULE — NON-NEGOTIABLE: Detect the language of this exact string: "${caso.slice(0, 60)}"
If that string is in English → write your ENTIRE response in English only.
If in Spanish → respond entirely in Spanish.
If in Czech → respond entirely in Czech.
The articles below may be in Czech or Spanish — that is FINE. Cite them but explain them in the detected language.
DO NOT let the language of the articles influence the language of your response.
DO NOT announce what language you detected. DO NOT explain this rule. DO NOT write any preamble. START your response directly with the content.

You are Apolo, the legal assistant of Tesseum.
A lawyer describes this case: "${caso}"
Relevant articles found, ordered by hierarchy:
${articulosTexto}
Analyze this case as a senior colleague would in a case review. Elaborate on the legal framework, explain how it applies to the specific facts, and conclude with a clear recommendation. Let the nature of the case guide your structure — not every case needs the same approach. Cite ONLY articles from the context above. No asterisks or markdown.`
}

export async function motorQueRag({ caso, pais = 'MX', estado_mx, modo = 'normal' }) {
  if (!caso || caso.trim().length < 20) {
    return { ok: false, error: 'Describe tu caso con más detalle (mínimo 20 caracteres).' }
  }

  // Paso 1: Query expansion
  const expansionText = await geminiConFallback(
    { model: 'gemini-2.5-flash', contents: getExpansionPrompt(caso, pais, modo),
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 2000 } },
    getExpansionPrompt(caso, pais, modo),
    { maxTokens: 600, isJson: true }
  )
  const queries = JSON.parse(expansionText).queries
  if (!Array.isArray(queries) || queries.length === 0) throw new Error('Respuesta de expansión inválida.')
  if (modo === 'magnus') console.log(`[magnus expansion ${pais}]`, JSON.stringify(queries))

  // Paso 2: Embeddear queries en paralelo
  const vectors = await Promise.all(queries.map(q => embedQuery(q)))

  // Paso 3: Búsqueda semántica universal
  // Magnus: secuencial para evitar timeout por sobrecarga de pgvector
  // Normal: paralelo para mayor velocidad
  let busquedas
  if (modo === 'magnus') {
    busquedas = []
    for (const v of vectors) {
      busquedas.push(await rpcWithRetry(() => supabase.rpc('buscar_marco_universal', {
        query_embedding: v,
        pais_filter:     pais,
        nivel_filter:    null,
        estado_filter:   estado_mx || null,
        match_count:     RAG_TOP
      })))
    }
  } else {
    busquedas = await Promise.all(
      vectors.map(v =>
        rpcWithRetry(() => supabase.rpc('buscar_marco_universal', {
          query_embedding: v,
          pais_filter:     pais,
          nivel_filter:    null,
          estado_filter:   estado_mx || null,
          match_count:     RAG_TOP
        }))
      )
    )
  }

  const mapa = new Map()
  busquedas.flat().forEach(art => {
    const prev = mapa.get(art.id)
    if (!prev || art.similarity > prev.similarity) mapa.set(art.id, art)
  })
  const candidatos = Array.from(mapa.values())
    .map(art => ({ ...art, nivel_label: RAG_LABEL }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, RAG_TOP)
  if (modo === 'magnus') {
    const scores = candidatos.map(a => a.similarity?.toFixed(3)).join(', ')
    console.log(`[magnus RAG ${pais}] candidatos: ${candidatos.length}, scores: [${scores}]`)
  }
  const articulos = modo === 'magnus'
    ? candidatos
    : candidatos.filter(art => art.similarity >= RAG_THRESHOLD)

  const articulosTexto = articulos
    .map(a => `[${RAG_LABEL}] ${a.numero_articulo} — ${a.ley}${a.estado ? ` (${a.estado})` : ''}:\n${(a.texto_original || '').slice(0, 400)}`)
    .join('\n\n---\n\n')

  return {
    ok: true,
    pais,
    queries_generadas: queries,
    articulos_por_nivel: { null: articulos },
    articulosTexto,
    total_encontrados: articulos.length,
  }
}

export async function motorQue({ caso, pais = 'MX', estado_mx }) {
  const rag = await motorQueRag({ caso, pais, estado_mx })
  if (!rag.ok) return rag

  const sintesis = await geminiConFallback(
    { model: 'gemini-2.5-flash', contents: getSintesisPrompt(caso, rag.articulosTexto),
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.2, maxOutputTokens: 2000 } },
    getSintesisPrompt(caso, rag.articulosTexto),
    { maxTokens: 2000 }
  )

  return { ...rag, sintesis }
}
