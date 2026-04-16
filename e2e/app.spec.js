/**
 * E2E tests — Thematic Analysis App
 *
 * Covers:
 *   1. Initial load & empty state
 *   2. Add theme node
 *   3. Add code node
 *   4. Connect mode (code → theme)
 *   5. Context menu: edit code node
 *   6. Context menu: edit theme node
 *   7. Delete a code node via context menu
 *   8. Delete a theme node (unassigns codes)
 *   9. CSV import flow
 *  10. Physics panel open/close
 *  11. Fit View
 *  12. Clear canvas
 *  13. LocalStorage persistence
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Clear localStorage before each test so we start fresh */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Wait for the app shell to be fully mounted
  await page.waitForSelector('text=ThematicMap', { timeout: 10_000 });
});

// Helpers to read the status bar counters
async function statusCounts(page) {
  const bar = page.locator('.border-t-2');
  const text = await bar.innerText();
  const codes      = parseInt(text.match(/(\d+)\s*codes/)?.[1] ?? '0', 10);
  const themes     = parseInt(text.match(/(\d+)\s*themes/)?.[1] ?? '0', 10);
  const unassigned = parseInt(text.match(/(\d+)\s*unassigned/)?.[1] ?? '0', 10);
  return { codes, themes, unassigned };
}

// ── 1. Initial load ────────────────────────────────────────────────────────

test('1 — app loads with empty canvas', async ({ page }) => {
  // Toolbar is visible
  await expect(page.getByText('ThematicMap')).toBeVisible();
  await expect(page.getByRole('button', { name: /Import/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Theme/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Code/i })).toBeVisible();

  // Status bar shows zeroes
  const { codes, themes, unassigned } = await statusCounts(page);
  expect(codes).toBe(0);
  expect(themes).toBe(0);
  expect(unassigned).toBe(0);

  // Canvas area exists
  await expect(page.locator('#canvas-export-target')).toBeVisible();
});

// ── 2. Add theme node ──────────────────────────────────────────────────────

test('2 — add a theme node', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click();

  // Status bar updates
  const { themes } = await statusCounts(page);
  expect(themes).toBe(1);

  // A theme node should appear on canvas with role=button (ThemeNode)
  const themeNode = page.locator('[role="button"][aria-label*="theme"]');
  await expect(themeNode).toBeVisible({ timeout: 3000 });
});

// ── 3. Add code node ───────────────────────────────────────────────────────

test('3 — add a code node', async ({ page }) => {
  await page.getByRole('button', { name: /Add Code/i }).click();

  const { codes, unassigned } = await statusCounts(page);
  expect(codes).toBe(1);
  expect(unassigned).toBe(1); // no theme assigned yet
});

// ── 4. Connect mode ────────────────────────────────────────────────────────

test('4 — connect code to theme assigns primary theme', async ({ page }) => {
  // Create both nodes
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();

  // Enter connect mode
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByRole('button', { name: /Cancel Connect/i })).toBeVisible();

  // Click code node (source), then theme node (target)
  const codeNode  = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();

  await codeNode.click({ force: true });
  await themeNode.click({ force: true });

  // Cancel connect mode
  await page.getByRole('button', { name: /Cancel Connect/i }).click();

  // Unassigned should drop to 0
  const { unassigned } = await statusCounts(page);
  expect(unassigned).toBe(0);

  // Edge should be rendered in SVG
  const edges = page.locator('#edges line');
  await expect(edges).toHaveCount(1);
});

// ── 5. Context menu: edit code node ────────────────────────────────────────

test('5 — right-click code opens context menu and edit modal', async ({ page }) => {
  await page.getByRole('button', { name: /Add Code/i }).click();

  // Right-click the code node
  const codeNode = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  await codeNode.click({ button: 'right', force: true });

  // Context menu appears
  const editBtn = page.getByRole('menuitem', { name: /Rename.*Edit Code/i });
  await expect(editBtn).toBeVisible({ timeout: 3000 });
  await editBtn.click();

  // Edit modal opens
  await expect(page.getByText('Edit Code Node')).toBeVisible();
  const labelInput = page.locator('input[placeholder*="code label"]');
  await labelInput.fill('Renamed Code');
  await page.getByRole('button', { name: 'Save' }).click();

  // Modal closes, node label updated
  await expect(page.getByText('Edit Code Node')).not.toBeVisible();
});

// ── 6. Context menu: edit theme node ───────────────────────────────────────

test('6 — right-click theme opens edit modal with color picker', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click();

  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();
  await themeNode.click({ button: 'right', force: true });

  const editBtn = page.getByRole('menuitem', { name: /Rename.*Edit Theme/i });
  await expect(editBtn).toBeVisible({ timeout: 3000 });
  await editBtn.click();

  // Theme edit modal opens
  await expect(page.getByText('Edit Theme')).toBeVisible();
  await expect(page.locator('input[type="color"]')).toBeVisible();

  // Rename and save
  const labelInput = page.locator('input[placeholder*="theme name"]');
  await labelInput.fill('Cognitive Patterns');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Edit Theme')).not.toBeVisible();
});

// ── 7. Delete code node via context menu ──────────────────────────────────

