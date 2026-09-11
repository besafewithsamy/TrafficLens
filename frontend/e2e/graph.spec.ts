import { expect, test } from '@playwright/test'

/**
 * Graph tier regression tests.
 * 1. Small capture: every edge type renders by default — including unknown
 *    ones like C2-PORT that the old hardcoded filter silently dropped.
 * 2. Large capture: the graph switches to the scale tier (leaf domains
 *    collapsed, selective labels) and stays interactive.
 */

test('small graph renders all edge types with dynamic filter toggles', async ({ page }) => {
  await page.goto('/graph')

  // pick the small c2_beacon capture explicitly (newest may be a large one)
  await page.getByLabel('Select capture').selectOption({ label: 'c2_beacon.pcap' })

  // Graph canvas renders nodes (cytoscape creates canvas elements)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })

  // The legend must list the unknown edge type c2-port with its count —
  // this is the type that was silently dropped by the old hardcoded filter
  await expect(page.getByText('c2-port', { exact: true })).toBeVisible({ timeout: 30_000 })

  // Default state: hosts always render (2 hosts + 1 service node + 2 edges)
  await expect(page.getByText('5 shown', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Toggling c2-port off removes its edge (hosts stay)
  await page.getByText('c2-port', { exact: true }).click()
  await expect(page.getByText('4 shown', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Toggling it back on restores the full graph
  await page.getByText('c2-port', { exact: true }).click()
  await expect(page.getByText('5 shown', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('large graph switches to scale tier and stays interactive', async ({ page }) => {
  await page.goto('/graph')

  await page.getByLabel('Select capture').selectOption({ label: 'large_graph.pcap' })

  // scale tier badge appears in the header
  await expect(page.getByText('scale', { exact: true })).toBeVisible({ timeout: 30_000 })

  // leaf-only domains are auto-collapsed with an override button
  const showLeaves = page.getByText(/leaf domains hidden — show/)
  await expect(showLeaves).toBeVisible({ timeout: 30_000 })

  // graph canvas renders and is interactive (zoom via mouse wheel)
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  // override: show leaf domains → the button disappears, element count grows
  const countBefore = parseInt(((await page.getByText(/\d+ shown/).textContent()) ?? '0').replace(/\D/g, ''))
  await showLeaves.click()
  await expect(page.getByText(/leaf domains hidden — show/)).toBeHidden({ timeout: 15_000 })
  const countAfter = parseInt(((await page.getByText(/\d+ shown/).textContent()) ?? '0').replace(/\D/g, ''))
  expect(countAfter).toBeGreaterThan(countBefore)
})
