import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { setupPortablePaths } from './paths'

setupPortablePaths()

function createWindow(): void {
  const win = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#1b1340',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setMenuBarVisibility(false)

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    // WR_PAGE=soundboard.html opens a dev page (gallery, soundboard) instead of the game.
    void win.loadURL(new URL(process.env['WR_PAGE'] ?? '', process.env['ELECTRON_RENDERER_URL'] + '/').href)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await registerIpc()
  createWindow()
})
app.on('window-all-closed', () => app.quit())