test('7 — delete code node from context menu', async ({ page }) => {
  await page.getByRole('button', { name: /Add Code/i }).click();
  expect((await statusCounts(page)).codes).toBe(1);

  const codeNode = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  await codeNode.click({ button: 'right', force: true });

  // Accept confirm dialog
  page.on('dialog', d => d.accept());

  const deleteBtn = page.getByRole('menuitem', { name: /Delete Node/i });
  await expect(deleteBtn).toBeVisible({ timeout: 3000 });
  await deleteBtn.click();

  // Code count drops to 0
  await expect(async () => {
    expect((await statusCounts(page)).codes).toBe(0);
  }).toPass({ timeout: 3000 });
});

// ── 8. Delete theme (codes become unassigned) ─────────────────────────────

test('8 — deleting a theme unassigns connected codes', async ({ page }) => {
  // Setup: theme + code + connect
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();

  // Connect them
  await page.getByRole('button', { name: /Connect/i }).click();
  const codeNode  = page.locator('.nodes-layer > div').filter({ hasNotText: /✓/ }).first();
  const themeNode = page.locator('[role="button"][aria-label*="theme"]').first();
  await codeNode.click({ force: true });
  await themeNode.click({ force: true });
  await page.getByRole('button', { name: /Cancel Connect/i }).click();

  expect((await statusCounts(page)).unassigned).toBe(0);

  // Delete theme via context menu
  page.on('dialog', d => d.accept());
  await themeNode.click({ button: 'right', force: true });
  const deleteBtn = page.getByRole('menuitem', { name: /Delete Theme/i });
  await expect(deleteBtn).toBeVisible({ timeout: 3000 });
  await deleteBtn.click();

  // Theme gone, code becomes unassigned
  await expect(async () => {
    const s = await statusCounts(page);
    expect(s.themes).toBe(0);
    expect(s.codes).toBe(1);
    expect(s.unassigned).toBe(1);
  }).toPass({ timeout: 3000 });
});

// ── 9. CSV import ──────────────────────────────────────────────────────────

test('9 — import CSV creates code and theme nodes', async ({ page }) => {
  await page.getByRole('button', { name: /Import/i }).click();
  await expect(page.getByText('Import Data')).toBeVisible();

  // Upload the sample CSV via the hidden file input
  const csvPath = path.resolve(__dirname, '..', 'docs', 'samples', 'thematic-import-sample.csv');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(csvPath);

  // Step 2: Preview appears
  await expect(page.getByText('Preview Import')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('thematic-import-sample.csv')).toBeVisible();

  // Confirm import
  await page.getByRole('button', { name: /Confirm Import/i }).click();

  // Modal closes
  await expect(page.getByText('Preview Import')).not.toBeVisible({ timeout: 3000 });

  // Status bar reflects imported data:
  // 10 code rows (1 has empty theme → unassigned), 7 unique themes
  await expect(async () => {
    const s = await statusCounts(page);
    expect(s.codes).toBe(10);
    expect(s.themes).toBeGreaterThanOrEqual(7);
    expect(s.unassigned).toBe(1);
  }).toPass({ timeout: 5000 });
});

// ── 10. Physics panel ──────────────────────────────────────────────────────

test('10 — physics panel opens and closes', async ({ page }) => {
  // Open
  await page.getByRole('button', { name: /Physics/i }).click();
  await expect(page.getByText('Physics Controls')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Link Distance')).toBeVisible();

  // Wait for the 0.25s slide-in CSS transition to finish before clicking
  await page.waitForTimeout(300);

  // Close via close button
  const closeBtn = page.locator('button:has-text("✕")').last();
  await closeBtn.click();
  await expect(page.getByText('Physics Controls')).not.toBeVisible({ timeout: 3000 });
});

// ── 11. Fit View ───────────────────────────────────────────────────────────

test('11 — fit view does not crash on empty canvas', async ({ page }) => {
  // Should be a no-op, just verify no errors
  await page.getByRole('button', { name: /Fit View/i }).click();
  // App still functional
  await expect(page.getByText('ThematicMap')).toBeVisible();
});

// ── 12. Clear canvas ───────────────────────────────────────────────────────

test('12 — clear canvas resets all nodes', async ({ page }) => {
  // Add some content
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();
  expect((await statusCounts(page)).codes).toBe(1);

  // Accept the confirm dialog
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: /Clear/i }).click();

  await expect(async () => {
    const s = await statusCounts(page);
    expect(s.codes).toBe(0);
    expect(s.themes).toBe(0);
  }).toPass({ timeout: 3000 });
});

// ── 13. LocalStorage persistence ───────────────────────────────────────────

test('13 — graph state persists across page reload', async ({ page }) => {
  await page.getByRole('button', { name: /Add Theme/i }).click();
  await page.getByRole('button', { name: /Add Code/i }).click();
  expect((await statusCounts(page)).codes).toBe(1);

  // Wait until the save useEffect has flushed to localStorage
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('thematic_analysis_graph_v1');
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.nodes && data.nodes.length >= 2;
  }, { timeout: 5000 });

  // Reload the page
  await page.reload();
  await page.waitForSelector('text=ThematicMap', { timeout: 10_000 });

  // State should be restored
  await expect(async () => {
    const s = await statusCounts(page);
    expect(s.codes).toBe(1);
    expect(s.themes).toBe(1);
  }).toPass({ timeout: 5000 });
});
