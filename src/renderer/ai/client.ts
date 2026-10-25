import type { Board, Tile } from '../engine'
import type { WorkerRequest, WorkerResponse } from './ai.worker'
import type { Move } from './movegen'

/** Promise wrapper around the move-generator worker (used by hints and the computer opponent). */
export class MoveFinder {
  private worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
  private nextId = 1
  private pending = new Map<number, { resolve: (m: Move[]) => void; reject: (e: Error) => void }>()
  private ready: Promise<void>

  constructor(words: string[]) {
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data
        if (msg.type === 'loaded') {
          resolve()
        } else if (msg.type === 'moves') {
          this.pending.get(msg.id)?.resolve(msg.moves)
          this.pending.delete(msg.id)
        } else if (msg.id !== undefined) {
          this.pending.get(msg.id)?.reject(new Error(msg.message))
          this.pending.delete(msg.id)
        } else {
          reject(new Error(msg.message)) // word list failed to load
        }
      }
    })
    this.ready.catch(() => undefined) // surfaced through find(); avoid an unhandled rejection
    this.post({ type: 'load', words })
  }

  private post(request: WorkerRequest): void {
    this.worker.postMessage(request)
  }

  /** Make a custom word legal for later searches. */
  addWords(words: string[]): void {
    this.post({ type: 'add-words', words })
  }

  /** All legal moves for the rack, best first (optionally only the top `limit`). */
  async find(board: Board, rack: Tile[], limit?: number): Promise<Move[]> {
    await this.ready
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.post({ type: 'moves', id, board, rack, limit })
    })
  }

  terminate(): void {
    this.worker.terminate()
    for (const p of this.pending.values()) p.reject(new Error('Move finder stopped'))
    this.pending.clear()
  }
}
