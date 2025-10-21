// src/pages/E_Scan_Defect_POPUP.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, Bar, Button, Input, SegmentedButton, SegmentedButtonItem, StepInput } from '@ui5/webcomponents-react'
import CustomSelect from '@renderer/components/CustomSelect'
import '../pages/E_Scan_Defect_POPUP.css'

export type Side = 'Left' | 'Right'
type DefectDecision = 'Scrap' | 'Return'
type ScrapType = 'Production' | 'Test'

export interface DefectPayload {
  desc: string
  size: string
  side: Side
  qty: number
  defects: string[]
  process?: string
  styleCd?: string
}

export interface EScanDefectPopupProps {
  isOpen: boolean
  onClose: () => void
  onScrap?: (payload: DefectPayload) => void
  onReturn?: (payload: DefectPayload) => void
  process?: string
  defectsByProcess?: Record<string, string[]>
  initialData?: Partial<DefectPayload>
}

const railButtonStyle: React.CSSProperties = { width: '8.4vw', height: '4vh', borderRadius: 6, pointerEvents: 'none' }
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 0, margin: 0 }
type RowProps = { label: string; children: React.ReactNode; contentStyle?: React.CSSProperties; labelStyle?: React.CSSProperties; alignY?: 'start' | 'center' | 'end'; dense?: boolean }
const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end' } as const

const Row: React.FC<RowProps> = memo(({ label, children, contentStyle, labelStyle, alignY = 'center', dense = false }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '11.2vw 1fr', alignItems: alignMap[alignY], columnGap: 16, padding: dense ? 0 : '1vh 0' }}>
    <Button design="Emphasized" style={{ ...railButtonStyle, ...labelStyle }} tabIndex={-1}>{label}</Button>
    <div style={contentStyle}>{children}</div>
  </div>
))
Row.displayName = 'Row'

