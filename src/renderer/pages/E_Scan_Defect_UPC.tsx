// src/pages/E_Scan_Defect_UPC.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlexBox, AnalyticalTable, ListItemCustom, ListItemStandard, List, Dialog, Bar, Button, Input, SegmentedButton, SegmentedButtonItem, StepInput } from '@ui5/webcomponents-react'
import '../pages/E_Scan_Defect_UPC.css'

import TimeNow from '../components/TimeNow'
import CustomDatePicker from '../components/CustomDatePicker'
const DatePicker = CustomDatePicker
import CustomSelect from '../components/CustomSelect'
import { useNavigate } from 'react-router-dom'

import CustomGrid from '../components/grid'
import CustomInput from '@renderer/components/CustomInput'
import CustomButton from '@renderer/components/CustomButton'
import CustomTable from '@renderer/components/CustomTable'
import ToggleContainer from '../components/ToggleContainer'

import ScanListener from '../components/ScanListener'

import useScrollbarWidth from '../hooks/useScrollbarWidth'
import useSumRow from '../hooks/useSumRow'

import AlertDialog, { AlertDialogRef } from "../components/AlertDialog";
import SaveButton from '@renderer/components/SaveButton'


const railButtonStyle: React.CSSProperties = { margin: '0', width: 'auto', height: '4vh', borderRadius: 6, pointerEvents: 'none', padding: '0 2vw', overflow: 'visible' }
type RowProps = { label: string; children: React.ReactNode; contentStyle?: React.CSSProperties; labelStyle?: React.CSSProperties; alignY?: 'start' | 'center' | 'end'; dense?: boolean }
const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end' } as const

const Row: React.FC<RowProps> = memo(({ label, children, contentStyle, labelStyle, alignY = 'center', dense = false }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: alignMap[alignY], columnGap: '2vw', padding: dense ? 0 : '1vh 0' }}>
    <Button design="Emphasized" style={{ ...railButtonStyle, ...labelStyle }} tabIndex={-1}>{label}</Button>
    <div style={contentStyle}>{children}</div>
  </div>
))

type DefectType = 'B' | 'C'

type DefectMaster = {
  plantCd: string
  opCd: string
  defectCode: string
  defectName: string
  defectNameEn: string
  sortSeq: number
  valDate: string
}


