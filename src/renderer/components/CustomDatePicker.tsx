// src/components/CustomDatePicker.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/navigation-down-arrow'
import '@ui5/webcomponents-icons/dist/slim-arrow-left'
import '@ui5/webcomponents-icons/dist/slim-arrow-right'

type DisplayFormat = string | ((d: Date | null) => string)
type ValueFormat = 'iso' | 'epoch' | string | ((d: Date | null) => string)

type Props = {
  value?: string // 외부에서 관리하는 값
  onChange?: (v: string) => void

  // 크기
  boxWidth?: string // ex "20vw"
  boxHeight?: string // ex "5vh"
  innerFont?: string // ex "1vw" or "14px"

  // 형식 지정
  displayFormat?: DisplayFormat // 박스에 표시되는 형식
  valueFormat?: ValueFormat // onChange로 내보낼 형식
  parseValue?: (v: string) => Date | null // value를 Date로 바꾸는 함수(옵션, 있으면 우선)
}

// ----- formatting & parsing helpers -----
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}
function formatByPattern(d: Date, pattern: string) {
  const yyyy = d.getFullYear().toString()
  const MM = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  return pattern.replace(/yyyy/g, yyyy).replace(/MM/g, MM).replace(/dd/g, dd)
}
function escapeRegex(s: string) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}
function parseByPattern(text: string, pattern: string): Date | null {
  // 지원 토큰: yyyy, MM, dd
  const rx = new RegExp(
    '^' +
      escapeRegex(pattern)
        .replace(/yyyy/g, '(\\d{4})')
        .replace(/MM/g, '(\\d{2})')
        .replace(/dd/g, '(\\d{2})') +
      '$'
  )
  const m = text.match(rx)
  if (!m) return null

  // capture 순서를 pattern에서의 등장 순서대로 찾아 매핑
  const order: Array<'y' | 'M' | 'd'> = []
  const tokenRx = /(yyyy|MM|dd)/g
  let t: RegExpExecArray | null
  while ((t = tokenRx.exec(pattern))) {
    order.push(t[0] === 'yyyy' ? 'y' : t[0] === 'MM' ? 'M' : 'd')
  }

  let y = 1970,
    M = 1,
    d = 1,
    idx = 1
  for (const o of order) {
    const v = Number(m[idx++])
    if (o === 'y') y = v
    else if (o === 'M') M = v
    else d = v
  }
  const dt = new Date(y, M - 1, d)
  // 유효성 재검증
  if (dt.getFullYear() !== y || dt.getMonth() !== M - 1 || dt.getDate() !== d) return null
  return dt
}

