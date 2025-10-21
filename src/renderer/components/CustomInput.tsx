// src/components/CustomInput.tsx
import React from 'react'

type Props = {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  boxWidth?: string   // '20vw'
  boxHeight?: string  // '4vh'
  innerFont?: string  // '1vw'
  disabled?: boolean
  readOnly?: boolean
  name?: string
  errorText?: string
}

export default function CustomInput({
  value,
  onChange,
  placeholder = '',
  boxWidth = '20vw',
  boxHeight = '4vh',
  innerFont = '1vw',
  disabled = false,
  readOnly = false,
  name,
  errorText
}: Props) {
  type Cursor = 'not-allowed' | 'default' | 'text'

  const isDisabled = !!disabled
  const isReadOnly = !!readOnly
  const isInactive = isDisabled || isReadOnly

  const bgColor = isDisabled ? '#e0e0e0' : isReadOnly ? '#f2f2f2' : '#fff'
  const textColor = isDisabled ? '#9e9e9e' : isReadOnly ? '#555' : '#111'
  const cursorStyle: Cursor = isDisabled ? 'not-allowed' : isReadOnly ? 'default' : 'text'

  const S = {
    wrapper: {
      width: boxWidth,
      position: 'relative',
      fontSize: innerFont
    },
    boxBase: {
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
      background: bgColor,
      cursor: cursorStyle,
      userSelect: 'none',
      transition: 'border 0.2s'
    },
    input: {
      flex: 1,
      width: '100%',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'inherit',
      color: textColor
    },
    error: { marginTop: '0.6vh', color: '#d32f2f', fontSize: '0.9em' }
  } satisfies Record<string, React.CSSProperties>

  return (
    <div style={S.wrapper}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <div
        role="group"
        aria-label="custom input"
        aria-disabled={isDisabled}
        aria-readonly={isReadOnly}
        style={S.boxBase}
        onMouseEnter={(e) => {
          if (isInactive) return
          const el = e.currentTarget as HTMLDivElement
          el.style.border = '1px solid #a7cfff'
          el.style.borderBottom = '1px solid #1473e3'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.border = '1px solid #d0d0d0'
          el.style.borderBottom = '1px solid #556b81'
        }}
        onClick={(e) => {
          if (isDisabled) return
          const input = (e.currentTarget.querySelector('input') as HTMLInputElement | null)
          input?.focus()
        }}
      >
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={isDisabled}
          readOnly={isReadOnly}
          autoComplete="off"
          style={S.input}
        />
      </div>

      {errorText ? <div style={S.error}>{errorText}</div> : null}
    </div>
  )
}
