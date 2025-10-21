import React from 'react'
import { createPortal } from 'react-dom'
import CustomSelect from './CustomSelect'
import { Icon } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/filter'

interface MergedCell {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
}

type Align = 'left' | 'center' | 'right'
type VAlign = 'top' | 'middle' | 'bottom'

type AccessorFn<T> = (row: T, rowIndex: number) => React.ReactNode
export interface ColumnDef<T = any> {
  Header: React.ReactNode
  accessor: string | AccessorFn<T>
  id?: string
  align?: Align
  vAlign?: VAlign
}

function deepGet(obj: any, path: string) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

type MatchMode = 'includes' | 'startsWith' | 'equals'

interface CustomTableProps<T = any> {
  rootClassName?: string
  scrollClassName?: string

  /** 모드 A: 직접 행/열 정의 */
  rows?: number
  cols?: number
  cellContent?: (row: number, col: number) => React.ReactNode | null

  /** 모드 B: AnalyticalTable 유사 */
  columns?: ColumnDef<T>[]
  data?: T[]
  headerRow?: boolean

  /** 필터링(모드 B에서만 적용) */
  globalFilterValue?: string
  columnFilters?: Record<number | string, string>
  filterCaseSensitive?: boolean
  filterTrim?: boolean
  filterMatchMode?: MatchMode
  getFilterText?: (cellValue: unknown) => string

  /** 헤더 필터링 제어 */
  enableHeaderFilter?: boolean
  showHeaderFilterValue?: boolean

  /** 사이즈/스타일 */
  colSizes?: Record<number, string>
  rowSizes?: Record<number, string>
  defaultRowSize?: string
  defaultColSize?: string
  cellStyle?: (row: number, col: number) => React.CSSProperties

  /** 병합
   * - display: props로 받은 좌표를 화면 그리드 좌표로 그대로 사용
   * - original: props로 받은 좌표를 "원본 인덱스 스펙"으로 간주하고,
   *             필터 결과의 보이는 원본 인덱스와 교차하여 연속 구간만 동적 병합
   */
  mergedCells?: MergedCell[]
  mergedCellsSpecMode?: 'display' | 'original'

  horizontalAlign?: Align
  verticalAlign?: VAlign

  /** 열별 정렬(수평/수직) 오버라이드 */
  columnAlign?: Record<number, Align>
  columnVAlign?: Record<number, VAlign>

  /** 헤더 고정 + 본문 스크롤(세로) 모드 제어 */
  hasVerticalOverflow?: boolean

  /** 열 리사이징 제어 */
  enableColumnResize?: boolean

  /** 보이게 할 본문(데이터) 행 수 (헤더 제외). 데이터가 없어도 이 개수만큼 빈 행을 그림 */
  visibleRows?: number

  /** 클릭 이벤트 */
  onCellClick?: (row: number, col: number) => void
  onCellClickDetailed?: (info: {
    gridRow: number
    col: number
    dataIndexFiltered?: number
    dataIndexOriginal?: number
    row?: T
  }) => void

  /** 바디 셀 호버 제어(헤더에는 적용하지 않음) */
  enableHover?: boolean
  hoverCellStyle?: React.CSSProperties
  /** 호버 범위 선택: 'cell' = 단일 셀, 'row' = 행 전체 */
  hoverMode?: 'cell' | 'row'

  /** 합계 행 제어(모드 B에서만 적용) */
  showTotalRow?: boolean
  /** 합계 행 라벨 텍스트(첫 번째 열) */
  totalLabel?: string
}

