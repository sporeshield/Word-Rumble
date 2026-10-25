import type { WordRumbleApi } from '../shared/api'

declare global {
  interface Window {
    wordRumble: WordRumbleApi
  }
}

export {}
