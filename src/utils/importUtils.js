/**
 * importUtils.js
 * ──────────────────────────────────────────────────────────────────────────
 * Parses Excel (.xlsx) and CSV files into graph nodes and edges.
 *
 * EXPECTED COLUMNS (flexible header matching):
 *   Col 0: Source / Participant
 *   Col 1: Quoted Text
 *   Col 2: Code (Comment) — becomes the node label
 *   Col 3: Preliminary Theme — used for initial theme assignment
 *
 * OUTPUT:
 *   { codeNodes, themeNodes, edges }
 *   Ready to dispatch as ADD_NODES actions.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { makeId, THEME_PALETTE, UNASSIGNED_COLOR } from '../context/GraphContext';

// ── Header normalization map ───────────────────────────────────────────────────
// Maps common variations of column names to canonical field names.
const HEADER_MAP = {
  'source':               'source',
  'source / participant': 'source',
  'participant':          'source',
  'quoted text':          'quote',
  'quote':                'quote',
  'text':                 'quote',
  'excerpt':              'quote',
  'code (comment)':       'code',
  'code':                 'code',
  'comment':              'code',
  'data code':            'code',
  'preliminary theme':    'theme',
  'theme':                'theme',
  'initial theme':        'theme',
};

/**
 * Normalize a raw header string to a canonical field name.
 * Returns null if not recognized.
 */
function normalizeHeader(raw) {
  if (!raw) return null;
  return HEADER_MAP[String(raw).toLowerCase().trim()] ?? null;
}

/**
 * Parse a File object (xlsx or csv) and return raw row objects.
 * Each row object has keys: source, quote, code, theme (any may be undefined).
 *
 * @param {File} file
 * @param {string} sheetName - optional sheet name for Excel files
 * @returns {Promise<Array<{source,quote,code,theme}>>}
 */