export default function E_Scan_Defect_POPUP({
  isOpen, onClose, onScrap, onReturn, process, defectsByProcess = {}, initialData = {}
}: EScanDefectPopupProps) {
  const [desc, setDesc] = useState(initialData.desc ?? '')
  const [size, setSize] = useState(initialData.size ?? '')
  const [side, setSide] = useState<Side>((initialData.side as Side) ?? 'Left')
  const [qty, setQty] = useState<number>(Number.isFinite(initialData.qty as number) ? (initialData.qty as number) : 1)
  const [selected, setSelected] = useState<string | null>(initialData.defects && initialData.defects.length > 0 ? initialData.defects[0] : null)
  const [styleCd, setStyleCd] = useState(initialData.styleCd ?? '')
  const [Decision, setDecision] = useState<DefectDecision>('Scrap')
  const [scrapType, setScrapType] = useState<ScrapType>('Production')

  const dialogRef = useRef<HTMLDivElement | null>(null)

  // 초기화
  useEffect(() => {
    setDesc(initialData.desc ?? '')
    setSize(initialData.size ?? '')
    setSide((initialData.side as Side) ?? 'Left')
    setQty(Number.isFinite(initialData.qty as number) ? (initialData.qty as number) : 1)
    setSelected(initialData.defects && initialData.defects.length > 0 ? initialData.defects[0] : null)
    setStyleCd(initialData.styleCd ?? '')
    setDecision('Scrap')
    setScrapType('Production')
  }, [initialData, isOpen])

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Decision 바뀌면 defect 초기화
  useEffect(() => { setSelected(null) }, [Decision])

  // 공정별 defect 목록
  const defects = useMemo(() => {
    const key = process ?? ''
    const list = Array.isArray(defectsByProcess[key]) ? defectsByProcess[key]! : []
    return list
  }, [defectsByProcess, process])

  // 선택값 유효성 가드
  useEffect(() => {
    if (selected && !defects.includes(selected)) setSelected(null)
  }, [defects, selected])

  // 핸들러
  const toggleDefect = useCallback((name: string) => {
    setSelected(prev => (prev === name ? null : name))
  }, [])

  const handleDecisionChange = useCallback((e: any) => {
    const item = e?.detail?.selectedItems?.[0] as HTMLElement | undefined
    const key = item?.getAttribute('data-key') as DefectDecision | null
    if (key) setDecision(key)
  }, [])

  const handleSideChange = useCallback((e: any) => {
    const item = e?.detail?.selectedItems?.[0] as HTMLElement | undefined
    const key = item?.getAttribute('data-key') as Side | null
    if (key) setSide(key)
  }, [])

  const handleScrapTypeChange = useCallback((e: any) => {
    const item = e?.detail?.selectedItems?.[0] as HTMLElement | undefined
    const key = item?.getAttribute('data-key') as ScrapType | null
    if (key) setScrapType(key)
  }, [])

  const handleSubmit = useCallback(() => {
    const payload: DefectPayload = {
      desc, size, side, qty, defects: selected ? [selected] : [], process, styleCd
    }
    if (Decision === 'Scrap') onScrap?.(payload)
    else onReturn?.(payload)
  }, [desc, size, side, qty, selected, process, styleCd, Decision, onScrap, onReturn])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} className="no-focus fixed-x" style={{ width: '48vw', maxWidth: '95vw' }}>
      <div ref={dialogRef} style={{ padding: '2vh' }}>
        <Row label="DESC.">
          <div style={{ display: 'flex', gap: '1vw' }}>
            <Input
              disabled
              value={desc}
              placeholder="Description"
              style={{ width: '15vw', backgroundColor: '#fff', color: '#000', cursor: 'not-allowed', opacity: 1, textAlign: 'center', lineHeight: '2em' }}
            />
            <Input
              disabled
              value={size}
              placeholder="Size"
              style={{ width: '5vw', backgroundColor: '#fff', color: '#000', cursor: 'not-allowed', opacity: 1, textAlign: 'center', lineHeight: '2em' }}
            />
          </div>
        </Row>

        <Row label="Scrap/Return">
          <SegmentedButton onSelectionChange={handleDecisionChange}>
            <SegmentedButtonItem selected={Decision === 'Scrap'} data-key="Scrap" style={{ width: '8vw' }}>Scrap</SegmentedButtonItem>
            <SegmentedButtonItem selected={Decision === 'Return'} data-key="Return" style={{ width: '8vw' }}>Return</SegmentedButtonItem>
          </SegmentedButton>
        </Row>

        {/* TODO:: API, 상태관리 추가 */}
        <Row label="Component">
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: 'fit-content' }}>
            <CustomSelect options={['FSS', 'OSP']} />
          </div>
        </Row>

        <Row label="L/R">
          <SegmentedButton onSelectionChange={handleSideChange}>
            <SegmentedButtonItem selected={side === 'Left'} data-key="Left" style={{ width: '8vw' }}>Left</SegmentedButtonItem>
            <SegmentedButtonItem selected={side === 'Right'} data-key="Right" style={{ width: '8vw' }}>Right</SegmentedButtonItem>
          </SegmentedButton>
        </Row>

        <Row label="Qty">
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: 'fit-content' }}>
            <StepInput
              value={qty}
              min={1}
              onChange={(e: any) => {
                const v = e?.detail?.value ?? (e?.target?.valueAsNumber ?? e?.target?.value)
                const n = Number(v)
                if (Number.isFinite(n) && n >= 1) setQty(n)
              }}
              style={{ width: '8vw' }}
            />
          </div>
        </Row>

        {Decision === 'Scrap' && (
          <Row label="Mini Line">
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: 'fit-content' }}>
              <CustomSelect options={['001', '002', '003']} />
            </div>
          </Row>
        )}

        {Decision === 'Scrap' && (
          <Row label="Type">
            <SegmentedButton onSelectionChange={handleScrapTypeChange}>
              <SegmentedButtonItem selected={scrapType === 'Production'} data-key="Production" style={{ width: '8vw' }}>Production</SegmentedButtonItem>
              <SegmentedButtonItem selected={scrapType === 'Test'} data-key="Test" style={{ width: '8vw' }}>Test</SegmentedButtonItem>
            </SegmentedButton>
          </Row>
        )}

        {Decision === 'Scrap' && (
          <Row label="Reason" alignY="start" dense>
            <div style={gridStyle as any}>
              {defects.map(d => (
                <Button
                  key={d}
                  design={selected === d ? 'Emphasized' : 'Default'}
                  onClick={() => toggleDefect(d)}
                  style={{ marginTop: 0 }}
                >
                  {d}
                </Button>
              ))}
            </div>
          </Row>
        )}
      </div>

      <Bar
        slot="footer"
        endContent={
          <div style={{ display: 'flex', gap: '0.8vw' }}>
            <Button design="Emphasized" onClick={handleSubmit} disabled={Decision === 'Scrap' && !selected}>Submit</Button>
            <Button design="Transparent" onClick={onClose}>Close</Button>
          </div>
        }
      />
    </Dialog>
  )
}
