# Scripts

Pipeline de generación y mantenimiento del corpus legal.

---

## `generar_html_leyes.js`

Pre-renderiza cada ley como un blob HTML estático y lo guarda en la tabla `leyes_html`. `abogado.html` (y sus variantes /cz/, /mx/) consumen ese HTML directo — una sola row por (país, ley, estado) — para evitar armar la ley artículo por artículo en el cliente.

### Cuándo correrlo

Re-correrlo cuando:
- Cambias la lógica de `formatTexto` (tipografía, paragraphs, cross-refs).
- Agregas/cambias estructuras de sección (`libro`, `titulo`, `capitulo`).
- Importas artículos nuevos a `articulos` para una ley existente (sí, el script upserta).
- Importas un país / ley / estado nuevo.

### Cómo correrlo

Requiere `SUPABASE_URL` y `SUPABASE_KEY` (service role) en `.env` raíz.

```bash
node scripts/generar_html_leyes.js
```

Regenera **todas** las leyes de todos los países. ~3–5 min para el corpus actual (CH, CZ, DE, ES, FR, MC, MX — ~155 entradas).

Para regenerar solo un país / ley puntual, edita temporalmente `main()` — la función `generarHTMLLey(pais, ley, estado)` es la unidad atómica.

### Qué produce

Por cada artículo:

```html
<div class="ley-articulo" id="par-1" data-articulo="§ 1" data-libro="...">
  <span class="ley-art-num">§ 1</span>
  <div class="ley-art-texto">
    <p class="ley-subsec"><span class="ley-subsec-num">(1)</span> Texto...</p>
    <p class="ley-subsec"><span class="ley-subsec-num">(2)</span> Texto...</p>
  </div>
</div>
```

`formatTexto(texto, numeroArticulo)`:
1. **Strip del prefijo** `§ 1`, `Artículo 1.-`, etc. al inicio del texto (ya se muestra en `.ley-art-num`).
2. **Split en subcláusulas** `(1)`, `(2)`, `(3a)` → cada una es un `<p class="ley-subsec">`.
3. Si no hay subcláusulas, un solo `<p class="ley-parrafo">`.
4. Preserva `\n` como `<br>` y linkea cross-refs `§ NN` → `<a href="#par-NN" class="ley-ref">`.

### Supuestos sobre `articulos.texto_original`

- **Texto plano** (no HTML); `formatTexto` lo escapa.
- Puede empezar con el número ("§ 1 ..." en CZ) — el script lo quita.
- Subcláusulas marcadas como `(1)`, `(2)`, `(Na)` separadas por espacios.
- `\n` puede aparecer como salto de línea suave (se convierte en `<br>`).

Si en el futuro hay scrapes que preserven HTML rico (negritas, listas anidadas reales), hay que decidir: o el generador lo respeta tal cual, o lo re-procesa. Los cross-refs `§ NN` sí se linkean automáticamente aunque ya vengan escritos como texto plano.

### CSS asociado

La tipografía vive en `templates/abogado.html` (→ build → `cz/abogado.html` y `mx/abogado.html`). Classes: `.ley-art-num`, `.ley-art-texto`, `.ley-parrafo`, `.ley-subsec`, `.ley-subsec-num`, `.ley-ref`, `.ley-libro`, `.ley-titulo`, `.ley-capitulo`, `.ley-articulo.activo`, `.ley-art-zruseno`.

---

## Otros scripts

- `templatize.py`, `templatize_home.py`, `templatize_home2.py` — experimentos de migración al sistema de templates (`templates/*.html` + `countries/*.json` + `build.js`). Ya aplicados; mantener como referencia.
- `adapt_mx*.py` — adaptación del corpus MX al schema de la tabla `articulos`. Ya aplicados.
- `update_jsons.py` — utilidad para editar `countries/*.json` programáticamente.