export default function E_Scan_Defect_UPC(): JSX.Element {
  const navigate = useNavigate()

  const [barcode, setBarcode] = useState()
  const [selected, setSelected] = useState<string | null>()
  const [type, setType] = useState<DefectType>('B')

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [defectName, setDefectName] = useState<string[]>([])
  const [debugMode, setDebugMode] = useState(false)


  const [selectedStyleCd, setSelectedStyleCd] = useState("");
  const [selectedLineCd, setSelectedLineCd] = useState("");
  const [selectedlineCd, setSelectedlineCd] = useState("");
  const [selectedSizeCd, setSelectedSizeCd] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);

  const [collapsedState, setCollapsedState] = useState({ input: true, report: true })

  // 스캐너
  const [isManual, setIsManual] = useState(false)   // false=스캐너, true=수동
  const [scanValue, setScanValue] = useState("")
  const scanInputRef = useRef<HTMLInputElement | null>(null)

  const [data_grid1_content, setDataGrid1Content] = useState<string[][]>([])


  //토글 핸들러
  const handleToggle = (key: 'input' | 'report') => (collapsed: boolean) =>
    setCollapsedState(prev => ({ ...prev, [key]: collapsed }))

  // 모드 전환 핸들러

  const handleScan = (code: string) => {
    setScanValue(code)
    scanInputRef.current?.focus()
  }

  // 토글 시 값 초기화
  const toggleManual = () => {
    setIsManual(prev => !prev)
    setScanValue("")
  }

  useEffect(() => {
    console.log("업데이트 후 값:", data_grid1_content)
  }, [data_grid1_content])


  const sortSize = (a: string, b: string) => {
    const regex = /^(\d+)(T?)$/;
    const ma = a.match(regex);
    const mb = b.match(regex);

    if (ma && mb) {
      const numA = Number(ma[1]);
      const numB = Number(mb[1]);
      if (numA !== numB) return numA - numB;

      // 같은 숫자면 "" < "T"
      return ma[2].localeCompare(mb[2]);
    }
    // 숫자 패턴 아닌 건 맨 뒤로
    if (ma) return -1;
    if (mb) return 1;
    return a.localeCompare(b);
  };

  const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n)
  const toYmd = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`

  const unique = (arr: string[]) => Array.from(new Set(arr));

  const styleCdOptions = unique(data_grid1_content.map(r => r[0] ?? ""));
  const lineCdOptions = unique(data_grid1_content.map(r => r[1] ?? ""));
  const sizeCdOptions = unique(data_grid1_content.map(r => r[2] ?? "")).sort(sortSize);

  async function fetchDefectCodes(opts?: { plant?: string; op?: string; asOf?: string }) {
    const plant = opts?.plant ?? 'C200'
    const op = opts?.op ?? 'UPC'
    const params = new URLSearchParams({ plant, op })
    if (opts?.asOf) params.append('asOf', opts.asOf)

    const res = await fetch(`http://127.0.0.1:4000/api/mssql/defects/current?${params.toString()}`)
    if (!res.ok) throw new Error(`defects/current HTTP ${res.status}`)
    const rows: DefectMaster[] = await res.json()

    // 정렬: SORT_SEQ, DEFECT_CODE
    rows.sort((a, b) => {
      const s = (a.sortSeq ?? 0) - (b.sortSeq ?? 0)
      if (s !== 0) return s
      return String(a.defectName).localeCompare(String(b.defectName))
    })
    console.log('defect names', rows)
    // 팝업에서 코드만 사용하므로 코드 배열만 전달
    setDefectName(rows.map(r => String(r.defectName || '')))
  }


  useEffect(() => {
    fetchDefectCodes({ plant: 'C200', op: 'UPC' })
  }, [])
  
  const defect_sample = [
    [
      'High cement', 'Upper Contamination', 'Bottom Contamination',
      'Thread end', 'Wrinkle on upper', 'Wrinkle on bottom', 'Center off', 'L/R consistency', 'Poor', 'stitching',
      'Poor Painting', 'Upper Damage', 'Others'
    ]
  ]

  const lineCd_sample = ['1', '2', '3', '4', '5',]

  const columns = [
    { Header: 'Barcode No', accessor: 'bcode' },
    { Header: 'Line', accessor: 'lineCd' },
    { Header: 'Grade', accessor: 'defectTpye' },
    { Header: 'Defect', accessor: 'defect' },
    { Header: 'Created On', accessor: 'createddate' }
    //줄바꿈 공백 줄바꿈
    // {
    //   Header: 'Created On',
    //   accessor: (row: any) =>
    //     typeof row.createddate === 'string'
    //       ? row.createddate.replace(/ {2,}/g, '\n')
    //       : row.createddate
    // },

  ];

  const data = [
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '1' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '2' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '3' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '2' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '1' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '1' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '4' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '5' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'B', createddate: '2025-09-22  7:48:48 AM', lineCd: '1' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'A', createddate: '2025-09-03  9:30:42 AM', lineCd: '4' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '5' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'A', createddate: '2025-09-03  9:30:42 AM', lineCd: '1' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '3' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'A', createddate: '2025-09-03  9:30:42 AM', lineCd: '1' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '2' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '1' },
    { bcode: 43452938, defect: 'Allen Best', defectTpye: 'A', createddate: '2025-09-22  7:48:48 AM', lineCd: '3' },
    { bcode: 43423138, defect: 'Combs Fleming', defectTpye: 'B', createddate: '2025-09-03  9:30:42 AM', lineCd: '3' },
    { bcode: 24552938, defect: 'Combs Fleming', defectTpye: 'A', createddate: '2025-09-01  11:58:32 AM', lineCd: '1' }
  ];

  const columns2 = [
    { Header: "Barcode", accessor: "barcode" },
    { Header: "Grade", accessor: "statuses.Type" },
    { Header: "Bonding gap", accessor: "statuses.bondingGap" },
    { Header: "High cement", accessor: "statuses.highCement" },
    { Header: "Upper Contamination", accessor: "statuses.upperContamination" },
    { Header: "Bottom Contamination", accessor: "statuses.bottomContamination" },
    { Header: "Thread end", accessor: "statuses.threadEnd" },
    { Header: "Wrinkle on upper", accessor: "statuses.wrinkleUpper" },
    { Header: "Wrinkle on bottom", accessor: "statuses.wrinkleBottom" },
    { Header: "Center off", accessor: "statuses.centerOff" },
    { Header: "L/R consistency", accessor: "statuses.lrConsistency" },
    { Header: "Poor stitching", accessor: "statuses.poorStitching" },
    { Header: "Poor Painting", accessor: "statuses.poorPainting" },
    { Header: "Upper Damage", accessor: "statuses.upperDamage" },
    { Header: "Others", accessor: "statuses.others" },
  ];

  const data2 = [
    {
      barcode: "786804008",
      statuses: {
        Type: "B",
        bondingGap: 1,
        highCement: 0,
        upperContamination: 3,
        bottomContamination: 2,
        threadEnd: 1,
        wrinkleUpper: 0,
        wrinkleBottom: 3,
        centerOff: 1,
        lrConsistency: 2,
        poorStitching: 0,
        poorPainting: 1,
        upperDamage: 3,
        others: 2
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "C",
        bondingGap: 2,
        highCement: 3,
        upperContamination: 1,
        bottomContamination: 0,
        threadEnd: 2,
        wrinkleUpper: 1,
        wrinkleBottom: 0,
        centerOff: 3,
        lrConsistency: 1,
        poorStitching: 2,
        poorPainting: 0,
        upperDamage: 1,
        others: 3
      }
    },
    {
      barcode: "786804010",
      statuses: {
        Type: "B",
        bondingGap: 0,
        highCement: 2,
        upperContamination: 1,
        bottomContamination: 3,
        threadEnd: 0,
        wrinkleUpper: 2,
        wrinkleBottom: 1,
        centerOff: 0,
        lrConsistency: 3,
        poorStitching: 1,
        poorPainting: 2,
        upperDamage: 0,
        others: 3
      }
    },
    {
      barcode: "786804010",
      statuses: {
        Type: "C",
        bondingGap: 3,
        highCement: 1,
        upperContamination: 0,
        bottomContamination: 2,
        threadEnd: 3,
        wrinkleUpper: 1,
        wrinkleBottom: 0,
        centerOff: 2,
        lrConsistency: 1,
        poorStitching: 0,
        poorPainting: 3,
        upperDamage: 2,
        others: 1
      }
    },
    {
      barcode: "786804017",
      statuses: {
        Type: "B",
        bondingGap: 1,
        highCement: 3,
        upperContamination: 2,
        bottomContamination: 0,
        threadEnd: 1,
        wrinkleUpper: 3,
        wrinkleBottom: 2,
        centerOff: 0,
        lrConsistency: 1,
        poorStitching: 2,
        poorPainting: 3,
        upperDamage: 0,
        others: 1
      }
    },
    {
      barcode: "786804017",
      statuses: {
        Type: "C",
        bondingGap: 2,
        highCement: 0,
        upperContamination: 1,
        bottomContamination: 3,
        threadEnd: 2,
        wrinkleUpper: 0,
        wrinkleBottom: 1,
        centerOff: 3,
        lrConsistency: 2,
        poorStitching: 1,
        poorPainting: 0,
        upperDamage: 3,
        others: 2
      }
    },
    {
      barcode: "786804084",
      statuses: {
        Type: "B",
        bondingGap: 0,
        highCement: 1,
        upperContamination: 2,
        bottomContamination: 3,
        threadEnd: 0,
        wrinkleUpper: 1,
        wrinkleBottom: 2,
        centerOff: 3,
        lrConsistency: 1,
        poorStitching: 0,
        poorPainting: 2,
        upperDamage: 3,
        others: 1
      }
    },
    {
      barcode: "786804084",
      statuses: {
        Type: "C",
        bondingGap: 3,
        highCement: 2,
        upperContamination: 0,
        bottomContamination: 1,
        threadEnd: 3,
        wrinkleUpper: 2,
        wrinkleBottom: 0,
        centerOff: 1,
        lrConsistency: 3,
        poorStitching: 0,
        poorPainting: 2,
        upperDamage: 1,
        others: 3
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "B",
        bondingGap: 1,
        highCement: 0,
        upperContamination: 2,
        bottomContamination: 3,
        threadEnd: 1,
        wrinkleUpper: 0,
        wrinkleBottom: 2,
        centerOff: 3,
        lrConsistency: 0,
        poorStitching: 1,
        poorPainting: 3,
        upperDamage: 2,
        others: 1
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "C",
        bondingGap: 2,
        highCement: 3,
        upperContamination: 1,
        bottomContamination: 0,
        threadEnd: 2,
        wrinkleUpper: 3,
        wrinkleBottom: 1,
        centerOff: 0,
        lrConsistency: 2,
        poorStitching: 0,
        poorPainting: 1,
        upperDamage: 3,
        others: 2
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "B",
        bondingGap: 0,
        highCement: 2,
        upperContamination: 3,
        bottomContamination: 1,
        threadEnd: 0,
        wrinkleUpper: 2,
        wrinkleBottom: 3,
        centerOff: 1,
        lrConsistency: 0,
        poorStitching: 3,
        poorPainting: 1,
        upperDamage: 2,
        others: 3
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "C",
        bondingGap: 3,
        highCement: 1,
        upperContamination: 0,
        bottomContamination: 2,
        threadEnd: 3,
        wrinkleUpper: 1,
        wrinkleBottom: 0,
        centerOff: 2,
        lrConsistency: 1,
        poorStitching: 0,
        poorPainting: 2,
        upperDamage: 3,
        others: 1
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "B",
        bondingGap: 1,
        highCement: 3,
        upperContamination: 2,
        bottomContamination: 0,
        threadEnd: 1,
        wrinkleUpper: 3,
        wrinkleBottom: 2,
        centerOff: 0,
        lrConsistency: 3,
        poorStitching: 2,
        poorPainting: 0,
        upperDamage: 1,
        others: 3
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "C",
        bondingGap: 2,
        highCement: 0,
        upperContamination: 1,
        bottomContamination: 3,
        threadEnd: 2,
        wrinkleUpper: 0,
        wrinkleBottom: 1,
        centerOff: 3,
        lrConsistency: 0,
        poorStitching: 1,
        poorPainting: 3,
        upperDamage: 2,
        others: 1
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "B",
        bondingGap: 0,
        highCement: 1,
        upperContamination: 2,
        bottomContamination: 3,
        threadEnd: 0,
        wrinkleUpper: 1,
        wrinkleBottom: 2,
        centerOff: 3,
        lrConsistency: 1,
        poorStitching: 2,
        poorPainting: 3,
        upperDamage: 0,
        others: 1
      }
    },
    {
      barcode: "786804008",
      statuses: {
        Type: "C",
        bondingGap: 3,
        highCement: 2,
        upperContamination: 0,
        bottomContamination: 1,
        threadEnd: 3,
        wrinkleUpper: 2,
        wrinkleBottom: 0,
        centerOff: 1,
        lrConsistency: 0,
        poorStitching: 2,
        poorPainting: 1,
        upperDamage: 3,
        others: 0
      }
    }
  ]
    ;

  ///

  ///

  const scrollsize = useScrollbarWidth()

  const rowSizes_grid1_header: Record<number, string> = { 0: '4vh' }
  const totalHeightRaw_grid1_header = Object.values(rowSizes_grid1_header).map(parseFloat).reduce((a, b) => a + b, 0)

  const rowSizes_grid1_contents: Record<number, string> = {}
  for (let i = 0; i < data_grid1_content.length; i++) rowSizes_grid1_contents[i] = '4vh'







  // --------- DB Insert ----------
  // ------------------------------

  // 스캔 완료 시 입력칸에 넣고 포커스





  return (
    <div className={debugMode ? 'dev-main' : ''} style={{ height: '98vh', display: 'flex', overflow: 'auto', flexDirection: 'column', backgroundColor: debugMode ? '#00ccff' : '#f5f6f7' }}>
      {!isManual && (
        <ScanListener
          onScan={handleScan}
          delimiterKeys={["Enter"]}
          timeoutMs={60}
        />
      )}

      {/* 상단 */}
      <div
        className={debugMode ? 'dev-scope-header' : ''}
        style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0, height: '8vh', backgroundColor: '#203764' }}
      >
        <div style={{ fontSize: '2vw', color: 'white', display: 'flex', alignItems: 'center', marginLeft: '1vw' }}>
          Defective Management - UPC
        </div>
        <Button onClick={() => setDebugMode(!debugMode)}>{debugMode ? 'Debug OFF' : 'Debug ON'}</Button>
        <div style={{ fontSize: '2vw', color: 'white', display: 'flex', alignItems: 'center', marginRight: '1vw' }}
          onClick={() => navigate('/')}>
          <TimeNow />
        </div>
      </div>

      {/* 필터 행 */}
      <div className={debugMode ? 'dev-scope-section sticky-header' : 'sticky-header'} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, backgroundColor: '#f5f6f7' }}>
        {/* 뱃지 */}
        <div
          className={debugMode ? 'dev-scope-stats-row' : ''}
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '1vh', gap: '1vw' }}
        >
          <label style={{ display: "inline-flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isManual}
              onChange={toggleManual}
            />
            Manual Input
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: "1vw" }}>

            <div
              style={{
                color: 'white',
                fontStyle: 'italic',
                fontWeight: 'bold',
                borderRadius: '0.2vw',
                textAlign: 'center',
                fontSize: '1vw',
                height: '2.8vh',
                width: '10vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a6ed1'
              }}
            >
              input : 1,072 Pairs
            </div>
            <div
              style={{
                color: 'white',
                fontStyle: 'italic',
                fontWeight: 'bold',
                borderRadius: '0.2vw',
                textAlign: 'center',
                fontSize: '1vw',
                height: '2.8vh',
                width: '10vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a6ed1'
              }}
            >
              Defect : 203 Pairs
            </div>
          </div>
        </div>

        <div className={debugMode ? 'dev-scope-grid-section' : ''}
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '1vh', margin: '1vh', marginTop: 0, height: 'auto', width: 'auto' }}>
          {/* 옵션 선택 */}
          <div style={{ display: "flex", gap: "1vw", alignItems: "center", flexWrap: "wrap", width: '100%' }}>
            {/* 첫번째 행 */}
            <div style={{ display: "flex", gap: "2vw", alignItems: "center", flexWrap: "wrap", width: '100%' }}>
              {/* Barcode */}
              <div style={{ display: "flex", flexDirection: 'column', alignItems: "flex-start" }}>
                <span className="label-colon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#556b82",
                    borderRadius: "0.25rem",
                    fontWeight: 'normal',
                    fontSize: "1rem",
                    height: "4vh",
                    minWidth: "7vw",
                  }}
                >
                  Barcode
                </span>
                {/* TODO:: UPC No에 대한 자릿수 확인으로 Validation Check */}
                <CustomInput
                  value={scanValue}
                  onChange={setScanValue}
                  readOnly={!isManual}
                  boxWidth="15vw"
                  boxHeight="4vh"
                  innerFont="1vw"
                  placeholder="Scan barcode"
                />
              </div>

              {/* Qty_	Box 1개에 대한 검사 결과를 등록하므로, Qty 입력은 불필요 */}
              <div style={{ display: "flex", flexDirection: 'column', alignItems: "flex-start" }}>
                <span className="label-colon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#556b82",
                    borderRadius: "0.25rem",
                    fontWeight: 'normal',
                    fontSize: "1rem",
                    height: "4vh",
                    minWidth: "7vw",
                  }}
                >
                  Line
                </span>
                <CustomSelect
                  options={lineCd_sample}
                  value={selectedLineCd}
                  onChange={(val: any) => setSelectedLineCd(val)}
                  placeholder=""
                  selectFontSize="0.9vw"
                  iconSize="1vw"
                  name="lineCd"
                  boxWidth="10vw" />
              </div>
              {/* Type */}
              <div style={{ display: "flex", flexDirection: 'column', alignItems: "flex-start" }}>
                <span className="label-colon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#556b82",
                    borderRadius: "0.25rem",
                    fontWeight: 'normal',
                    fontSize: "1rem",
                    height: "4vh",
                    minWidth: "7vw",
                  }}
                >
                  Type
                </span>
                <SegmentedButton
                  style={{ display: "flex", gap: "0.6vw" }}
                  onSelectionChange={(e: any) => {
                    const key = e.detail.selectedItem?.dataset?.key as DefectType;
                    if (key === "B" || key === "C") setType(key);
                  }}
                >
                  <SegmentedButtonItem style={{ flex: 1, minWidth: "8vw" }} selected={type === "B"} data-key="B">
                    B Grade
                  </SegmentedButtonItem>
                  <SegmentedButtonItem style={{ flex: 1, minWidth: "8vw" }} selected={type === "C"} data-key="C">
                    C Grade
                  </SegmentedButtonItem>
                </SegmentedButton>
              </div>
              <div style={{ display: "flex", flexDirection: 'column', alignItems: "flex-start" }}>
                <span className="label-colon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#556b82",
                    borderRadius: "0.25rem",
                    fontWeight: 'normal',
                    fontSize: "1rem",
                    height: "4vh",
                    minWidth: "7vw",
                  }}
                >
                  Defect
                </span>
                <CustomSelect
                  options={defectName}
                  value={selectedStyleCd}
                  onChange={(val: any) => setSelectedStyleCd(val)}
                  placeholder=""
                  selectFontSize="0.9vw"
                  iconSize="1vw"
                  name="styleCd"
                  boxWidth="20vw" />
              </div>

              <div style={{ display: "flex", flexDirection: 'column', alignItems: "flex-start" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#556b82",
                    borderRadius: "0.25rem",
                    fontWeight: 'normal',
                    fontSize: "1rem",
                    height: "4vh",
                    minWidth: "7vw",
                  }}
                >
                </span>
                <SaveButton />

              </div>
            </div>
          </div>
        </div>
      </div>


      <div className={`${debugMode ? 'dev-scope-grid-section' : ''} custom-scroll`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', margin: '1vh', height: 'auto', width: 'auto', overflowY: 'visible' }}
      >
        <ToggleContainer
          topBarWidth="97vw"
          topBarStyle={{ height: '5vh', borderBottom: '1px solid #3a3a3aff', backgroundColor: '#ffff', boxShadow: "0 2px 6px #00000014" }}
          title='Report'
          titleStyle={{ fontSize: '1.3rem', margin: '0 10px', fontWeight: 'bolder', }}
          // useWrapperDiv={true}
          defaultCollapsed={true}
          onToggle={handleToggle('report')}
          style={{ width: 'auto', height: 'auto', backgroundColor: '#ffffff' }}
        // lockMinWidthOnExpand
        // minWidthFrom="content" // wrapper 없을 때 권장
        >
          <CustomTable
            rootClassName='my-table1'
            scrollClassName="custom-scroll"
            mergedCells={Array.from({ length: data2.length / 2 }, (_, i) => ({
              row: i * 2 + 1,
              col: 0,
              rowSpan: 2
            }))}


            mergedCellsSpecMode='original'
            // enableColumnResize={false} //리사이징 고정
            columns={columns2}
            data={data2}
            colSizes={{
              0: "10vw",   // Style Code
              1: "6vw",   // Grade
              2: "6vw",   // Bonding gap
              3: "6vw",   // High cement
              4: "8vw",   // Upper Contamination
              5: "8vw",   // Bottom Contamination
              6: "5vw",   // Thread end
              7: "6vw",   // Wrinkle on upper
              8: "7vw",   // Wrinkle on bottom
              9: "5vw",   // Center off
              10: "6vw",  // L/R consistency
              11: "6vw",  // Poor stitching
              12: "6vw",  // Poor Painting
              13: "6vw",  // Upper Damage
              14: "5vw",  // Others
            }}

            rowSizes={{
              ...(() => {
                const obj: Record<number, string> = {};
                obj[0] = '5vh'
                for (let i = 1; i < 100; i++) {
                  obj[i] = '4vh';
                }
                return obj;
              })(),
            }}
            visibleRows={8}
            horizontalAlign='center'
            hasVerticalOverflow
            cellStyle={(row, col) => {
              if (row === 0) {  // Age 열 (index 1)
                return { fontSize: '0.8em' }
              }
              if (row > 0 && col === 1) {  // Age 열 (index 1)
                return { color: '#0064d9', fontWeight: 'bold' }
              }
              if (row > 0 && col === 4) { // createddate 열
                return { whiteSpace: 'pre-wrap' }   // 줄바꿈 가능
              }
              return {}
            }}
          />
        </ToggleContainer>
      </div>


      <div className={`${debugMode ? 'dev-scope-grid-section' : ''} custom-scroll`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', margin: '0 1vh', height: 'auto', width: 'auto', overflowY: 'visible' }}
      >
        <ToggleContainer

          title='Input'
          titleStyle={{ fontSize: '1.3rem', margin: '0 10px', fontWeight: 'bolder', }}
          topBarWidth="97vw"
          topBarStyle={{ height: '5vh', borderBottom: '1px solid #3a3a3aff', backgroundColor: '#ffff', boxShadow: "0 2px 6px #00000014" }}
          // useWrapperDiv={true}
          defaultCollapsed={true}
          onToggle={handleToggle('input')}
          style={{ width: 'auto', height: 'auto', backgroundColor: 'red' }}
        // lockMinWidthOnExpand
        // minWidthFrom="content" // wrapper 없을 때 권장
        >
          <CustomTable
            rootClassName='my-table2'
            scrollClassName="custom-scroll"
            columns={columns}
            data={data}
            colSizes={{ 0: '12vw', 1: '5vw', 2: '8vw', 3: '20vw', 4: '15vw', }}
            rowSizes={{
              ...(() => {
                const obj: Record<number, string> = {};
                obj[0] = '5vh'
                for (let i = 1; i < 100; i++) {
                  obj[i] = '6.5vh';
                }
                return obj;
              })(),
            }}
            columnAlign={{ 1: 'right', 2: 'right', 3: 'right', 4: 'right', 5: 'right' }}
            visibleRows={9}
            hasVerticalOverflow
            cellStyle={(row, col) => {
              if (row === 0) {  // Age 열 (index 1)
                return { fontSize: '1em' }
              }
              if (row > 0 && col === 2) {  // Age 열 (index 1)
                return { color: '#0064d9', fontWeight: 'bold' }
              }
              if (row > 0 && col === 4) { // createddate 열
                return { whiteSpace: 'pre-wrap' }   // 줄바꿈 가능
              }
              return {}
            }}
          />
        </ToggleContainer>
      </div>
    </div>


  )
}