export async function parseFile(file, sheetName = null) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(file, sheetName);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .xlsx or .csv`);
  }
}

/** Parse CSV using PapaParse */
async function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(normalizeRows(result.data)),
      error: (err) => reject(new Error('CSV parse error: ' + err.message)),
    });
  });
}

/** Parse XLSX using the xlsx library */
async function parseXlsx(file, sheetName = null) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
  const worksheetData = workbook.Sheets[sheet];
  // Convert to array of arrays (raw rows)
  const raw = XLSX.utils.sheet_to_json(worksheetData, { header: 1, defval: null });

  if (raw.length < 2) return []; // No data rows

  // First row is headers
  const headers = raw[0].map(normalizeHeader);

  // Map each data row to a normalized object
  const rows = raw.slice(1)
    .filter(row => row.some(cell => cell !== null && cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        if (key) obj[key] = (row[i] != null && row[i] !== '') ? String(row[i]).trim() : null;
      });
      return obj;
    });

  return rows;
}

/**
 * Get sheet names from an Excel file without parsing data.
 * Returns array of sheet names.
 *
 * @param {File} file
 * @returns {Promise<Array<string>>}
 */
export async function getSheetNames(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

/**
 * Normalize rows from PapaParse (which uses the header row as keys).
 * Maps whatever column names exist to our canonical field names.
 */
function normalizeRows(rawRows) {
  return rawRows.map(raw => {
    const obj = {};
    Object.entries(raw).forEach(([key, val]) => {
      const canonical = normalizeHeader(key);
      if (canonical) obj[canonical] = (val != null && val !== '') ? String(val).trim() : null;
    });
    return obj;
  });
}

/**
 * Convert parsed rows into graph nodes and edges ready for GraphContext.
 *
 * BEHAVIOR:
 *   - One code node per row (skips rows with no 'code' field)
 *   - Theme nodes auto-created from unique 'theme' values in the data
 *   - Rows with no theme get color = UNASSIGNED_COLOR, primaryThemeId = null
 *   - New theme nodes are spread in a loose circle at canvas center
 *   - New code nodes are placed near their theme (with scatter)
 *
 * @param {Array} rows — output of parseFile()
 * @param {Array} existingThemeNodes — theme nodes already on canvas (to avoid duplicates)
 * @returns {{ codeNodes, themeNodes, edges, summary }}
 */
export function buildGraphFromRows(rows, existingThemeNodes = []) {
  // 1. Collect unique theme labels from the data
  const rawThemeLabels = [...new Set(
    rows
      .map(r => r.theme)
      .filter(t => t && t.trim())
  )];

  // 2. Build theme node map: label → node
  //    Reuse existing theme nodes where label matches (case-insensitive)
  const existingByLabel = {};
  existingThemeNodes.forEach(n => {
    existingByLabel[n.label.toLowerCase()] = n;
  });

  // Assign colors to new themes (continuing from where existing palette left off)
  const usedColors = new Set(existingThemeNodes.map(n => n.color));
  let paletteIdx = 0;
  function nextColor() {
    while (paletteIdx < THEME_PALETTE.length && usedColors.has(THEME_PALETTE[paletteIdx])) {
      paletteIdx++;
    }
    const color = THEME_PALETTE[paletteIdx] ?? THEME_PALETTE[THEME_PALETTE.length - 1];
    usedColors.add(color);
    paletteIdx++;
    return color;
  }

  // Canvas center for initial placement
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  const themeNodeMap = {}; // label → node
  const newThemeNodes = [];

  rawThemeLabels.forEach((label, i) => {
    const existing = existingByLabel[label.toLowerCase()];
    if (existing) {
      themeNodeMap[label] = existing;
    } else {
      // Spread new theme nodes in a circle around center
      const angle = (2 * Math.PI * i) / rawThemeLabels.length;
      const radius = 250;
      const node = {
        id: makeId('theme'),
        type: 'theme',
        label,
        color: nextColor(),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
      themeNodeMap[label] = node;
      newThemeNodes.push(node);
    }
  });

  // 3. Build code nodes and edges
  const codeNodes = [];
  const edges = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    // Skip rows with no code label
    if (!row.code || !row.code.trim()) {
      skipped++;
      return;
    }

    const themeLabel = row.theme?.trim() || null;
    const themeNode  = themeLabel ? themeNodeMap[themeLabel] : null;

    // Place code node near its theme with random scatter, or at canvas center
    const scatter = () => (Math.random() - 0.5) * 160;
    const baseX   = themeNode ? themeNode.x + scatter() : cx + scatter();
    const baseY   = themeNode ? themeNode.y + scatter() : cy + scatter();

    const codeNode = {
      id: makeId('code'),
      type: 'code',
      label: row.code.trim(),
      quote: row.quote?.trim() || '',
      source: row.source?.trim() || '',
      primaryThemeId: themeNode?.id ?? null,
      color: themeNode?.color ?? UNASSIGNED_COLOR,
      x: baseX,
      y: baseY,
    };

    codeNodes.push(codeNode);

    // Create edge if theme exists
    if (themeNode) {
      edges.push({
        id: `edge-${codeNode.id}-${themeNode.id}`,
        source: codeNode.id,
        target: themeNode.id,
      });
    }
  });

  return {
    codeNodes,
    themeNodes: newThemeNodes,
    edges,
    summary: {
      codeCount:  codeNodes.length,
      themeCount: newThemeNodes.length,
      assigned:   codeNodes.filter(n => n.primaryThemeId).length,
      unassigned: codeNodes.filter(n => !n.primaryThemeId).length,
      skipped,
    },
  };
}

/**
 * Generate a blank .xlsx template file for download.
 * Returns a Blob the browser can download.
 */
export function generateTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Source / Participant', 'Quoted Text', 'Code (Comment)', 'Preliminary Theme'],
    ['Interview_01.docx', 'Example quote from participant...', 'Example data code', 'Example Theme'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Coded Excerpts');
  const uint8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
