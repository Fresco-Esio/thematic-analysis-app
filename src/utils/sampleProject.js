/**
 * sampleProject.js
 * ──────────────────────────────────────────────────────────────────────────
 * Bundled demo dataset for the Help overlay. Contains 10 coded excerpts
 * from the thematic-import-sample.csv with 7 unique themes.
 * Layout is deterministic: themes on a 4-column grid, codes positioned
 * inside their theme regions, one code in the UNSORTED tray.
 */

import { buildGraphFromRows } from './importUtils';

/**
 * Embedded sample data rows (from docs/samples/thematic-import-sample.csv).
 * Each row: source, quote, code, theme.
 */
const SAMPLE_ROWS = [
  {
    source: 'Interview_01',
    quote: 'I keep checking my phone because I feel like I will miss something important.',
    code: 'Compulsive checking',
    theme: 'Anxiety responses',
  },
  {
    source: 'Interview_01',
    quote: 'When I write down my thoughts, I notice the same worries repeating.',
    code: 'Repetitive worry',
    theme: 'Cognitive patterns',
  },
  {
    source: 'Interview_02',
    quote: 'Talking to my sister helps me calm down after stressful meetings.',
    code: 'Social support use',
    theme: 'Coping strategies',
  },
  {
    source: 'Interview_02',
    quote: 'I avoid difficult emails until late evening and then feel worse.',
    code: 'Avoidance cycle',
    theme: 'Behavioral patterns',
  },
  {
    source: 'Interview_03',
    quote: 'If I sleep poorly, everything feels harder the next day.',
    code: 'Sleep impact',
    theme: 'Daily functioning',
  },
  {
    source: 'Interview_03',
    quote: 'I started short breathing exercises before presentations and it helps.',
    code: 'Breathing routine',
    theme: 'Adaptive practices',
  },
  {
    source: 'Interview_04',
    quote: 'I tell myself one mistake means I am failing at everything.',
    code: 'Catastrophic self-talk',
    theme: 'Cognitive distortions',
  },
  {
    source: 'Interview_04',
    quote: 'On good days I take a walk first and my mood improves.',
    code: 'Walk as reset',
    theme: 'Behavioral activation',
  },
  {
    source: 'Interview_05',
    quote: 'I notice tension in my shoulders before I realize I am anxious.',
    code: 'Somatic cue awareness',
    theme: 'Emotion regulation',
  },
  {
    source: 'Interview_05',
    quote: 'I skipped lunch and then felt irritable in the afternoon.',
    code: 'Physiological trigger',
    theme: null, // unassigned
  },
];

/**
 * Build and return the sample project state.
 * Returns { nodes, edges, regions, report } ready for SET_GRAPH dispatch.
 *
 * Layout:
 *   - Themes on a 4-column grid (loose spacing for visibility)
 *   - Each theme gets a region and assigned codes positioned inside
 *   - Unassigned code in the UNSORTED tray area
 */
export function buildSampleProject() {
  // Use buildGraphFromRows to create initial node structures
  const { codeNodes: initialCodeNodes, themeNodes: themeList, edges: initialEdges } = buildGraphFromRows(SAMPLE_ROWS);

  // Create a map of theme label to id for position assignment
  const themesByLabel = {};
  themeList.forEach(t => {
    themesByLabel[t.label] = t;
  });

  // ── Deterministic theme positions: 4-column grid ──────────────────────────
  const gridCols = 4;
  const gridSpacingX = 560;
  const gridSpacingY = 420;
  const gridOriginX = 380;
  const gridOriginY = 260;

  const themes = themeList.map((theme, idx) => {
    const col = idx % gridCols;
    const row = Math.floor(idx / gridCols);
    const x = gridOriginX + col * gridSpacingX;
    const y = gridOriginY + row * gridSpacingY;
    return {
      ...theme,
      x,
      y,
      wallPosition: { x, y },
    };
  });

  // ── Regions for each theme ────────────────────────────────────────────────
  const regions = themes.map(theme => ({
    id: `region-${theme.id}`,
    themeId: theme.id,
    rect: {
      x: theme.x - 220,
      y: theme.y - 160,
      w: 440,
      h: 320,
    },
  }));

  // ── Assign code positions ─────────────────────────────────────────────────
  // Group codes by their assigned theme
  const codesByTheme = {};
  themes.forEach(t => {
    codesByTheme[t.id] = [];
  });

  initialCodeNodes.forEach(code => {
    if (code.primaryThemeId) {
      codesByTheme[code.primaryThemeId].push(code);
    }
  });

  // Position codes inside their theme regions (2-column layout within region)
  const codes = initialCodeNodes.map(code => {
    if (code.primaryThemeId) {
      const theme = themes.find(t => t.id === code.primaryThemeId);
      const codesInTheme = codesByTheme[code.primaryThemeId];
      const indexWithinTheme = codesInTheme.indexOf(code);
      const x = theme.x - 120 + (indexWithinTheme % 2) * 190;
      const y = theme.y - 60 + Math.floor(indexWithinTheme / 2) * 120;
      return {
        ...code,
        x,
        y,
        wallPosition: { x, y },
      };
    } else {
      // Unassigned code: position near the UNSORTED tray area
      // (left side, low — will appear in the tray on Wall view)
      return {
        ...code,
        x: 200,
        y: 300,
        // Note: no wallPosition set; this keeps it in the UNSORTED tray
      };
    }
  });

  // ── Combine all nodes ─────────────────────────────────────────────────────
  const nodes = [...themes, ...codes];

  // ── Edges unchanged from import ───────────────────────────────────────────
  const edges = initialEdges;

  // ── Empty report (sections created on-demand as user edits) ───────────────
  const report = { sections: [] };

  return {
    nodes,
    edges,
    regions,
    report,
  };
}
