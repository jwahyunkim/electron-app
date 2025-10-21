// src/components/CustomSelect.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/navigation-down-arrow'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

// 입력 형태: 객체 배열 | 문자열/숫자 배열 | 키-값 객체
type OptionsInput = SelectOption[] | Array<string | number> | Record<string, string | number>

type Props = {
  options: OptionsInput
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string

  boxWidth?: string // ex: "20vw"
  boxHeight?: string // ex: "4vh"

  innerFont?: string // 기본 폰트(ex: "1vw")
  selectFontSize?: string // 트리거(표시영역) 전용 폰트
  iconSize?: string // 아이콘 가로=세로 동일(ex: "1vw")

  listMaxVH?: number // ex: 32
  optionVH?: number // ex: 4

  searchable?: boolean
  disabled?: boolean
  errorText?: string
  name?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
function isSelectOption(x: unknown): x is SelectOption {
  return !!x && typeof x === 'object' && 'value' in (x as any) && 'label' in (x as any)
}
function normalizeOptions(input: OptionsInput): SelectOption[] {
  if (Array.isArray(input)) {
    if (input.length && isSelectOption(input[0])) return input as SelectOption[]
    return (input as Array<string | number>).map((v) => {
      const s = String(v)
      return { value: s, label: s }
    })
  }
  return Object.entries(input).map(([k, v]) => ({
    value: k,
    label: String(v)
  }))
}

export default function CustomSelect({
  options: optionsInput,
  value,
  defaultValue,
  onChange,
  placeholder = '',
  boxWidth = '20vw',
  boxHeight = '4vh',
  innerFont = '1vw',
  selectFontSize,
  iconSize = '1vw',
  listMaxVH = 32,
  optionVH = 4,
  searchable = false,
  disabled = false,
  errorText,
  name
}: Props) {
  const options = useMemo(() => normalizeOptions(optionsInput), [optionsInput])

  const isControlled = value !== undefined
  const [open, setOpen] = useState(false)
  const [internal, setInternal] = useState(defaultValue ?? '')
  const currentValue = isControlled ? value! : internal

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const arrowBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, searchable, query])

  const selectedIndex = useMemo(
    () => filtered.findIndex((o) => o.value === currentValue),
    [filtered, currentValue]
  )

  const openDropdown = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setActiveIndex(Math.max(selectedIndex, 0))
  }, [disabled, selectedIndex])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const selectByIndex = useCallback(
    (idx: number) => {
      const i = clamp(idx, 0, filtered.length - 1)
      if (!filtered.length) return
      const target = filtered[i]
      if (!target || target.disabled) return
      if (!isControlled) setInternal(target.value)
      onChange?.(target.value)
      closeDropdown()
      setQuery('')
      arrowBtnRef.current?.focus()
    },
    [filtered, isControlled, onChange, closeDropdown]
  )

  const toggleDropdown = useCallback(() => {
    if (disabled) return
    setOpen((o) => {
      const next = !o
      if (next) setActiveIndex(Math.max(selectedIndex, 0))
      else setActiveIndex(-1)
      return next
    })
  }, [disabled, selectedIndex])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        closeDropdown()
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [closeDropdown])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const item = listRef.current?.querySelector<HTMLDivElement>(`[data-idx="${activeIndex}"]`)
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function onArrowKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      toggleDropdown()
    } else if (open && e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    }
  }

  // 박스 클릭: 값이 있으면 삭제, 값이 없으면 드롭다운 열기
  function onBoxClick() {
    if (disabled) return
    if (currentValue) {
      if (!isControlled) setInternal('')
      onChange?.('')
      closeDropdown()
      setQuery('')
    } else {
      openDropdown()
    }
  }
  function onBoxKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onBoxClick()
    }
  }

  const selected = options.find((o) => o.value === currentValue)

  const S = {
    wrapper: {
      width: boxWidth,
      position: 'relative' as const,
      fontSize: innerFont
    },
    list: {
      position: 'absolute' as const,
      top: `calc(${boxHeight} + 0.6vh)`,
      left: 0,
      // width: '100%',
       width: boxWidth,
      maxHeight: `${listMaxVH}vh`,
      overflowY: 'auto' as const,
      border: '1px solid #c7c7c7',
      borderRadius: '0.2vw',
      background: '#fff',
      boxShadow: '0 1vh 3vh rgba(0,0,0,0.12)',
      zIndex: 1000,
      
    },
    option: (isActive: boolean, isDisabled: boolean) => ({
      height: `${optionVH}vh`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 1vw',
      background: isActive ? 'rgba(0,0,0,0.06)' : '#fff',
      color: isDisabled ? '#b6b6b6' : '#111',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      fontSize: innerFont
    }),
    searchWrap: {
      padding: '0.5vh 0.8vw',
      borderBottom: '1px solid #efefef'
    },
    searchInput: {
      width: '100%',
      height: `${Math.max(3.6, optionVH * 0.9)}vh`,
      border: '1px solid #c7c7c7',
      borderRadius: '0.6vh',
      padding: '0 0.8vw',
      fontSize: innerFont,
      outline: 'none'
    },
    error: { marginTop: '0.6vh', color: '#d32f2f', fontSize: '0.9em' },
    arrowIcon: (o: boolean) => ({
      marginLeft: '0.6vw',
      transform: o ? 'rotate(180deg)' : 'none',
      transition: 'transform 120ms',
      width: iconSize,
      height: iconSize,
      minWidth: iconSize,
      minHeight: iconSize
    }),
    triggerFont: { fontSize: selectFontSize ?? innerFont },
    boxBase: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6vw',
      width: boxWidth,
      height: boxHeight,
      boxSizing: 'border-box' as const,
      border: '1px solid #d0d0d0',
      borderBottom: '1px solid #556b81',
      borderRadius: '0.2vw 0.2vw 0 0',
      padding: '0 0.4vw',
      background: disabled ? '#f3f3f3' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none' as const,
      transition: 'border 0.2s'
    },
    arrowBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      background: 'transparent',
      padding: 0,
      margin: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      outline: 'none'
    } as React.CSSProperties
  }

  return (
    <div ref={wrapperRef} style={S.wrapper}>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}

      <div
        role="group"
        aria-label="custom select"
        style={S.boxBase}
        onClick={onBoxClick}
        onKeyDown={onBoxKeyDown}
        tabIndex={0}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.border = '1px solid #a7cfff'
          el.style.borderBottom = '1px solid #1473e3'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.border = '1px solid #d0d0d0'
          el.style.borderBottom = '1px solid #556b81'
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selected ? '#111' : '#8a8a8a',
            flex: 1,
            ...S.triggerFont
          }}
        >
          {selected ? selected.label : placeholder}
        </span>

        <button
          ref={arrowBtnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="custom-select-listbox"
          onClick={(e) => {
            e.stopPropagation()
            toggleDropdown()
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            onArrowKeyDown(e)
          }}
          style={S.arrowBtn}
          disabled={disabled}
          tabIndex={0}
        >
          <Icon name="navigation-down-arrow" style={S.arrowIcon(open)} />
        </button>
      </div>

      {open && (
        <div
          id="custom-select-listbox"
          role="listbox"
          ref={listRef}
          style={S.list}
          tabIndex={-1}
          aria-activedescendant={activeIndex >= 0 ? `opt-${activeIndex}` : undefined}
        >
          {searchable && (
            <div style={S.searchWrap}>
              <input
                style={S.searchInput}
                placeholder="Search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((i) => clamp((i < 0 ? -1 : i) + 1, 0, filtered.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((i) =>
                      clamp((i < 0 ? filtered.length : i) - 1, 0, filtered.length - 1)
                    )
                  } else if (e.key === 'Enter' && activeIndex >= 0) {
                    e.preventDefault()
                    selectByIndex(activeIndex)
                  }
                }}
              />
            </div>
          )}

          {filtered.length === 0 && (
            <div style={S.option(false, true)} aria-disabled>
              결과 없음
            </div>
          )}

          {filtered.map((opt, i) => {
            const isActive = i === activeIndex
            const id = `opt-${i}`
            return (
              <div
                key={opt.value}
                id={id}
                data-idx={i}
                role="option"
                aria-selected={opt.value === currentValue}
                aria-disabled={!!opt.disabled}
                style={S.option(isActive, !!opt.disabled)}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (opt.disabled) return
                  selectByIndex(i)
                }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      )}

      {errorText ? <div style={S.error}>{errorText}</div> : null}
    </div>
  )
}
