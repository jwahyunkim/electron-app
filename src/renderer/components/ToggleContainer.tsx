// ToggleContainer.tsx
import React from 'react'
import { Icon } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/slim-arrow-up'
import '@ui5/webcomponents-icons/dist/slim-arrow-down'

export interface ToggleSectionProps {
  title?: React.ReactNode
  showTopBar?: boolean
  topBarWidth?: number | string
  topBarStyle?: React.CSSProperties
  topBarClassName?: string
  titleStyle?: React.CSSProperties
  titleClassName?: string
  rightActions?: React.ReactNode

  collapsed?: boolean
  defaultCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void

  hideWithCssOnly?: boolean

  buttonSize?: number
  buttonStyle?: React.CSSProperties
  buttonClassName?: string
  buttonIconCollapsed?: string
  buttonIconExpanded?: string
  buttonAriaLabelCollapsed?: string
  buttonAriaLabelExpanded?: string
  renderButton?: (collapsed: boolean, toggle: () => void) => React.ReactNode

  className?: string                 // root 전용
  style?: React.CSSProperties        // root 전용(배경은 content로 이관)
  contentWrapperStyle?: React.CSSProperties // content 전용
  children?: React.ReactNode

  useWrapperDiv?: boolean

  lockMinWidthOnExpand?: boolean
  minWidthFrom?: 'content' | 'container' | 'topBar'
}

export default function ToggleContainer({
  title,
  showTopBar = true,
  topBarWidth = 'auto',
  topBarStyle,
  topBarClassName,
  titleStyle,
  titleClassName,
  rightActions,

  collapsed,
  defaultCollapsed = false,
  onToggle,
  hideWithCssOnly = false,

  buttonSize = 28,
  buttonStyle,
  buttonClassName,
  buttonIconCollapsed = 'slim-arrow-down',
  buttonIconExpanded = 'slim-arrow-up',
  buttonAriaLabelCollapsed = 'Expand content',
  buttonAriaLabelExpanded = 'Collapse content',
  renderButton,

  className,
  style,
  contentWrapperStyle,
  children,
  useWrapperDiv = false,

  lockMinWidthOnExpand = false,
  minWidthFrom = 'container',
}: ToggleSectionProps) {
  const isControlled = typeof collapsed === 'boolean'
  const [innerCollapsed, setInnerCollapsed] = React.useState<boolean>(defaultCollapsed)
  const collapsedNow = isControlled ? (collapsed as boolean) : innerCollapsed

  const toggle = React.useCallback(() => {
    const next = !collapsedNow
    if (!isControlled) setInnerCollapsed(next)
    onToggle?.(next)
  }, [collapsedNow, isControlled, onToggle])

  const toCssWidth = (w: number | string) => (typeof w === 'number' ? `${w}px` : w)

  // refs
  const rootRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const topBarRef = React.useRef<HTMLDivElement>(null)

  // 선택적 minWidth 잠금(유지)
  const [lockedMinWidth, setLockedMinWidth] = React.useState<number | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (!lockMinWidthOnExpand) return
    if (collapsedNow) return
    const target =
      minWidthFrom === 'content'
        ? contentRef.current
        : minWidthFrom === 'topBar'
          ? topBarRef.current
          : rootRef.current
    if (!target) return
    const update = (w: number) =>
      setLockedMinWidth(prev => (prev && prev > w ? prev : w))
    update(Math.ceil(target.getBoundingClientRect().width))
    const ro = new ResizeObserver(entries => {
      for (const e of entries) update(Math.ceil(e.contentRect.width))
    })
    ro.observe(target)
    return () => ro.disconnect()
  }, [lockMinWidthOnExpand, minWidthFrom, collapsedNow])

  const measuredStyleFor = (which: 'container' | 'topBar' | 'content') => {
    if (!lockMinWidthOnExpand || !lockedMinWidth) return undefined
    return minWidthFrom === which ? { minWidth: `${lockedMinWidth}px` } : undefined
  }

  // root 배경은 content로 이관
  const { background: rootBg, backgroundColor: rootBgc, ...rootStyleFromProp } = style || {}

  // root: 자식 폭에 끌려가지 않도록 독립. 부모 < 자식 허용.
  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: rootStyleFromProp.width ?? 'auto',
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: 0,
    overflowX: 'visible',
    ...rootStyleFromProp,
    ...(measuredStyleFor('container') || {}),
  }

  // topbar: content와 완전 독립. width는 topBarWidth만 따름.
  const topBarMergedStyle: React.CSSProperties = {
    position: 'relative',
    width: toCssWidth(topBarWidth as any),
    boxSizing: 'border-box',
    padding: '6px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: buttonSize,
    flex: '0 0 auto',
    ...(topBarStyle || {}),
    ...(measuredStyleFor('topBar') || {}),
  }

  // content: inline-block으로 자체 폭 사용. 배경은 root에서 이관.
  const contentBaseStyle: React.CSSProperties = {
    display: 'inline-block',
    boxSizing: 'border-box',
    minHeight: 0,
    ...(contentWrapperStyle || {}),
    ...(measuredStyleFor('content') || {}),
  }
  if (rootBg !== undefined) (contentBaseStyle as any).background = rootBg
  if (rootBgc !== undefined) (contentBaseStyle as any).backgroundColor = rootBgc

  const renderContent = () => {
    if (hideWithCssOnly || useWrapperDiv) {
      return (
        <div
          ref={minWidthFrom === 'content' ? contentRef : undefined}
          style={{
            display: collapsedNow ? 'none' : 'inline-block',
            ...contentBaseStyle,
          }}
        >
          {children}
        </div>
      )
    }
    if (collapsedNow) return null
    return minWidthFrom === 'content' ? (
      <div ref={contentRef} style={contentBaseStyle}>
        {children}
      </div>
    ) : (
      <div style={contentBaseStyle}>{children}</div>
    )
  }

  return (
    <div ref={rootRef} className={className} style={rootStyle}>
      {showTopBar && (
        <div ref={topBarRef} className={topBarClassName} style={topBarMergedStyle}>
          <div className={titleClassName} style={{ display: 'inline-flex', alignItems: 'center', ...(titleStyle || {}) }}>
            {title}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {rightActions}
            {renderButton ? (
              renderButton(collapsedNow, toggle)
            ) : (
              <button
                type="button"
                aria-label={collapsedNow ? buttonAriaLabelCollapsed : buttonAriaLabelExpanded}
                aria-expanded={!collapsedNow}
                onClick={toggle}
                className={buttonClassName}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,

                  ...(buttonStyle || {}),
                }}
              >
                <Icon style={{ color: '#0064d9' }} name={collapsedNow ? buttonIconCollapsed : buttonIconExpanded} />
              </button>
            )}
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  )
}
