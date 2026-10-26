import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Runs the PACKAGED game from a fresh copy in a temp folder: this is also the "move the folder" check,
// and it keeps real scores in `Word Rumble/data/` out of the test. Run `pnpm package` first.
const packaged = join(process.cwd(), 'Word Rumble')
let home = ''

test.beforeAll(() => {
  test.skip(!existsSync(join(packaged, 'Word Rumble.exe')), 'run `pnpm package` first')
  home = mkdtempSync(join(tmpdir(), 'word-rumble-e2e-'))
  cpSync(packaged, home, { recursive: true, filter: (src) => !/[\/]data([\/]|$)/.test(src.slice(packaged.length)) })
})

test.afterAll(() => {
  try { if (home) rmSync(home, { recursive: true, force: true }) } catch { /* exe still releasing; temp folder */ }
})

const launch = async (): Promise<{ app: ElectronApplication; page: Page }> => {
  const app = await electron.launch({ executablePath: join(home, 'Word Rumble.exe') })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

test('play, hidden racks, save, relaunch, defeat, notebook', async () => {
  let { app, page } = await launch()

  // First launch from a new folder offers a desktop shortcut: decline it.
  await page.getByRole('button', { name: /No thanks|Not now/ }).click()

  // Title -> Setup with the default names -> Start.
  await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
  await expect(page.locator('input[type=text]').first()).toHaveValue('Shane')
  await expect(page.locator('input[type=text]').nth(1)).toHaveValue('Dawn')
  await page.getByRole('button', { name: 'Start!' }).click()

  // Shuffle the bag, first draw, deal.
  await page.getByRole('button', { name: 'Shake the tile bag' }).dispatchEvent('click')
  await page.getByRole('button', { name: 'Deal the tiles' }).click({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue' }).click({ timeout: 60_000 })

  // Hand-off: face-down, no letters anywhere in the DOM until "Let's go!".
  await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible()
  expect(await page.locator('.wr-tile__letter').count()).toBe(0)
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click')
  await expect(page.locator('[data-rack-slot]').first()).toBeVisible()
  expect(await page.locator('.wr-tile__letter').count()).toBeGreaterThanOrEqual(7)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/play-screen.png' })

  // Pause freezes play; Save & quit goes to the title with Continue enabled.
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await page.getByRole('button', { name: /Save & quit/ }).click()
  await expect(page.getByRole('button', { name: 'Continue Game' })).toBeEnabled()

  // Relaunch: the autosave is still there and Continue goes back through the hand-off (letters hidden).
  await app.close()
  ;({ app, page } = await launch())
  await expect(page.getByRole('button', { name: 'Continue Game' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue Game' }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible()
  expect(await page.locator('.wr-tile__letter').count()).toBe(0)
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click')

  // Admit defeat -> Game over -> notebook.
  await page.getByRole('button', { name: 'Admit defeat' }).click()
  await page.getByRole('button', { name: 'I give up' }).click()
  await page.getByRole('button', { name: 'Write it in the notebook' }).click({ timeout: 30_000 })
  await expect(page.getByText('Recent Games').first()).toBeVisible()

  // Everything the game wrote is inside its own folder.
  expect(existsSync(join(home, 'data', 'word-rumble.sqlite'))).toBe(true)
  await app.close()
})
