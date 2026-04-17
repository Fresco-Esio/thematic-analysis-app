const { test, expect } = require('@playwright/test');

test('debug: check node rendering', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#canvas-export-target')).toBeVisible();
  
  console.log('=== Clicking Add Theme ===');
  await page.getByRole('button', { name: /Add Theme/i }).click();
  
  // Wait a bit for animation
  await page.waitForTimeout(1000);
  
  // Check what buttons are in the DOM
  const buttons = await page.locator('button').count();
  console.log(`Total buttons in DOM: ${buttons}`);
  
  // Check buttons with role=button
  const roleButtons = await page.locator('[role="button"]').count();
  console.log(`Buttons with role="button": ${roleButtons}`);
  
  // Get all aria-labels
  const labels = await page.locator('[aria-label]').count();
  console.log(`Elements with aria-label: ${labels}`);
  
  // Try to find the specific node
  const nodeButtons = await page.locator('[role="button"][aria-label*="theme"]').count();
  console.log(`Buttons with theme aria-label: ${nodeButtons}`);
  
  // Try broader selector
  const allGraphNodes = await page.locator('.graph-node').count();
  console.log(`Elements with graph-node class: ${allGraphNodes}`);
  
  // Check visibility of elements
  const html = await page.content();
  if (html.includes('graph-node')) {
    console.log('graph-node class found in HTML');
  }
  if (html.includes('New Theme')) {
    console.log('New Theme text found in HTML');
  }
  
  // Take a screenshot for visual inspection
  await page.screenshot({ path: 'debug-screenshot.png' });
});
