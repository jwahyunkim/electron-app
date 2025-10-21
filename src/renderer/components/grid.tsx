import React from 'react'

interface MergedCell {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
}

type Align = 'left' | 'center' | 'right'
type VAlign = 'top' | 'middle' | 'bottom'

interface MergeCustomGridProps {
  rows: number
  cols: number
  cellContent: (row: number, col: number) => React.ReactNode | null
  colSizes?: Record<number, string>
  rowSizes?: Record<number, string>
  defaultRowSize?: string
  defaultColSize?: string
  cellStyle?: (row: number, col: number) => React.CSSProperties
  mergedCells?: MergedCell[]
  horizontalAlign?: Align
  verticalAlign?: VAlign
  onCellClick?: (row: number, col: number) => void
}

const MergeCustomGrid: React.FC<MergeCustomGridProps> = ({
  rows,
  cols,
  cellContent,
  colSizes = {},
  rowSizes = {},
  defaultRowSize = 'auto',
  defaultColSize = 'auto',
  cellStyle = () => ({}),
  mergedCells = [],
  horizontalAlign = 'center',
  verticalAlign = 'middle',
  onCellClick
}) => {
  const mergedMap = new Map<string, { rowSpan: number; colSpan: number }>()
  const covered = new Set<string>()

  mergedCells.forEach(({ row, col, rowSpan = 1, colSpan = 1 }) => {
    mergedMap.set(`${row}-${col}`, { rowSpan, colSpan })
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (r === row && c === col) continue
        covered.add(`${r}-${c}`)
      }
    }
  })

  const colWidths = Array.from({ length: cols }, (_, i) => colSizes[i] || defaultColSize)
  const rowHeights = Array.from({ length: rows }, (_, i) => rowSizes[i] || defaultRowSize)

  const justify: Record<Align, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end'
  }
  const alignIt: Record<VAlign, string> = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end'
  }

  // 값·스타일 출처 찾기
  const findSource = (
    sr: number,
    sc: number,
    rs: number,
    cs: number
  ): { r: number; c: number } | null => {
    const base = cellContent(sr, sc)
    if (base != null && base !== '') {
      return { r: sr, c: sc }
    }
    for (let r = sr; r < sr + rs; r++) {
      for (let c = sc; c < sc + cs; c++) {
        const v = cellContent(r, c)
        if (v != null && v !== '') {
          return { r, c }
        }
      }
    }
    return null
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div
        style={{
          display: 'grid',
          width: '100%',
          height: '100%',
          gridTemplateColumns: colWidths.join(' '),
          gridTemplateRows: rowHeights.join(' '),
          gap: 0
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const key = `${r}-${c}`
            if (covered.has(key)) return null

            const mi = mergedMap.get(key)
            const src = mi ? findSource(r, c, mi.rowSpan, mi.colSpan) : null
            const content = src ? cellContent(src.r, src.c) : cellContent(r, c)
            const styleSrc = src ? cellStyle(src.r, src.c) : cellStyle(r, c)

            const alignment: React.CSSProperties = {
              justifyContent: justify[horizontalAlign],
              alignItems: alignIt[verticalAlign]
            }
            if (mi) {
              alignment.gridColumn = `span ${mi.colSpan}`
              alignment.gridRow = `span ${mi.rowSpan}`
            }

            const border: React.CSSProperties = {
              borderTop: r === 0 ? '1px solid #ccc' : 'none',
              borderLeft: c === 0 ? '1px solid #ccc' : 'none',
              borderRight: '1px solid #ccc',
              borderBottom: '1px solid #ccc'
            }

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  padding: '4px',
                  textAlign: 'center',
                  backgroundColor: '#e5e7eb',
                  ...alignment,
                  ...styleSrc,
                  ...border
                }}
                onClick={() => onCellClick?.(r, c)}
              >
                {content}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default MergeCustomGrid