function CustomTable<T = any>({
  rootClassName,
  scrollClassName,

  // 공통
  colSizes = {},
  rowSizes = {},
  defaultRowSize = 'auto',
  defaultColSize = 'auto',
  cellStyle = () => ({}),
  mergedCells = [],
  mergedCellsSpecMode = 'display',
  horizontalAlign = 'left',
  verticalAlign = 'middle',
  onCellClick,
  onCellClickDetailed,

  // 열별 정렬 오버라이드
  columnAlign = {},
  columnVAlign = {},

  // 모드 A
  rows,
  cols,
  cellContent,

  // 모드 B
  columns,
  data,
  headerRow = true,

  // 필터
  globalFilterValue,
  columnFilters,
  filterCaseSensitive = false,
  filterTrim = true,
  filterMatchMode = 'includes',
  getFilterText,

  // 헤더 필터 옵션
  enableHeaderFilter = true,
  showHeaderFilterValue = false,

  // 세로 오버플로우 제어
  hasVerticalOverflow = false,

  // 열 리사이징 제어
  enableColumnResize = true,

  // 보이는 행 수
  visibleRows,

  // 호버
  enableHover = false,
  hoverCellStyle = { backgroundColor: '#eef2ff' },
  hoverMode = 'cell',

  // 합계
  showTotalRow = false,
  totalLabel = 'Total'
}: CustomTableProps<T>): JSX.Element {
  const useAnalytical = Array.isArray(columns) && Array.isArray(data)

  // ===== 텍스트 정규화/매칭 유틸 =====
  const normalize = (s: string) => {
    const t = filterTrim ? s.trim() : s
    return filterCaseSensitive ? t : t.toLowerCase()
  }
  const toText = (v: unknown) => (getFilterText ? getFilterText(v) : String(v ?? ''))

  const match = (cell: unknown, query: string) => {
    const cellText = normalize(toText(cell))
    const q = normalize(query)
    if (q === '') return true
    switch (filterMatchMode) {
      case 'equals':
        return cellText === q
      case 'startsWith':
        return cellText.startsWith(q)
      default:
        return cellText.includes(q)
    }
  }

  // 측정
  function measureTextWidth(text: string, font: string): number {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    ctx.font = font
    return ctx.measureText(text).width
  }

  // ===== 헤더 셀렉트 기반 내부 필터 상태 =====
  const [uiColumnFilters, setUiColumnFilters] = React.useState<Record<number, string | undefined>>({})

  // 외부(columnFilters) + 내부(uiColumnFilters) 머지 → 인덱스 기준 맵
  const effectiveColumnFilters = React.useMemo(() => {
    if (!useAnalytical) return {} as Record<number, string>
    const map: Record<number, string> = {}
    if (columnFilters) {
      Object.entries(columnFilters).forEach(([k, v]) => {
        if (v == null || String(v).trim() === '') return
        const idx = Number.isNaN(Number(k))
          ? (columns || []).findIndex(col => {
            if (typeof col.accessor === 'string') return col.accessor === k || col.id === k
            return col.id === k
          })
          : Number(k)
        if (idx >= 0) map[idx] = String(v)
      })
    }
    Object.entries(uiColumnFilters).forEach(([k, v]) => {
      if (v == null || v === '') return
      map[Number(k)] = v
    })
    return map
  }, [columnFilters, uiColumnFilters, columns, useAnalytical])

  // ===== 1단계: 전역/컬럼 필터 적용 =====
  const applyFilters = (rowsIn: T[]) => {
    if (!useAnalytical) return rowsIn
    const hasGlobal = !!(globalFilterValue && normalize(globalFilterValue) !== '')
    const hasColumn = Object.keys(effectiveColumnFilters).length > 0
    if (!hasGlobal && !hasColumn) return rowsIn

    return rowsIn.filter((row, originalIndex) => {
      if (hasGlobal) {
        const anyHit = (columns || []).some(col => {
          const acc = col.accessor
          const cell = typeof acc === 'function' ? acc(row, originalIndex) : deepGet(row as any, acc)
          return match(cell, globalFilterValue!)
        })
        if (!anyHit) return false
      }
      if (hasColumn) {
        for (let cIdx = 0; cIdx < (columns?.length || 0); cIdx++) {
          const q = effectiveColumnFilters[cIdx]
          if (q == null || String(q).trim() === '') continue
          const acc = columns![cIdx].accessor
          const cell = typeof acc === 'function' ? acc(row, originalIndex) : deepGet(row as any, acc)
          if (normalize(toText(cell)) !== normalize(String(q))) return false
        }
      }
      return true
    })
  }

  // 원본 인덱스 매핑 유지 + 필터 적용 전체
  const originalIndexed = useAnalytical ? (data as T[]).map((r, i) => ({ r, i })) : []
  const filteredIndexedAll = useAnalytical
    ? applyFilters(originalIndexed.map(x => x.r)).map(r => {
      const oi = originalIndexed.find(x => x.r === r)?.i ?? -1
      return { r, i: oi }
    })
    : []

  // ===== visibleRows 적용 =====
  const bodyRowsToRender = useAnalytical
    ? Math.max(visibleRows ?? 0, filteredIndexedAll.length)
    : Math.max(visibleRows ?? 0, rows ?? 0)

  // 실제 렌더 데이터
  const filteredIndexed = useAnalytical ? filteredIndexedAll.slice(0, bodyRowsToRender) : []
  const dataForRender: T[] = useAnalytical ? filteredIndexed.map(x => x.r) : []

  const totalEnabled = useAnalytical && showTotalRow

  // 헤더 고정 모드 여부(본문 스크롤)
  const splitHeaderBody = useAnalytical && headerRow && hasVerticalOverflow

  // 전체 그리드 행수(단일 그리드 모드에서만 합계 포함)
  let effectiveRows = useAnalytical
    ? headerRow
      ? bodyRowsToRender + (splitHeaderBody ? 0 : totalEnabled ? 1 : 0) + 1
      : bodyRowsToRender + (splitHeaderBody ? 0 : totalEnabled ? 1 : 0)
    : bodyRowsToRender

  if (!useAnalytical && typeof cellContent !== 'function') {
    console.error('CustomTable: cellContent가 없거나 columns/data가 없습니다.')
  }

  // ===== 합계 계산(보이는 데이터 기준) =====
  const getRawValue = (rowObj: T, dataRowIndex: number, c: number): unknown => {
    const acc = columns![c]?.accessor
    return typeof acc === 'function' ? (acc as AccessorFn<T>)(rowObj, dataRowIndex) : deepGet(rowObj as any, acc as string)
  }
  const toNumber = (val: unknown): number | null => {
    if (val == null) return null
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string') {
      const s = val.replace(/,/g, '').trim()
      if (s === '') return null
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    return null
  }
  const effectiveCols = useAnalytical ? columns!.length : (cols ?? 0)
  const totalsByCol: Array<number | null> = React.useMemo(() => {
    if (!totalEnabled) return Array(effectiveCols).fill(null)
    const sums: Array<number | null> = Array(effectiveCols).fill(null)
    for (let c = 0; c < effectiveCols; c++) {
      let sum = 0
      let has = false
      for (let r = 0; r < dataForRender.length; r++) {
        const raw = getRawValue(dataForRender[r], r, c)
        const n = toNumber(raw)
        if (n != null) {
          has = true
          sum += n
        }
      }
      sums[c] = has ? sum : null
    }
    return sums
  }, [totalEnabled, effectiveCols, dataForRender, columns])

  // ===== 헤더 클릭용: 고유값(필터 적용 후 전체 기준) =====
  const distinctValuesByCol = React.useMemo(() => {
    if (!useAnalytical) return [] as string[][]
    const baseAll = filteredIndexedAll.map(x => x.r)
    return (columns || []).map(col => {
      const set = new Set<string>()
      baseAll.forEach((row, i) => {
        const acc = col.accessor
        const v = typeof acc === 'function' ? acc(row, i) : deepGet(row as any, acc)
        set.add(toText(v))
      })
      return Array.from(set).sort((a, b) => a.localeCompare(b))
    })
  }, [useAnalytical, filteredIndexedAll, columns, getFilterText])

  // columns/data 모드용 content/스타일 래퍼
  const getCellContent = (r: number, c: number): React.ReactNode | null => {
    if (useAnalytical) {
      if (r < 0 || c < 0 || c >= effectiveCols) return null
      if (headerRow && r === 0) {
        const baseHeader = columns![c]?.Header ?? ''
        const active = effectiveColumnFilters[c]
        const hasActive = !!(active && String(active).trim() !== '')
        return (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingRight: hasActive ? 18 : 0 }}>
              <span>{baseHeader}</span>
              {showHeaderFilterValue && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{hasActive ? `(${active})` : ''}</span>
              )}
            </div>
            {hasActive && (
              <Icon
                name="filter"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '14px',
                  color: '#2563eb',
                  pointerEvents: 'none'
                }}
              />
            )}
          </>
        )
      }
      const dataRowIndex = headerRow ? r - 1 : r
      if (dataRowIndex >= dataForRender.length) return ''
      const row = dataForRender[dataRowIndex]
      const acc = columns![c]?.accessor
      if (typeof acc === 'function') return (acc as AccessorFn<T>)(row, dataRowIndex)
      return deepGet(row as any, acc as string) ?? ''
    }
    return cellContent ? cellContent(r, c) : null
  }

  const getCellStyle = (r: number, c: number): React.CSSProperties => {
    const base = cellStyle(r, c) || {}
    if (useAnalytical && headerRow && r === 0) {
      return {
        fontWeight: 'bold',
        backgroundColor: '#ffff',
        cursor: enableHeaderFilter ? 'pointer' : 'default',
        position: 'relative',
        ...base
      }
    }
    return base
  }

  // ===== 병합 스펙(original) → 화면 병합(dynamic) 변환 =====
  const headerOffset = headerRow ? 1 : 0
  const visibleOriginalIndices: number[] = useAnalytical ? filteredIndexed.map(x => x.i) : []

  const finalMergedList: MergedCell[] = React.useMemo(() => {
    if (!useAnalytical || mergedCells.length === 0) return mergedCells

    if (mergedCellsSpecMode === 'display') {
      return mergedCells
    }

    const out: MergedCell[] = []
    for (const s of mergedCells) {

      const footerRowForDisplay =
        totalEnabled ? (headerRow ? bodyRowsToRender + 1 : bodyRowsToRender) : null;

      if (mergedCellsSpecMode === 'original' && footerRowForDisplay != null && s.row === footerRowForDisplay) {
        out.push({
          row: footerRowForDisplay,
          col: s.col,
          rowSpan: Math.max(1, s.rowSpan ?? 1),
          colSpan: Math.max(1, s.colSpan ?? 1),
        });
        continue;
      }


      const col = s.col
      const colSpan = s.colSpan ?? 1
      const start = (s.row ?? 0) - headerOffset
      const span = s.rowSpan ?? 1
      const end = start + Math.max(1, span) - 1
      if (start > end) continue

      let i = 0
      while (i < visibleOriginalIndices.length) {
        const oi = visibleOriginalIndices[i]
        if (oi < start || oi > end) {
          i++
          continue
        }
        const visStart = i
        while (
          i + 1 < visibleOriginalIndices.length &&
          visibleOriginalIndices[i + 1] === visibleOriginalIndices[i] + 1 &&
          visibleOriginalIndices[i + 1] >= start &&
          visibleOriginalIndices[i + 1] <= end
        ) {
          i++
        }
        const segLen = i - visStart + 1
        //가로병합
        // if (segLen > 1) {
        //   out.push({ row: headerOffset + visStart, col, rowSpan: segLen, colSpan })
        // }
        const reqRS = Math.max(1, s.rowSpan ?? 1)
        const reqCS = Math.max(1, s.colSpan ?? 1)
        const canEmit = reqRS === 1 ? segLen >= 1 : segLen > 1

        if (canEmit) {
          out.push({
            row: headerOffset + visStart,
            col,
            rowSpan: reqRS === 1 ? 1 : segLen,
            colSpan: reqCS
          })
        }
        i++
      }
    }
    return out
  }, [useAnalytical, mergedCells, mergedCellsSpecMode, headerOffset, visibleOriginalIndices])

  // 병합 맵 구성
  const mergedMap = new Map<string, { rowSpan: number; colSpan: number }>()
  const covered = new Set<string>()
  finalMergedList.forEach(({ row, col, rowSpan = 1, colSpan = 1 }) => {
    mergedMap.set(`${row}-${col}`, { rowSpan, colSpan })
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (r === row && c === col) continue
        covered.add(`${r}-${c}`)
      }
    }
  })

  const colWidths = Array.from({ length: effectiveCols }, (_, i) => colSizes[i] || defaultColSize)
  const rowHeights = Array.from({ length: effectiveRows }, (_, i) => rowSizes[i] || defaultRowSize)

  // 내부 px 열폭 상태(리사이즈용)
  const [colPx, setColPx] = React.useState<number[] | null>(null)

  const justify: Record<Align, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }
  const alignIt: Record<VAlign, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

  // 병합 영역의 대표 콘텐츠/스타일 소스 셀 탐색
  const findSource = (
    sr: number,
    sc: number,
    rs: number,
    cs: number
  ): { r: number; c: number } | null => {
    const base = getCellContent(sr, sc)
    if (base != null && base !== '') return { r: sr, c: sc }
    for (let r = sr; r < sr + rs; r++) {
      for (let c = sc; c < sc + cs; c++) {
        const v = getCellContent(r, c)
        if (v != null && v !== '') return { r, c }
      }
    }
    return null
  }

  // 헤더 셀렉트 열림 상태 + 드롭다운 포지션(포털)
  const [openCol, setOpenCol] = React.useState<number | null>(null)
  const [dropdownPos, setDropdownPos] = React.useState<{ left: number; top: number; width: number; font: number; height: number } | null>(null)
  const tableRef = React.useRef<HTMLDivElement | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement | null>(null)

  // 리사이즈 상태 및 클릭 차단 플래그
  const isResizingRef = React.useRef(false)
  const blockHeaderClickThisFrameRef = React.useRef(false)

  // ===== 헤더 DOM 측정: 박스/폰트/아이콘 크기 연동 =====
  type HeaderDim = { w: number; h: number; font: number }
  const headerRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const [headerDims, setHeaderDims] = React.useState<Record<number, HeaderDim>>({})
  const headerDimsRef = React.useRef<Record<number, HeaderDim>>({})

  const shallowEqualDims = React.useCallback((a: Record<number, HeaderDim>, b: Record<number, HeaderDim>) => {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (const k of ak) {
      const ka = Number(k)
      const va = a[ka]
      const vb = b[ka]
      if (!vb) return false
      if (va.w !== vb.w || va.h !== vb.h || va.font !== vb.font) return false
    }
    return true
  }, [])

  const measureHeaders = React.useCallback(() => {
    const next: Record<number, HeaderDim> = {}
    headerRefs.current.forEach((el, idx) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const fontPx = Math.round(parseFloat(cs.fontSize) || 14)
      next[idx] = { w: Math.round(rect.width), h: Math.round(rect.height), font: fontPx }
    })
    if (!shallowEqualDims(headerDimsRef.current, next)) {
      headerDimsRef.current = next
      setHeaderDims(next)
    }
  }, [shallowEqualDims])

  React.useLayoutEffect(() => {
    measureHeaders()
  }, [measureHeaders, useAnalytical, headerRow, effectiveCols])

  // ResizeObserver로 열 너비 변화 추적
  const roRef = React.useRef<ResizeObserver | null>(null)
  React.useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    roRef.current = new ResizeObserver(() => measureHeaders())
    const ro = roRef.current
    headerRefs.current.forEach(el => el && ro.observe(el))
    return () => {
      ro.disconnect()
      roRef.current = null
    }
  }, [measureHeaders, effectiveCols])

  // 초기 colPx 세팅 또는 컬럼 수 변동 시 보정
  React.useEffect(() => {
    if (colPx == null || colPx.length !== effectiveCols) {
      const measured = Array.from({ length: effectiveCols }, (_, i) => {
        const preset = colSizes[i]
        if (preset && preset.endsWith('px')) return parseInt(preset, 10)
        const dim = headerDims[i]?.w
        return Number.isFinite(dim) ? (dim as number) : 120
      })
      setColPx(measured)
    }
  }, [effectiveCols, headerDims, colSizes, colPx])

  // 리사이즈 드래그 상태
  const [drag, setDrag] = React.useState<{ col: number; startX: number; startW: number } | null>(null)

  React.useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startX
      setColPx(prev => {
        if (!prev) return prev
        const next = [...prev]
        next[drag.col] = Math.max(50, Math.round(drag.startW + dx))
        return next
      })
    }
    const onUp = () => {
      setDrag(null)
      isResizingRef.current = false
      // 현재 프레임에서만 헤더 클릭 차단
      blockHeaderClickThisFrameRef.current = true
      requestAnimationFrame(() => {
        blockHeaderClickThisFrameRef.current = false
      })
    }

    isResizingRef.current = true
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [drag])

  // grid 열 템플릿: 리사이즈 값 우선
  const gridColsTemplate = React.useMemo(() => {
    if (colPx && colPx.length === effectiveCols) {
      return colPx.map(w => `${Math.max(50, Math.round(w))}px`).join(' ')
    }
    return colWidths.join(' ')
  }, [colPx, effectiveCols, colWidths])

  const gridRowsTemplate = rowHeights.join(' ')

  // 드롭다운 포지션 계산
  const updateDropdownPos = React.useCallback(
    (colIndex: number) => {
      const el = headerRefs.current[colIndex]
      if (!el) return
      const rect = el.getBoundingClientRect()
      const fontSize = headerDims[colIndex]?.font ?? 14
      const font = `${fontSize}px Arial`

      const options = distinctValuesByCol[colIndex] || []
      let maxTextW = 0
      options.forEach(opt => {
        const w = measureTextWidth(opt, font)
        if (w > maxTextW) maxTextW = w
      })

      const width = Math.max(Math.ceil(maxTextW) + 60)

      setDropdownPos({
        left: Math.round(rect.left),
        top: Math.round(rect.bottom),
        width,
        font: fontSize,
        height: headerDims[colIndex]?.h ?? Math.round(rect.height)
      })
    },
    [headerDims, distinctValuesByCol]
  )

  // 외부 클릭 닫기
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      const insideDropdown = !!(dropdownRef.current && dropdownRef.current.contains(t))
      const insideTable = !!(tableRef.current && tableRef.current.contains(t))
      if (insideDropdown || insideTable) return
      setOpenCol(null)
      setDropdownPos(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // 스크롤/리사이즈 시 포지션 갱신
  React.useEffect(() => {
    if (openCol == null) return
    const onScrollOrResize = () => updateDropdownPos(openCol)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [openCol, updateDropdownPos])

  // ESC로 닫기
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCol(null)
        setDropdownPos(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ===== 스크롤바 폭 계산 =====
  const [scrollbarWidth, setScrollbarWidth] = React.useState(0)
  React.useEffect(() => {
    const scrollDiv = document.createElement('div')
    scrollDiv.style.width = '100px'
    scrollDiv.style.height = '100px'
    scrollDiv.style.overflow = 'scroll'
    scrollDiv.style.position = 'absolute'
    scrollDiv.style.top = '-9999px'
    document.body.appendChild(scrollDiv)
    const width = scrollDiv.offsetWidth - scrollDiv.clientWidth
    document.body.removeChild(scrollDiv)
    setScrollbarWidth(width)
  }, [])

  // 헤더/본문 행 높이 분리
  const headerRowHeight = headerRow ? rowSizes[0] || defaultRowSize : undefined
  const bodyRowHeights = headerRow ? rowHeights.slice(1) : rowHeights

  // 헤더/푸터 그리드 템플릿(더미 열 추가)
  const headerColsTemplate = React.useMemo(() => {
    if (!splitHeaderBody) return gridColsTemplate
    const extra = Math.max(0, scrollbarWidth)
    return `${gridColsTemplate} ${extra}px`
  }, [splitHeaderBody, gridColsTemplate, scrollbarWidth])
  const footerColsTemplate = headerColsTemplate

  // 공통 셀 정렬 계산(열별 우선)
  const effAlignFor = (c: number): Align =>
    (columnAlign as any)[c] ?? (columns?.[c]?.align as Align) ?? horizontalAlign
  const effVAlignFor = (c: number): VAlign =>
    (columnVAlign as any)[c] ?? (columns?.[c]?.vAlign as VAlign) ?? verticalAlign

  // 공통 보더 스타일
  const makeBorder = (r: number): React.CSSProperties => ({
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: '1px solid #ccc',
    borderBottom:
      r === 0
        ? '1px solid #888'
        : r === effectiveRows - 1
          ? hasVerticalOverflow
            ? 'none'
            : '1px solid #888'
          : '1px solid #ccc'
  })

  // ===== 호버 상태 =====
  const [hovered, setHovered] = React.useState<{ row: number; col: number } | null>(null)

  // ===== 렌더 =====
  if (splitHeaderBody) {
    const headerColsCount = effectiveCols + 1 /* 더미열 */
    const bodyRowsCount = bodyRowsToRender
    const footerGlobalRow = headerRow ? bodyRowsToRender + 1 : bodyRowsToRender
    const footerRowHeight = rowSizes[footerGlobalRow] || defaultRowSize

    return (
      <div className={rootClassName} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden', overflowY: 'hidden' }}>
        <div ref={tableRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
          {/* 헤더 그리드 */}
          <div
            style={{
              display: 'grid',
              width: '100%',
              gridTemplateColumns: headerColsTemplate,
              gridTemplateRows: headerRowHeight ?? 'auto',
              gap: 0
            }}
          >
            {Array.from({ length: headerColsCount }).map((_, c) => {
              const isDummy = c === effectiveCols
              const key = `header-0-${c}`
              if (!isDummy) {
                const covKey = `0-${c}`
                if (covered.has(covKey)) return null
              }
              const mi = !isDummy ? mergedMap.get(`0-${c}`) : undefined
              const src = mi ? findSource(0, c, mi.rowSpan, mi.colSpan) : null
              const content = isDummy ? null : src ? getCellContent(src.r, src.c) : getCellContent(0, c)
              const styleSrc = isDummy
                ? getCellStyle(0, effectiveCols)
                : src
                  ? getCellStyle(src.r, src.c)
                  : getCellStyle(0, c)


              const effHAlign = effAlignFor(c)
              const effVAlign = effVAlignFor(c)
              const alignment: React.CSSProperties = {
                justifyContent: justify[effHAlign],
                alignItems: alignIt[effVAlign]
              }
              if (mi && !isDummy) {
                alignment.gridColumn = `span ${mi.colSpan}`
                alignment.gridRow = `span ${mi.rowSpan}`
              }

              const headerFilterEnabled = enableHeaderFilter && !isDummy
              const showSelect = headerFilterEnabled && openCol === c
              const currentVal = effectiveColumnFilters[c] ?? ''

              return (
                <div
                  key={key}
                  ref={el => {
                    if (!isDummy) headerRefs.current[c] = el
                  }}
                  style={{
                    display: 'flex',
                    padding: '4px',
                    ...(effHAlign === 'left' ? { paddingLeft: '12px' } : {}),
                    ...(effHAlign === 'right' ? { paddingRight: '12px' } : {}),
                    textAlign: 'center',
                    backgroundColor: '#ffff',
                    boxSizing: 'border-box',
                    position: 'relative',
                    ...alignment,
                    ...styleSrc,
                    ...makeBorder(0)
                  }}
                  onClick={() => {
                    if (headerFilterEnabled) {
                      if (blockHeaderClickThisFrameRef.current) return
                      setOpenCol(prev => {
                        const next = prev === c ? null : c
                        if (next != null) updateDropdownPos(next)
                        else setDropdownPos(null)
                        return next
                      })
                      return
                    }
                  }}
                >
                  {content}

                  {/* 리사이저: 더미열 제외 */}
                  {!isDummy && enableColumnResize && (
                    <div
                      onMouseDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        isResizingRef.current = true
                        const startW =
                          (colPx && colPx[c]) ??
                          headerDims[c]?.w ??
                          (typeof colWidths[c] === 'string' && colWidths[c].endsWith('px')
                            ? parseInt(colWidths[c], 10)
                            : 120)
                        setDrag({ col: c, startX: e.clientX, startW })
                      }}
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 6,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 1001
                      }}
                    />
                  )}

                  {/* 드롭다운 */}
                  {!isDummy &&
                    showSelect &&
                    dropdownPos &&
                    openCol === c &&
                    createPortal(
                      <div
                        ref={dropdownRef}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'fixed',
                          left: `${dropdownPos.left}px`,
                          top: `${dropdownPos.top}px`,
                          width: `${dropdownPos.width + 20}px`,
                          zIndex: 2000,
                          padding: '4px 15px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}
                      >
                        <Icon name="filter" style={{ fontSize: '14px', color: '#2563eb', flex: '0 0 auto' }} />
                        <CustomSelect
                          options={['', ...((distinctValuesByCol[c] || []) as string[])]}
                          value={currentVal}
                          onChange={v => {
                            setUiColumnFilters(prev => ({
                              ...prev,
                              [c]: v || undefined
                            }))
                            setOpenCol(null)
                            setDropdownPos(null)
                          }}
                          placeholder="(전체)"
                          boxWidth={`${dropdownPos.width}px`}
                          boxHeight={`${Math.max(24, Math.round(dropdownPos.height * 0.8))}px`}
                          innerFont={`${Math.max(10, dropdownPos.font)}px`}
                          selectFontSize={`${Math.max(10, dropdownPos.font)}px`}
                          iconSize={`${Math.max(8, Math.round(dropdownPos.font * 0.9))}px`}
                        />
                      </div>,
                      document.body
                    )}
                </div>
              )
            })}
          </div>

          {/* 본문 스크롤 영역 */}
          <div
            className={scrollClassName}
            style={{
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: '1 1 0%',
              width: '100%',
              borderBottom: '1px solid #888'
            }}
          >
            <div
              style={{
                display: 'grid',
                width: '100%',
                gridTemplateColumns: gridColsTemplate,
                gridTemplateRows: bodyRowHeights.join(' '),
                gap: 0
              }}
            >
              {Array.from({ length: bodyRowsCount }).map((_, br) =>
                Array.from({ length: effectiveCols }).map((_, c) => {
                  const globalRow = headerRow ? br + 1 : br
                  const key = `body-${globalRow}-${c}`
                  const covKey = `${globalRow}-${c}`
                  if (covered.has(covKey)) return null

                  const mi = mergedMap.get(covKey)
                  const src = mi ? findSource(globalRow, c, mi.rowSpan, mi.colSpan) : null
                  const content = src ? getCellContent(src.r, src.c) : getCellContent(globalRow, c)
                  const styleSrc = src ? getCellStyle(src.r, src.c) : getCellStyle(globalRow, c)

                  const effHAlign = effAlignFor(c)
                  const effVAlign = effVAlignFor(c)
                  const alignment: React.CSSProperties = {
                    justifyContent: justify[effHAlign],
                    alignItems: alignIt[effVAlign]
                  }
                  if (mi) {
                    alignment.gridColumn = `span ${mi.colSpan}`
                    alignment.gridRow = `span ${mi.rowSpan}`
                  }

                  const isHovered =
                    enableHover &&
                    ((hoverMode === 'cell' && hovered?.row === globalRow && hovered?.col === c) ||
                      (hoverMode === 'row' && hovered?.row === globalRow))

                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        padding: '4px',
                        ...(effHAlign === 'left' ? { paddingLeft: '12px' } : {}),
                        ...(effHAlign === 'right' ? { paddingRight: '12px' } : {}),
                        textAlign: 'center',
                        backgroundColor: '#ffff',
                        boxSizing: 'border-box',
                        position: 'relative',
                        cursor: enableHover ? 'pointer' : 'default',
                        ...alignment,
                        ...styleSrc,
                        ...(isHovered ? hoverCellStyle : {}),
                        ...makeBorder(globalRow)
                      }}
                      onMouseEnter={() => {
                        if (enableHover) setHovered({ row: globalRow, col: c })
                      }}
                      onMouseLeave={() => {
                        if (enableHover) setHovered(null)
                      }}
                      onClick={() => {
                        onCellClick?.(globalRow, c)
                        if (useAnalytical) {
                          const filteredIdx = headerRow ? globalRow - 1 : globalRow
                          const origIdx = filteredIdx >= 0 ? filteredIndexed[filteredIdx]?.i : undefined
                          const rowObj = filteredIdx >= 0 ? dataForRender[filteredIdx] : undefined
                          onCellClickDetailed?.({
                            gridRow: globalRow,
                            col: c,
                            dataIndexFiltered: filteredIdx,
                            dataIndexOriginal: origIdx,
                            row: rowObj
                          })
                        } else {
                          onCellClickDetailed?.({ gridRow: globalRow, col: c })
                        }
                      }}
                    >
                      {content}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 합계 푸터 (스크롤 밖, 항상 보임) */}
          {totalEnabled && (
            <div
              style={{
                display: 'grid',
                width: '100%',
                gridTemplateColumns: footerColsTemplate,
                gridTemplateRows: footerRowHeight,
                gap: 0
              }}
            >
              {Array.from({ length: headerColsCount }).map((_, c) => {
                const isDummy = c === effectiveCols
                const globalRow = footerGlobalRow
                const key = `footer-${globalRow}-${c}`
                if (isDummy) {
                  const dummyStyle = getCellStyle(globalRow, effectiveCols)
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        padding: '4px',
                        backgroundColor: '#fff',
                        boxSizing: 'border-box',
                        // 헤더와 동일한 크롬 적용
                        borderTop: '1px solid #888',
                        borderLeft: 'none',
                        borderRight: '1px solid #ccc',
                        borderBottom: '1px solid #888',
                        ...dummyStyle
                      }}
                    />
                  )
                }

                // 병합 적용
                const covKey = `${globalRow}-${c}`
                if (covered.has(covKey)) return null
                const mi = mergedMap.get(covKey)

                const effHAlign = effAlignFor(c)
                const effVAlign = effVAlignFor(c)
                const alignment: React.CSSProperties = {
                  justifyContent: justify[effHAlign],
                  alignItems: alignIt[effVAlign]
                }
                if (mi) {
                  // 더미열로 넘치지 않게 클램프
                  const maxSpan = Math.min(mi.colSpan, Math.max(1, effectiveCols - c))
                  alignment.gridColumn = `span ${maxSpan}`
                  alignment.gridRow = `span ${mi.rowSpan}`
                }

                // 푸터의 콘텐츠는 합계 규칙 유지
                const content =
                  c === 0 ? totalLabel : totalsByCol[c] != null ? (totalsByCol[c] as number) : ''
                const styleSrc = getCellStyle(globalRow, c)

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      padding: '4px',
                      ...(effHAlign === 'left' ? { paddingLeft: '12px' } : {}),
                      ...(effHAlign === 'right' ? { paddingRight: '12px' } : {}),
                      textAlign: 'center',
                      backgroundColor: '#ffff',
                      boxSizing: 'border-box',
                      position: 'relative',
                      borderTop: '1px solid #888',
                      borderLeft: 'none',
                      borderRight: '1px solid #ccc',
                      borderBottom: '1px solid #888',
                      ...alignment,
                      ...styleSrc
                    }}
                    onClick={() => {
                      onCellClick?.(globalRow, c)
                      onCellClickDetailed?.({
                        gridRow: globalRow,
                        col: c,
                        dataIndexFiltered: undefined,
                        dataIndexOriginal: undefined,
                        row: undefined
                      })
                    }}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ===== 기존 단일 그리드 렌더 (오버플로우 비활성) =====
  return (
    <div className={rootClassName} style={{ display: 'flex', height: '100%', overflowX: 'hidden', overflowY: 'hidden' }}>
      <div
        ref={tableRef}
        style={{
          display: 'grid',
          width: '100%',
          height: '100%',
          gridTemplateColumns: gridColsTemplate,
          gridTemplateRows: gridRowsTemplate,
          gap: 0
        }}
      >
        {Array.from({ length: effectiveRows }).map((_, r) =>
          Array.from({ length: effectiveCols }).map((_, c) => {
            const key = `${r}-${c}`
            if (covered.has(key)) return null

            const isHeaderCell = useAnalytical && headerRow && r === 0
            const isTotalRow =
              useAnalytical && totalEnabled && r === effectiveRows - 1

            const mi = mergedMap.get(key)
            const src = mi ? findSource(r, c, mi.rowSpan, mi.colSpan) : null

            const content = isTotalRow
              ? c === 0
                ? totalLabel
                : totalsByCol[c] != null
                  ? (totalsByCol[c] as number)
                  : ''
              : src
                ? getCellContent(src.r, src.c)
                : getCellContent(r, c)

            const styleSrc = isTotalRow
              ? getCellStyle(r, c)
              : src
                ? getCellStyle(src.r, src.c)
                : getCellStyle(r, c)

            const effHAlign = effAlignFor(c)
            const effVAlign = effVAlignFor(c)

            const alignment: React.CSSProperties = {
              justifyContent: justify[effHAlign],
              alignItems: alignIt[effVAlign]
            }
            if (mi) {
              alignment.gridColumn = `span ${mi.colSpan}`
              alignment.gridRow = `span ${mi.rowSpan}`
            }

            const border: React.CSSProperties = makeBorder(r)

            const headerFilterEnabled = enableHeaderFilter && isHeaderCell
            const showSelect = headerFilterEnabled && openCol === c
            const currentVal = effectiveColumnFilters[c] ?? ''

            const isBodyCell = !isHeaderCell
            const isHovered =
              enableHover &&
              isBodyCell &&
              ((hoverMode === 'cell' && hovered?.row === r && hovered?.col === c) ||
                (hoverMode === 'row' && hovered?.row === r))

            return (
              <div
                key={key}
                ref={el => {
                  if (isHeaderCell) headerRefs.current[c] = el
                }}
                style={{
                  display: 'flex',
                  padding: '4px',
                  ...(effHAlign === 'left' ? { paddingLeft: '12px' } : {}),
                  ...(effHAlign === 'right' ? { paddingRight: '12px' } : {}),
                  textAlign: 'center',
                  backgroundColor: '#ffff',
                  boxSizing: 'border-box',
                  position: 'relative',
                  cursor: enableHover && isBodyCell ? 'pointer' : undefined,
                  ...alignment,
                  ...styleSrc,
                  ...(isHovered ? hoverCellStyle : {}),
                  ...border
                }}
                onMouseEnter={() => {
                  if (enableHover && isBodyCell) setHovered({ row: r, col: c })
                }}
                onMouseLeave={() => {
                  if (enableHover && isBodyCell) setHovered(null)
                }}
                onClick={() => {
                  if (headerFilterEnabled) {
                    if (blockHeaderClickThisFrameRef.current) return
                    setOpenCol(prev => {
                      const next = prev === c ? null : c
                      if (next != null) updateDropdownPos(next)
                      else setDropdownPos(null)
                      return next
                    })
                    return
                  }
                  onCellClick?.(r, c)
                  if (useAnalytical && !(headerRow && r === 0)) {
                    const filteredIdx = headerRow ? r - 1 : r
                    const rowIsTotal = isTotalRow
                    const origIdx = !rowIsTotal && filteredIdx >= 0 ? filteredIndexed[filteredIdx]?.i : undefined
                    const rowObj = !rowIsTotal && filteredIdx >= 0 ? dataForRender[filteredIdx] : undefined
                    onCellClickDetailed?.({
                      gridRow: r,
                      col: c,
                      dataIndexFiltered: rowIsTotal ? undefined : filteredIdx,
                      dataIndexOriginal: rowIsTotal ? undefined : origIdx,
                      row: rowObj
                    })
                  } else {
                    onCellClickDetailed?.({ gridRow: r, col: c })
                  }
                }}
              >
                {content}

                {/* 리사이저 핸들 */}
                {isHeaderCell && c < effectiveCols && enableColumnResize && (
                  <div
                    onMouseDown={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      isResizingRef.current = true
                      const startW =
                        (colPx && colPx[c]) ??
                        headerDims[c]?.w ??
                        (typeof colWidths[c] === 'string' && colWidths[c].endsWith('px')
                          ? parseInt(colWidths[c], 10)
                          : 120)
                      setDrag({ col: c, startX: e.clientX, startW })
                    }}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 6,
                      height: '100%',
                      cursor: 'col-resize',
                      zIndex: 1001
                    }}
                  />
                )}

                {/* 드롭다운 */}
                {showSelect &&
                  dropdownPos &&
                  openCol === c &&
                  createPortal(
                    <div
                      ref={dropdownRef}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'fixed',
                        left: `${dropdownPos.left}px`,
                        top: `${dropdownPos.top}px`,
                        width: `${dropdownPos.width + 20}px`,
                        zIndex: 2000,
                        padding: '4px 15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    >
                      <Icon name="filter" style={{ fontSize: '14px', color: '#2563eb', flex: '0 0 auto' }} />
                      <CustomSelect
                        options={['', ...((distinctValuesByCol[c] || []) as string[])]}
                        value={currentVal}
                        onChange={v => {
                          setUiColumnFilters(prev => ({
                            ...prev,
                            [c]: v || undefined
                          }))
                          setOpenCol(null)
                          setDropdownPos(null)
                        }}
                        placeholder="(전체)"
                        boxWidth={`${dropdownPos.width}px`}
                        boxHeight={`${Math.max(24, Math.round(dropdownPos.height * 0.8))}px`}
                        innerFont={`${Math.max(10, dropdownPos.font)}px`}
                        selectFontSize={`${Math.max(10, dropdownPos.font)}px`}
                        iconSize={`${Math.max(8, Math.round(dropdownPos.font * 0.9))}px`}
                      />
                    </div>,
                    document.body
                  )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CustomTable
