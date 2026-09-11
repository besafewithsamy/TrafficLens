import { expect, test } from '@playwright/test'

/**
 * Graph regression test: every edge type found in the capture — including
 * unknown ones like C2-PORT — must render by default and get its own toggle.
 */
test('graph renders all edge types with dynamic filter toggles', async ({ page }) => {
  // The smoke test data (c2_beacon) is already in the DB; reuse the latest analyzed capture
  await page.goto('/graph')

  // Graph canvas renders nodes (cytoscape creates canvas elements)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })

  // The legend must list the unknown edge type c2-port with its count —
  // this is the type that was silently dropped by the old hardcoded filter
  await expect(page.getByText('c2-port', { exact: true })).toBeVisible({ timeout: 30_000 })

  // Default state: hosts always render (2 hosts + 1 service node + 2 edges)
  await expect(page.getByText('5 shown', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Toggling c2-port off removes its edge + dangling service is unaffected (hosts stay)
  await page.getByText('c2-port', { exact: true }).click()
  await expect(page.getByText('4 shown', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Toggling it back on restores the full graph
  await page.getByText('c2-port', { exact: true }).click()
  await expect(page.getByText('5 shown', { exact: true })).toBeVisible({ timeout: 15_000 })
})
