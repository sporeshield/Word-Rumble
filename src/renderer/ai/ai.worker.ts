import type { Board, Premium, Tile } from '../engine'
import { generateMoves, type Move } from './movegen'
import { Trie } from './trie'

/** Messages to the worker. Send `load` once (word list + custom words), then any number of `moves`. */
export type WorkerRequest =
  | { type: 'load'; words: string[] }
  | { type: 'add-words'; words: string[] }
  | { type: 'moves'; id: number; board: Board; rack: Tile[]; limit?: number; layout?: Premium[][] }

export type WorkerResponse =
  | { type: 'loaded'; count: number }
  | { type: 'moves'; id: number; moves: Move[] }
  | { type: 'error'; id?: number; message: string }

interface WorkerScope {
  postMessage(message: WorkerResponse): void
  onmessage: ((event: { data: WorkerRequest }) => void) | null
}
const scope = self as unknown as WorkerScope

let trie = new Trie()

scope.onmessage = ({ data }) => {
  try {
    if (data.type === 'load') {
      trie = new Trie(data.words)
      scope.postMessage({ type: 'loaded', count: data.words.length })
    } else if (data.type === 'add-words') {
      for (const w of data.words) trie.insert(w)
    } else {
      const moves = generateMoves(data.board, data.rack, trie, data.layout)
      scope.postMessage({ type: 'moves', id: data.id, moves: data.limit !== undefined ? moves.slice(0, data.limit) : moves })
    }
  } catch (err) {
    scope.postMessage({ type: 'error', id: 'id' in data ? data.id : undefined, message: String(err) })
  }
}
