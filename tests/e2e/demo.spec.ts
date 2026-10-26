import { _electron as electron, test, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Audible demo: plays a slow vs-Computer game on the PACKAGED game (temp copy) so you can hear the sounds.
// Run `pnpm package` first, then `WR_DEMO=1 pnpm exec playwright test demo`. Skipped otherwise.
const packaged = join(process.cwd(), 'Word Rumble')
const say = (s: string) => console.log(`>> ${s}`)
const beat = (page: Page, ms = 1800) => page.waitForTimeout(ms)

test('audible demo game vs Computer', async () => {
  test.skip(!process.env.WR_DEMO || !existsSync(join(packaged, 'Word Rumble.exe')), 'WR_DEMO=1 and `pnpm package` needed')
  test.setTimeout(600_000)
  const home = mkdtempSync(join(tmpdir(), 'word-rumble-demo-'))
  cpSync(packaged, home, { recursive: true, filter: (src) => !/[\\/]data([\\/]|$)/.test(src.slice(packaged.length)) })
  const app = await electron.launch({ executablePath: join(home, 'Word Rumble.exe') })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: /No thanks|Not now/ }).click({ timeout: 6_000 }).catch(() => {})
  const choose = (group: string, name: string | RegExp) => page.getByRole('group', { name: group, exact: true }).getByRole('button', { name }).click()

  say('Title and setup clicks')
  await beat(page)
  await page.getByRole('button', { name: 'New Game' }).hover()
  await beat(page, 800)
  await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
  await choose('Game mode', 'vs Computer')
  await beat(page, 800)
  await choose('Computer difficulty', 'medium')
  await beat(page, 800)
  await choose('Board', 'Wild')
  await beat(page, 800)
  await choose('Turn timer', 'Custom')
  await page.locator('input[type=number]').fill('20')
  await page.locator('input[type=number]').blur()
  await choose('Hints', /Costs/)
  await choose('Shuffle', /Costs/)
  await choose('Swap', /Costs/)
  await beat(page)

  say('Shake the bag, deal')
  await page.getByRole('button', { name: 'Start!' }).click()
  await page.getByRole('button', { name: 'Shake the tile bag' }).dispatchEvent('click')
  await beat(page, 3500)
  await page.getByRole('button', { name: 'Deal the tiles' }).click({ timeout: 60_000 })
  await beat(page, 3000)
  await page.getByRole('button', { name: 'Continue' }).click({ timeout: 60_000 })
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 30_000 }).catch(() => {})
  say('Power squares reveal')
  await beat(page, 4000)

  say('Drag tiles onto the board, recall, reorder')
  const drag = async (slot: number, row: number, col: number) => {
    const from = await page.locator(`[data-rack-slot="${slot}"]`).boundingBox()
    const to = await page.locator(`[data-row="${row}"][data-col="${col}"]`).boundingBox()
    if (!from || !to) return
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
    await page.mouse.up()
    await beat(page, 900)
  }
  await drag(0, 7, 7)
  await drag(0, 7, 8)
  await drag(0, 7, 9)
  await page.getByRole('button', { name: /Recall|Take back/ }).first().click().catch(() => {})
  await beat(page)

  say('Shuffle (penalty quote)')
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await beat(page, 3500)
  await page.getByRole('alertdialog').first().getByRole('button', { name: /^Shuffle/ }).click().catch(() => {})
  await beat(page, 2500)

  say('Hint (penalty quote, decline)')
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  await beat(page, 3500)
  await page.getByRole('alertdialog').first().getByRole('button', { name: 'No thanks' }).click().catch(() => {})
  await beat(page, 1500)

  say('Pause and resume')
  await page.keyboard.press('Escape')
  await beat(page, 2000)
  await page.keyboard.press('Escape')
  await beat(page, 2000)

  say('Let the timer run out: nervous countdown and BOOM')
  await page.getByText(/BOOM/i).first().waitFor({ timeout: 40_000 })
  await beat(page, 4000)

  say('Computer takes its turn; we pass a couple of rounds')
  for (let turn = 0; turn < 3; turn++) {
    await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 4_000 }).catch(() => {})
    const pass = page.getByRole('button', { name: 'Pass', exact: true })
    await pass.waitFor({ timeout: 60_000 })
    await beat(page, 1500)
    await pass.click()
    await beat(page, 6000)
  }

  say('Admit defeat, Game over, notebook')
  await page.getByRole('button', { name: "Let's go!" }).dispatchEvent('click', undefined, { timeout: 4_000 }).catch(() => {})
  await page.getByRole('button', { name: 'Admit defeat' }).click({ timeout: 60_000 })
  await beat(page, 1500)
  await page.getByRole('button', { name: 'I give up' }).click()
  await beat(page, 8000)
  await page.getByRole('button', { name: 'Write it in the notebook' }).click({ timeout: 30_000 })
  await beat(page, 4000)
  say('Done')
  await app.close()
  try { rmSync(home, { recursive: true, force: true }) } catch { /* exe still releasing */ }
})
