import { contextBridge, ipcRenderer } from 'electron'
import type { WordRumbleApi } from '../shared/api'

const call =
  <T>(channel: string) =>
  (...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(`wr:${channel}`, ...args)

const api: WordRumbleApi = {
  words: { check: call('words:check'), add: call('words:add'), all: call('words:all'), clearCustom: call('words:clearCustom') },
  scores: {
    record: call('scores:record'),
    top: call('scores:top'),
    headToHead: call('scores:headToHead'),
    bestPlays: call('scores:bestPlays'),
    recent: call('scores:recent'),
    hallOfShame: call('scores:hallOfShame'),
    reset: call('scores:reset')
  },
  savedGame: { load: call('savedGame:load'), save: call('savedGame:save'), clear: call('savedGame:clear') },
  settings: { get: call('settings:get'), set: call('settings:set'), delete: call('settings:delete') },
  sounds: { list: call('sounds:list'), read: call('sounds:read') },
  shortcut: { status: call('shortcut:status'), create: call('shortcut:create'), decline: call('shortcut:decline') },
  openLookup: call('openLookup'),
  quit: call('quit')
}

contextBridge.exposeInMainWorld('wordRumble', api)
