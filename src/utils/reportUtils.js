/**
 * reportUtils.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure helpers for the Living Report view. No React, no d3 — unit-testable
 * under CRA jest.
 *
 * effectiveSections(report, nodes)
 *   The report's stored sections in order, each with a live `theme` node
 *   attached (or null → tombstone chapter), followed by auto-seeded empty
 *   sections for themes not yet in the report. Auto-seeding happens here at
 *   derivation time — never by dispatching during render.
 *
 * parseInline(text)
 *   Tokenizes the bold/italic-only prose markup (**bold**, *italic*) into
 *   [{type: 'text'|'bold'|'italic', content}]. Unmatched markers stay
 *   literal. Components map tokens to <strong>/<em> — no HTML strings.
 *
 * pullQuoteFor(codeId, nodes)
 *   Resolves a pull-quote reference to display data; missing codes become
 *   tombstones (design §4: report tolerates dangling references).
 */

export function effectiveSections(report, nodes) {
  const themes = nodes.filter(n => n.type === 'theme');
  const themesById = new Map(themes.map(t => [t.id, t]));
  const stored = report?.sections ?? [];
  const storedIds = new Set(stored.map(s => s.themeId));
  return [
    ...stored.map(s => ({ ...s, theme: themesById.get(s.themeId) ?? null })),
    ...themes
      .filter(t => !storedIds.has(t.id))
      .map(t => ({ themeId: t.id, proseBlocks: [], pullQuoteIds: [], theme: t })),
  ];
}

const INLINE_RE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

export function parseInline(text) {
  const tokens = [];
  let last = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', content: text.slice(last, m.index) });
    if (m[2] !== undefined) tokens.push({ type: 'bold', content: m[2] });
    else tokens.push({ type: 'italic', content: m[4] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', content: text.slice(last) });
  return tokens;
}

export function pullQuoteFor(codeId, nodes) {
  const code = nodes.find(n => n.id === codeId && n.type === 'code');
  if (!code) return { tombstone: true, label: 'Removed code', quote: null, source: null, color: null };
  return {
    tombstone: false,
    label: code.label,
    quote: code.quote || '',
    source: code.source || '',
    color: code.color,
  };
}
