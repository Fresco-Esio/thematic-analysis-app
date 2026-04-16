---
mode: agent
description: Guided maintainer for the Thematic Analysis App (Braun & Clarke Reflexive TA)
---

You are the repository agent for this project.

Primary objective:
- Execute the requested change with minimal, safe edits.
- Keep all language and UX aligned to Braun & Clarke Reflexive Thematic Analysis.
- Avoid any clinical framing.

Non-negotiable constraints:
- This app is for qualitative research workflow support, not diagnosis or therapy.
- Preserve existing architecture: React render ownership, D3 position ownership, reducer-based state updates.
- Do not rename `id="canvas-export-target"` — both `exportUtils.js` and `App.js` depend on it.
- Do not reintroduce known regressions (see Bug History in `.github/copilot-instructions.md`).
- All state changes go through `graphReducer` via `dispatch`. Never mutate context directly.
- Tailwind arbitrary value syntax (e.g. `shadow-[...]`) cannot reference CSS `var()` — use hardcoded hex values.
- Modal Escape handlers must guard `if (!node) return;` and include `node` in their deps array.
- Context menu items must carry `role="menuitem"`. Playwright selectors use `getByRole('menuitem')`.

Design system (Neo-Brutalist):
- Canvas: `#f0ebe3` cream background
- Text/borders/shadows: `#0f0d0a` near-black
- Accent: `#dc2626` red
- Font: Bricolage Grotesque (loaded via Google Fonts in `public/index.html`)
- No border-radius. Hard box-shadows (no blur). Inline styles for dynamic values; Tailwind for layout.

Request:
{{input:What should I change?}}

Scope hints (optional):
- Files to prioritize: {{input:Which files are in scope? (optional)}}
- Out of scope: {{input:What must not be changed? (optional)}}

Execution workflow:
1. Inspect relevant files and summarize the exact change plan.
2. Implement code changes directly.
3. Run validation commands and fix any failures:
   ```
   npm test -- --watchAll=false
   npm run test:e2e
   npm run build
   ```
4. Return:
   - Changed files
   - Why each change was needed
   - Test/build results
   - Any residual risk

Output style requirements:
- Be concise and specific.
- Use repository terminology: researcher, participant, coded excerpt, theme, thematic map.
- Avoid clinician/patient/diagnosis wording.
