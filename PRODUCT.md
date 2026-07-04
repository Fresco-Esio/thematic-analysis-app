# Product

## Register

product

## Users

Qualitative researchers and analysts (academic and research contexts) conducting Braun & Clarke Reflexive Thematic Analysis. They work at a desk on a laptop or large monitor, usually with interview transcripts and a coding spreadsheet open alongside. Their job: import coded excerpts, cluster codes into candidate themes and subthemes on a visual map, iterate on the thematic structure, and export a publication-ready thematic map (PNG/PDF).

## Product Purpose

ThematicMap is a React-based visual workspace for reflexive thematic analysis. It replaces static diagramming tools with a live force-directed graph: codes orbit themes, relationships are drawn and labelled, and the evolving map is always exportable. Success = a researcher can go from spreadsheet to defensible thematic map in one sitting without fighting the tool.

It is explicitly NOT a clinical, diagnostic, or therapeutic tool and must never use clinical terminology (patient, symptom, diagnosis). Use: researcher, participant, code, quote, theme.

## Brand Personality

Confident, tactile, scholarly. Neo-Brutalist: Bricolage Grotesque type, cream `#f0ebe3` canvas, near-black `#0f0d0a` ink, red `#dc2626` accent, hard offset box-shadows, square corners, 2–3px solid borders. The interface should feel like a well-made physical research wall — index cards, string, and marker — not like enterprise SaaS.

## Anti-references

- Clinical/EHR software aesthetics (white + teal, soft shadows, badge-heavy dashboards)
- Generic SaaS admin templates (identical card grids, gradient accents, glassmorphism)
- Timid academic software (grey, undifferentiated, form-first)

## Design Principles

1. **The map is the product** — canvas gets maximal space; chrome stays thin and quiet.
2. **Direct manipulation first** — drag, right-click, and inline panels beat modals and forms.
3. **Every state recoverable** — undo/redo covers destructive actions; confirmations mention it.
4. **Hard edges, honest hierarchy** — hierarchy through weight, size, and hard shadows, never through blur or gradients.
5. **Research vocabulary only** — labels and copy use Braun & Clarke terminology.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: 4.5:1 text contrast, visible focus rings (3px red `:focus-visible`), 16px minimum body text.
- All interactive elements reachable and operable by keyboard; ARIA roles on menus (`menu`/`menuitem`), dialogs (`role="dialog"`, `aria-modal`), and graph nodes (`role="button"`, descriptive `aria-label`).
- Screen-reader announcements for dynamic results (search match counts via `aria-live`).
- Node colors always paired with position/label — never color as the only signal (14-color theme palette chosen for distinguishability).