function toISOyyyyMMdd(d: Date) {
  // UTC 기준 잘라냄(기존 동작과 동일)
  return d.toISOString().slice(0, 10)
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export default function CustomDatePicker({
  value,
  onChange,
  boxWidth = '20vw',
  boxHeight = '4vh',
  innerFont = '1vw',
  displayFormat = 'yyyy-MM-dd',
  valueFormat = 'iso',
  parseValue
}: Props) {
  // parser 선택
  const parseInput = (v: string): Date | null => {
    if (!v) return null
    if (parseValue) return parseValue(v)

    if (typeof valueFormat === 'function') {
      // 역파싱 불가 → 기본 시도: ISO 또는 패턴 추정
      const byIso = new Date(v)
      return isNaN(byIso.getTime()) ? null : byIso
    }
    if (valueFormat === 'epoch') {
      const n = Number(v)
      if (!Number.isFinite(n)) return null
      const dt = new Date(n)
      return isNaN(dt.getTime()) ? null : dt
    }
    if (valueFormat === 'iso' || valueFormat === 'yyyy-MM-dd') {
      const dt = new Date(v)
      return isNaN(dt.getTime()) ? parseByPattern(v, 'yyyy-MM-dd') : dt
    }
    // 사용자 패턴
    return parseByPattern(v, valueFormat)
  }

  // formatter 선택
  const formatDisplay = (d: Date | null) => {
    if (!d) return ''
    if (typeof displayFormat === 'function') return displayFormat(d)
    return formatByPattern(d, displayFormat)
  }
  const formatValue = (d: Date | null) => {
    if (!d) return ''
    if (typeof valueFormat === 'function') return valueFormat(d)
    if (valueFormat === 'epoch') return String(d.getTime())
    if (valueFormat === 'iso' || valueFormat === 'yyyy-MM-dd') return toISOyyyyMMdd(d)
    // 사용자 패턴
    return formatByPattern(d, valueFormat)
  }

  const initialSelected = value ? parseInput(value) : null
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date | null>(initialSelected)
  const [view, setView] = useState<Date>(startOfMonth(initialSelected ?? new Date()))
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!hostRef.current) return
      if (!hostRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (value === undefined) return
    const parsed = value ? parseInput(value) : null
    setSelected(parsed)
    if (parsed) setView(startOfMonth(parsed))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectDay = (day: number) => {
    const d = new Date(view.getFullYear(), view.getMonth(), day)
    setSelected(d)
    onChange?.(formatValue(d))
    setOpen(false)
  }

  const prevMonth = () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
  const nextMonth = () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))

  // build cells
  const firstDow = startOfMonth(view).getDay()
  const total = daysInMonth(view)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  // sizes
  const selectBoxArrowSize = '1vw'
  const selectBoxArrowStyle: React.CSSProperties = {
    width: selectBoxArrowSize,
    height: selectBoxArrowSize
  }
  const calendarArrowSize = '1vw'
  const calendarArrowStyle: React.CSSProperties = {
    color: '#1473e3',
    width: calendarArrowSize,
    height: calendarArrowSize,
    transition: 'transform 0.2s'
  }

  return (
    <div ref={hostRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Select Box */}
      <div
        role="button"
        aria-haspopup="dialog"
        onClick={() => {
          // 날짜 없음 → 캘린더 열기
          // 날짜 있음 → 초기화
          if (!selected) {
            setOpen(true)
          } else {
            setSelected(null)
            onChange?.('')
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6vw',
          width: boxWidth,
          height: boxHeight,
          boxSizing: 'border-box',
          border: '1px solid #d0d0d0',
          borderBottom: '1px solid #556b81',
          borderRadius: '0.2vw 0.2vw 0 0',
          padding: '0 0.4vw',
          background: '#fff',
          fontSize: innerFont,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'border 0.2s'
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.border = '1px solid #a7cfff'
          ;(e.currentTarget as HTMLDivElement).style.borderBottom = '1px solid #1473e3'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.border = '1px solid #d0d0d0'
          ;(e.currentTarget as HTMLDivElement).style.borderBottom = '1px solid #556b81'
        }}
      >
        <div style={{ flex: 1, fontSize: innerFont }}>{formatDisplay(selected)}</div>

        {/* 화살표: 항상 날짜 선택 열기, 클릭 버블 차단 */}
        <div
          role="button"
          aria-label="toggle calendar"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          style={{
            width: '1vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Icon name="navigation-down-arrow" style={selectBoxArrowStyle} />
        </div>
      </div>

      {/* Calendar Panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          style={{
            position: 'absolute',
            top: `calc(${boxHeight} + 0.6vh)`,
            left: 0,
            zIndex: 9999,
            width: '18vw',
            padding: '0.8vw',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            background: '#fff',
            borderRadius: '0.4vw',
            fontSize: '0.8vw',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.6vh'
            }}
          >
            <button
              onClick={prevMonth}
              style={{ cursor: 'pointer', background: 'none', border: 'none' }}
              aria-label="Prev month"
            >
              <Icon name="slim-arrow-left" style={calendarArrowStyle} />
            </button>

            <div style={{ fontWeight: 600, color: '#1473e3' }}>
              {view.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>

            <button
              onClick={nextMonth}
              style={{ cursor: 'pointer', background: 'none', border: 'none' }}
              aria-label="Next month"
            >
              <Icon name="slim-arrow-right" style={calendarArrowStyle} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.4vh',
              textAlign: 'center',
              fontSize: innerFont
            }}
          >
            {['일', '월', '화', '수', '목', '금', '토'].map((h) => (
              <div key={h} style={{ fontSize: '0.7vw', color: '#555' }}>
                {h}
              </div>
            ))}

            {cells.map((c, idx) => {
              const isSelected =
                c !== null &&
                !!selected &&
                selected.getFullYear() === view.getFullYear() &&
                selected.getMonth() === view.getMonth() &&
                selected.getDate() === c
              return (
                <div
                  key={idx}
                  onClick={() => c && selectDay(c)}
                  role="button"
                  tabIndex={c ? 0 : -1}
                  style={{
                    height: '3.6vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '0.3vw',
                    cursor: c ? 'pointer' : 'default',
                    background: 'transparent',
                    color: isSelected ? '#1473e3' : c ? '#111' : '#aaa',
                    fontSize: '0.8vw',
                    userSelect: 'none',
                    border: isSelected ? '1px solid #1473e3' : '1px solid transparent',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'border 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (c && !isSelected)
                      (e.currentTarget as HTMLDivElement).style.border = '1px solid #a7cfff'
                  }}
                  onMouseLeave={(e) => {
                    if (c && !isSelected)
                      (e.currentTarget as HTMLDivElement).style.border = '1px solid transparent'
                  }}
                >
                  {c ?? ''}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
