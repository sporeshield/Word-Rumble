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
  cpSync(packaged, home, { recursive: true, filter: (src) => !/[\\/]data([\\/]|$)/.test(src.slice(packaged.length)) })
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

  // A new folder may offer a desktop shortcut (depends on this machine's shortcut): decline it if shown.
  await page.getByRole('button', { name: /No thanks|Not now/ }).click({ timeout: 8_000 }).catch(() => {})

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
  expect(await page.locator('.wr-rack:last-child .wr-tile:not(.wr-tile--back)').count()).toBe(7)
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

test('three players: drop out with a gift, play carries on, ranking in the notebook', async () => {
  const { app, page } = await launch()
  await page.getByRole('button', { name: /No thanks|Not now/ }).click({ timeout: 8_000 }).catch(() => {})
  // The previous test left a save behind; "New Game" starts afresh.
  await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
  await page.getByRole('group', { name: 'Game mode' }).getByRole('button', { name: 'Friends' }).click()
  await page.getByRole('group', { name: 'How many players' }).getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Start!' }).click()
  await page.getByRole('button', { name: 'Shake the tile bag' }).dispatchEvent('click')
  await page.getByRole('button', { name: 'Deal the tiles' }).click({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue' }).click({ timeout: 60_000 })

  // Hand-off: no letters in the DOM, then the first player's rack, and only two other plates.
  await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible()
  expect(await page.locator('.wr-tile__letter').count()).toBe(0)
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click')
  await expect(page.locator('.wr-play__plate')).toHaveCount(2)

  // First player drops out and gives their points to the first other player.
  await page.getByRole('button', { name: 'Drop out' }).click()
  const picker = page.getByRole('alertdialog', { name: 'Drop out' })
  await expect(picker).toBeVisible()
  expect(await page.locator('.wr-tile__letter').count()).toBe(0)
  await picker.locator('.wr-recipients__plate').first().click()

  // Play carries on: next player's hand-off, with one plate marked as dropped out.
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 15_000 })
  await expect(page.locator('.wr-play__plate--out')).toHaveCount(1)

  // Second player drops out too: one left standing, Game over with a podium.
  await page.getByRole('button', { name: 'Drop out' }).click()
  await page.getByRole('alertdialog', { name: 'Drop out' }).getByRole('button', { name: 'Nobody' }).click()
  await expect(page.getByText('Last player standing!')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.wr-gameover__place')).toHaveCount(3)
  await page.getByRole('button', { name: 'Write it in the notebook' }).click()
  await expect(page.getByText('Recent Games').first()).toBeVisible()
  await app.close()
})
