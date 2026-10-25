import { contextBridge } from 'electron'

// The real API (scores, words, saved game, settings, openLookup) arrives in Phase 7.
contextBridge.exposeInMainWorld('wordRumble', {})
