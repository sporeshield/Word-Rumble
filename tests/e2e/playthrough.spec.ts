import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Manual-checklist play-through on the PACKAGED game, in a temp copy, with the network dead
// (proxy points at a closed port) and every http(s) request logged: the offline check.
// Run `pnpm package` first. Set WR_KEEP=1 to keep the temp folder (its path is printed).
const packaged = join(process.cwd(), 'Word Rumble')
let home = ''
const requests: string[] = []

test.beforeAll(() => {
  test.skip(!existsSync(join(packaged, 'Word Rumble.exe')), 'run `pnpm package` first')
  home = mkdtempSync(join(tmpdir(), 'word-rumble-play-'))
  cpSync(packaged, home, { recursive: true, filter: (src) => !/[\\/]data([\\/]|$)/.test(src.slice(packaged.length)) })
})

test.afterAll(() => {
  console.log(`temp copy: ${home}`)
  if (process.env.WR_KEEP) return
  try { if (home) rmSync(home, { recursive: true, force: true }) } catch { /* exe still releasing */ }
})

const launch = async (): Promise<{ app: ElectronApplication; page: Page }> => {
  const app = await electron.launch({ executablePath: join(home, 'Word Rumble.exe'), args: ['--proxy-server=127.0.0.1:9'] })
  await app.evaluate(({ session }, log) => {
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
      if (/^https?:/.test(details.url)) console.log(`NET ${details.url}`)
      cb({})
    })
    void log
  }, null)
  app.process().stdout?.on('data', (d) => { for (const l of String(d).split('\n')) if (l.startsWith('NET ')) requests.push(l) })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  page.on('pageerror', (e) => console.log(`PAGE ERROR ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') console.log(`CONSOLE ERROR ${m.text()}`) })
  await page.getByRole('button', { name: /No thanks|Not now/ }).click({ timeout: 6_000 }).catch(() => {})
  return { app, page }
}

const choose = (page: Page, group: string, name: string | RegExp) =>
  page.getByRole('group', { name: group, exact: true }).getByRole('button', { name }).click()

const startToHandoff = async (page: Page) => {
  await page.getByRole('button', { name: 'Start!' }).click()
  await page.getByRole('button', { name: 'Shake the tile bag' }).dispatchEvent('click')
  const draw = page.getByRole('button', { name: 'Reveal' })
  void draw
  await page.getByRole('button', { name: 'Deal the tiles' }).click({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue' }).click({ timeout: 60_000 })
}

const letsGo = async (page: Page) => {
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 30_000 })
}

test('4 players, Wild board, 15 s timer, penalties, BOOM, drop-outs', async () => {
  test.setTimeout(240_000)
  const { app, page } = await launch()
  await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
  await choose(page, 'Game mode', 'Friends')
  await choose(page, 'How many players', '4')
  await choose(page, 'Board', 'Wild')
  await choose(page, 'Turn timer', 'Custom')
  await page.locator('input[type=number]').fill('15')
  await page.locator('input[type=number]').blur()
  await choose(page, 'Hints', /Costs/)
  await choose(page, 'Shuffle', /Costs/)
  await choose(page, 'Swap', /Costs/)
  await page.screenshot({ path: 'test-results/pt-setup.png' })
  await startToHandoff(page)

  expect(await page.locator('.wr-tile__letter').count()).toBe(0)
  await letsGo(page)
  await expect(page.locator('.wr-play__plate')).toHaveCount(3)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/pt-wild-4p.png' })
  const powerSquares = await page.locator('[class*="wr-square--pl5"], [class*="wr-square--pl10"], [class*="wr-square--qw"], [class*="wr-square--pw5"], [class*="wr-square--pw10"]').count()
  expect(powerSquares).toBeGreaterThan(0)

  // Penalties: Hint, Shuffle, Swap each quote a cost first.
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const hintDlg = page.getByRole('alertdialog').first()
  await expect(hintDlg.getByText(/−\d+ points?/)).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: 'test-results/pt-hint-quote.png' })
  await hintDlg.getByRole('button', { name: 'No thanks' }).click()

  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  const shuf = page.getByRole('alertdialog').first()
  await expect(shuf.getByText(/−\d+ points?/)).toBeVisible({ timeout: 15_000 })
  await shuf.getByRole('button', { name: /^Shuffle/ }).click()

  await page.getByRole('button', { name: 'Swap', exact: true }).click()
  const swap = page.getByRole('alertdialog').first()
  await expect(swap.getByText(/−\d+ points?/)).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: 'test-results/pt-swap-quote.png' })
  await swap.getByRole('button', { name: 'No thanks' }).click()

  // Let the 15 s timer run out: nervous countdown, then BOOM, then the next player's hand-off.
  await expect(page.getByText(/BOOM/i).first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: 'test-results/pt-boom.png' })
  await expect(page.getByRole('button', { name: "Let's go!" })).toBeVisible({ timeout: 20_000 })
  expect(await page.locator('.wr-tile__letter').count()).toBe(0)

  // Everybody else passes round, then three players drop out one by one.
  await letsGo(page)
  await page.getByRole('button', { name: 'Pass', exact: true }).click()
  await letsGo(page)
  await page.getByRole('button', { name: 'Pass', exact: true }).click()
  await letsGo(page)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Drop out' }).click()
    await page.getByRole('alertdialog', { name: 'Drop out' }).getByRole('button', { name: 'Nobody' }).click()
    if (i < 2) await letsGo(page)
  }
  await expect(page.getByText('Last player standing!')).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: 'test-results/pt-gameover-4p.png' })
  await app.close()
})

for (const level of ['easy', 'medium', 'hard'] as const) {
  test(`vs Computer (${level}): computer plays, then game over is recorded`, async () => {
    test.setTimeout(180_000)
    const { app, page } = await launch()
    await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
    await choose(page, 'Game mode', 'vs Computer')
    await choose(page, 'Computer difficulty', level)
    await startToHandoff(page)
    await letsGo(page).catch(() => {})
    for (let turn = 0; turn < 2; turn++) {
      await page.getByRole('button', { name: 'Pass', exact: true }).click({ timeout: 60_000 })
      // The computer thinks, then it is our turn again (no hand-off in this mode, or a plain "Let's go!").
      await expect(page.getByText(/Computer (played|passed|swapped)/).first()).toBeVisible({ timeout: 60_000 })
      await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 4_000 }).catch(() => {})
      await expect(page.getByRole('button', { name: 'Pass', exact: true })).toBeEnabled({ timeout: 30_000 })
    }
    const computerTiles = await page.locator('.wr-board .wr-tile').count()
    console.log(`${level}: ${computerTiles} tiles on board after 2 computer turns`)
    await page.screenshot({ path: `test-results/pt-computer-${level}.png` })
    await page.getByRole('button', { name: 'Admit defeat' }).click()
    await page.getByRole('button', { name: 'I give up' }).click()
    await page.getByRole('button', { name: 'Write it in the notebook' }).click({ timeout: 30_000 })
    await expect(page.getByText('Recent Games').first()).toBeVisible()
    await app.close()
  })
}

test('offline: no internet request was attempted', () => {
  console.log(`network requests seen: ${requests.length}`, requests.slice(0, 5))
  expect(requests).toEqual([])
})
