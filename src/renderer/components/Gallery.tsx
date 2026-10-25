import { useState } from 'react'
import { createBoard, TILE_POINTS, type Placement, type Tile as GameTile } from '../engine'
import { Board, DragLayer, GhostTiles, Rack, useTileDrag } from './index'

let nextDemoId = 1000
const demoTile = (letter: string): GameTile => ({ id: nextDemoId++, letter, points: TILE_POINTS[letter] })
const initialBoard = createBoard()
for (const [index, letter] of [...'RUMBLE'].entries()) initialBoard[7][4 + index] = { tile: demoTile(letter), letter }
for (const [index, letter] of [...'INT'].entries()) initialBoard[8 + index][6] = { tile: demoTile(letter), letter }
const initialRack = [...'CARTOON'].map(demoTile)
const dawnTiles = [...'QZXPINK'].map(demoTile)
const hints: Placement[] = [...'POP'].map((letter, index) => ({ row: 4, col: 5 + index, letter, tile: demoTile(letter) }))

export function Gallery() {
  const [rackTiles, setRackTiles] = useState(initialRack)
  const [pending, setPending] = useState<Placement[]>([
    { row: 6, col: 10, tile: demoTile('S'), letter: 'S' },
    { row: 6, col: 11, tile: demoTile('T'), letter: 'T' }
  ])
  const [dawnFaceDown, setDawnFaceDown] = useState(true)
  const [selectedId, setSelectedId] = useState<number>()

  const reorder = (from: number, to: number) => setRackTiles((current) => {
    if (from === to || to < 0 || to > current.length) return current
    const next = [...current]
    next.splice(to, 0, ...next.splice(from, 1))
    return next
  })

  const drag = useTileDrag(({ tile, source }, target) => {
    if (target.kind === 'rack') {
      if (source.kind === 'rack') reorder(source.index, target.index)
      else {
        setPending((current) => current.filter((placement) => placement.tile.id !== tile.id))
        setRackTiles((current) => {
          const next = [...current]
          next.splice(target.index, 0, tile)
          return next
        })
      }
    }
    if (target.kind === 'square' && !initialBoard[target.row]?.[target.col] && !pending.some((placement) => placement.row === target.row && placement.col === target.col && placement.tile.id !== tile.id)) {
      setPending((current) => {
        if (current.some((placement) => placement.row === target.row && placement.col === target.col && placement.tile.id !== tile.id)) return current
        return [...current.filter((placement) => placement.tile.id !== tile.id), { row: target.row, col: target.col, tile, letter: tile.letter === '?' ? 'A' : tile.letter }]
      })
      if (source.kind === 'rack') setRackTiles((current) => current.filter((item) => item.id !== tile.id))
      setSelectedId(undefined)
    }
  })

  const placeSelected = (row: number, col: number) => {
    if (selectedId === undefined || initialBoard[row]?.[col] || pending.some((item) => item.row === row && item.col === col)) return
    const tile = rackTiles.find((item) => item.id === selectedId)
    if (!tile) return
    setPending((current) => [...current, { row, col, tile, letter: tile.letter === '?' ? 'A' : tile.letter }])
    setRackTiles((current) => current.filter((item) => item.id !== tile.id))
    setSelectedId(undefined)
  }

  return (
    <main className="wr-gallery halftone-2">
      <header className="wr-gallery__header">
        <div>
          <p className="wr-gallery__eyebrow">Component playground</p>
          <h1>Word Rumble!</h1>
          <p>Drag a tile onto the board, or click a tile and then a square.</p>
        </div>
        <div className="wr-gallery__buttons">
          <button className="btn" onClick={() => setDawnFaceDown((value) => !value)}>Flip Dawn’s rack</button>
          <button className="btn btn--pink" onClick={() => { setPending([]); setRackTiles(initialRack); setSelectedId(undefined) }}>Reset demo</button>
          <button className="btn btn--aqua" onClick={() => setSelectedId(undefined)}>Pop!</button>
        </div>
      </header>
      <div className="wr-gallery__stage">
        <Board
          board={initialBoard}
          pending={pending}
          hoverSquare={drag.hoverSquare}
          onSquareClick={placeSelected}
          onPendingPointerDown={(placement, event) => drag.startDrag(placement.tile, { kind: 'pending', row: placement.row, col: placement.col }, event)}
          playedBy={(row) => row === 7 ? '#1cc5b4' : '#9361e9'}
        >
          <GhostTiles placements={hints} />
        </Board>
        <div className="wr-gallery__racks">
          <div className="wr-gallery__card halftone-1">
            <h2>Ready to rumble?</h2>
            <Rack
              owner="Shane"
              color="#1cc5b4"
              tiles={rackTiles}
              count={rackTiles.length}
              faceDown={false}
              selectedId={selectedId}
              onTilePointerDown={(tile, event) => drag.startDrag(tile, { kind: 'rack', index: rackTiles.findIndex((item) => item.id === tile.id) }, event)}
              onTileClick={(tile) => { if (!drag.wasDragged) setSelectedId((current) => current === tile.id ? undefined : tile.id) }}
              onReorder={reorder}
            />
          </div>
          <div className="wr-gallery__card halftone-3">
            <h2>Keep it secret</h2>
            <Rack owner="Dawn" color="#9361e9" tiles={dawnTiles} count={dawnTiles.length} faceDown={dawnFaceDown} />
          </div>
        </div>
      </div>
      <DragLayer tile={drag.tile} letter={pending.find((item) => item.tile.id === drag.tile?.id)?.letter} x={drag.x} y={drag.y} visible={drag.dragging} />
    </main>
  )
}
