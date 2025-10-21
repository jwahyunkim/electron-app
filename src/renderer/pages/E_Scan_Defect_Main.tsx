// src/pages/E_Scan_Defect_Main.tsx
import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import '../pages/E_Scan_Defect_Main.css'
import { Button } from '@ui5/webcomponents-react'

import TimeNow from '../components/TimeNow'
import CustomDatePicker from '../components/CustomDatePicker'
const DatePicker = CustomDatePicker
import CustomSelect from '../components/CustomSelect'
const Select = CustomSelect
import CustomGrid from '../components/grid'
import ToggleContainer from '@renderer/components/ToggleContainer'

import E_Scan_Defect_POPUP from './E_Scan_Defect_POPUP'
import useScrollbarWidth from '../hooks/useScrollbarWidth'
import useSumRow from '../hooks/useSumRow'

import AlertDialog, { AlertDialogRef } from "../components/AlertDialog";
import CustomTable from '@renderer/components/CustomTable'


type DefectsOptionRow = {
  STYLE_CD: string
  STYLE_NAME: string
  SIZE_CD: string
  PLANT?: string
  QTY?: number
}

type DefectMaster = {
  plantCd: string
  opCd: string
  defectCode: string
  defectName: string
  defectNameEn: string
  sortSeq: number
  valDate: string
}

export default function E_Scan_Defect_Main(): JSX.Element {
  const navigate = useNavigate()

  const [debugMode, setDebugMode] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupData, setPopupData] = useState<{ desc: string; size: string; styleCd?: string }>({
    desc: '',
    size: '',
    styleCd: ''
  })


  const [selectedStyleCd, setSelectedStyleCd] = useState("");
  const [selectedStyleName, setSelectedStyleName] = useState("");
  const [selectedSizeCd, setSelectedSizeCd] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);
  const [defectName, setDefectName] = useState<string[]>([])



  const [hoverRow, setHoverRow] = useState<number | null>(null)

  const grid1ScrollRef = useRef<HTMLDivElement | null>(null)
  const grid1InnerRef = useRef<HTMLDivElement | null>(null)
  const alertRef = useRef<AlertDialogRef>(null);


  const data_grid1_header = [['STYLE_CD', 'STYLE_NAME', 'SIZE_CD', '']]
  const [data_grid1_content, setDataGrid1Content] = useState<string[][]>([])
  // ▼ 추가: 원본 객체 보관
  const [data_grid1_rows, setDataGrid1Rows] = useState<DefectsOptionRow[]>([])

  async function fetchGrid1Content(filters?: { styleCd?: string; styleName?: string; sizeCd?: string }) {
    try {
      const params = new URLSearchParams();
      if (filters?.styleCd) params.append("styleCd", filters.styleCd);
      if (filters?.styleName) params.append("styleName", filters.styleName);
      if (filters?.sizeCd) params.append("sizeCd", filters.sizeCd);

      const res = await fetch(`http://127.0.0.1:4000/api/mssql/defectsOptions?${params.toString()}`);
      const rows: DefectsOptionRow[] = await res.json();
      // ▼ 객체 상태로도 보관
      setDataGrid1Rows(rows);
      // ▼ 그리드용 2차원 배열은 유지
      setDataGrid1Content(rows.map(r => [r.STYLE_CD ?? "", r.STYLE_NAME ?? "", r.SIZE_CD ?? ""]));
    } catch (e) {
      console.error("defectsOptions fetch error:", e);
      setDataGrid1Rows([]);
      setDataGrid1Content([]);
    }
  }


  async function fetchDefectCodes(opts?: { plant?: string; op?: string; asOf?: string }) {
    const plant = opts?.plant ?? 'C200'
    const op = opts?.op ?? 'OSP'
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
    fetchGrid1Content()
  }, [])

  useEffect(() => {
    fetchDefectCodes()
  }, [])

  useEffect(() => {
    fetchGrid1Content({
      styleCd: selectedStyleCd,
      styleName: selectedStyleName,
      sizeCd: selectedSizeCd
    });
  }, [selectedStyleCd, selectedStyleName, selectedSizeCd]);


  useEffect(() => {
    console.log("업데이트 후 값:", data_grid1_content)
  }, [data_grid1_content])

  useEffect(() => {
    console.log("업데이트 후 값(객체):)", data_grid1_rows)
  }, [data_grid1_rows])


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



  const unique = (arr: string[]) => Array.from(new Set(arr));

  const styleCdOptions = unique(data_grid1_content.map(r => r[0] ?? ""));
  const styleNameOptions = unique(data_grid1_content.map(r => r[1] ?? ""));
  const sizeCdOptions = unique(data_grid1_content.map(r => r[2] ?? "")).sort(sortSize);

  const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n)
  const toYmd = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`


  const data_grid2_header = [
    ['', '', 'Defect Information Today'],
    [
      'Style Code', 'Status', 'Bonding gap', 'High cement', 'Upper Contamination', 'Bottom Contamination',
      'Thread end', 'Wrinkle on upper', 'Wrinkle on bottom', 'Center off', 'L/R consistency', 'Poor', 'stitching',
      'Poor Painting', 'Upper Damage', 'Others', ''
    ]
  ]
  //TODO: API로 데이터 받아오기. 지금은 아래 데이터의 길이만 참고하는 중,
  const data_grid2_content = [
    ['HM6804008', 'Scrap', 1, '', 3, 2, 1, '', 3, 1, 2, '', 1, 3, 2, 1],
    ['HM6804008', 'Return', 2, 3, 1, '', 2, 1, '', 3, 1, 2, '', 1, 3, 2],
    ['HM6804010', 'Scrap', '', 2, 1, 3, '', 2, 1, '', 3, 1, 2, '', 3, 1],
    ['HM6804010', 'Return', 3, 1, '', 2, 3, 1, '', 2, 1, '', 3, 2, 1, ''],
    ['HM6804017', 'Scrap', 1, 3, 2, '', 1, 3, 2, '', 1, 2, 3, '', 1, 2],
    ['HM6804017', 'Return', 2, '', 1, 3, 2, '', 1, 3, 2, 1, '', 3, 2, 1],
    ['HM6804084', 'Scrap', '', 1, 2, 3, '', 1, 2, 3, 1, '', 2, 3, 1, ''],
    ['HM6804084', 'Return', 3, 2, '', 1, 3, 2, '', 1, 3, '', 2, 1, 3, ''],
    ['HM6804008', 'Scrap', 1, '', 2, 3, 1, '', 2, 3, '', 1, 3, 2, 1, ''],
    ['HM6804008', 'Return', 2, 3, 1, '', 2, 3, 1, '', 2, '', 1, 3, 2, 1],
    ['HM6804008', 'Scrap', '', 2, 3, 1, '', 2, 3, 1, '', 3, 1, 2, '', 3],
    ['HM6804008', 'Return', 3, 1, '', 2, 3, 1, '', 2, 1, '', 2, 3, 1, ''],
    ['HM6804008', 'Scrap', 1, 3, 2, '', 1, 3, 2, '', 3, 2, '', 1, 3, 2],
    ['HM6804008', 'Return', 2, '', 1, 3, 2, '', 1, 3, '', 1, 3, 2, '', 1],
    ['HM6804008', 'Scrap', '', 1, 2, 3, '', 1, 2, 3, 1, 2, 3, '', 1, 2],
    ['HM6804008', 'Return', 3, 2, '', 1, 3, 2, '', 1, '', 2, 1, 3, '', 2]
  ]



  //////////
  const columns1 = [
    { Header: "STYLE_CD", accessor: "STYLE_CD" },
    { Header: "STYLE_NAME", accessor: "STYLE_NAME" },
    { Header: "SIZE_CD", accessor: "SIZE_CD" },
  ];


  const columns2 = [
    { Header: "Style Code", accessor: "stylecd" },
    { Header: "Statuses", accessor: "statuses.Type" },
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
      stylecd: "HM6804008",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804008",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804010",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804010",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804011",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804011",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804012",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804012",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804013",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804013",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804014",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804014",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804019",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804019",
      statuses: {
        Type: "Return",
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
      stylecd: "HM6804020",
      statuses: {
        Type: "Scrap",
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
      stylecd: "HM6804020",
      statuses: {
        Type: "Return",
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




  //////////







  const rowCount_grid1_content = data_grid1_content.length
  const colCount_grid1_content = useMemo(
    () => (data_grid1_content.length ? Math.max(...data_grid1_content.map(r => r.length)) : 0),
    [data_grid1_content]
  )
  const rowCount_grid1_header = data_grid1_header.length
  const colCount_grid1_header = Math.max(...data_grid1_header.map(r => r.length))
  const rowCount_grid2_content = data_grid2_content.length
  // console.log('data_grid2_content:', data_grid2_content.length)
  const colCount_grid2_content = Math.max(...data_grid2_content.map(r => r.length))
  const rowCount_grid2_header = data_grid2_header.length
  const colCount_grid2_header = Math.max(...data_grid2_header.map(r => r.length))

  const scrollsize = useScrollbarWidth()

  const rowSizes_grid1_header: Record<number, string> = { 0: '4vh' }
  const totalHeightRaw_grid1_header = Object.values(rowSizes_grid1_header).map(parseFloat).reduce((a, b) => a + b, 0)

  const rowSizes_grid1_contents: Record<number, string> = {}
  for (let i = 0; i < data_grid1_content.length; i++) rowSizes_grid1_contents[i] = '4vh'
  const totalHeightRaw_grid1_contents = Object.values(rowSizes_grid1_contents).map(parseFloat).reduce((a, b) => a + b, 0)
  const totalHeight_grid1_contents = Math.min(totalHeightRaw_grid1_contents, 24)
  const totalHeight_grid1_section = 28

  const rowSizes_grid2_header: Record<number, string> = { 0: '4vh', 1: '4vh' }
  const totalHeightRaw_grid2_header = Object.values(rowSizes_grid2_header).map(parseFloat).reduce((a, b) => a + b, 0)

  const rowSizes_grid2_contents: Record<number, string> = {}
  for (let i = 0; i < data_grid2_content.length; i++) rowSizes_grid2_contents[i] = '4vh'
  const totalHeightRaw_grid2_contents = Object.values(rowSizes_grid2_contents).map(parseFloat).reduce((a, b) => a + b, 0)
  const totalHeight_grid2_contents = Math.min(totalHeightRaw_grid2_contents, 32)
  const totalHeight_grid2_section = 44

  const data_grid2_withTotal = useSumRow(data_grid2_content)
  const data_grid2_total = data_grid2_withTotal[data_grid2_withTotal.length - 1]

  const handleGrid1MouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const grid = grid1InnerRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const yInGrid = e.clientY - rect.top
    const rowHeightPx = window.innerHeight * 0.04
    const idx = Math.floor(yInGrid / rowHeightPx)
    if (idx < 0 || idx >= rowCount_grid1_content) setHoverRow(null)
    else setHoverRow(idx)
  }
  const handleGrid1MouseLeave = () => setHoverRow(null)

  const handleGrid1CellClick = (r: number) => {
    const rowIndex = r ?? 0
    const rowData = data_grid1_content[rowIndex] || []
    const styleName = rowData[1] != null ? String(rowData[1]) : ''
    const sizeCd = rowData[2] != null ? String(rowData[2]) : ''
    const styleCd = rowData[0] != null ? String(rowData[0]) : ''
    setPopupData({ desc: styleName, size: sizeCd, styleCd })
    setPopupOpen(true)
  }

  // --------- DB Insert ----------
  type PopupPayload = {
    desc: string
    size: string
    side: 'Left' | 'Right'
    qty: number
    defects: string[]
  }

  async function saveDefect(p: PopupPayload, type: 'S' | 'R') {
    let chosen = p.defects[0] ?? '';

    if (type === 'S' && !p.defects.length) {
      alertRef.current?.show("Select defect type!");
      return false
    }
    if (type === 'R' && !chosen) {
      // Return은 defect 미선택 시 기본값
      chosen = "RETURN";
    }
    const finalDefectCd = chosen.slice(0, 10)   // Others도 그대로 코드로 사용

    const apiBody = {
      plantCd: 'C200', //config에서 처리
      // sfcCd: 'TESTSFC',
      // seq: `SEQ${Date.now()}`.slice(0, 20),
      // pcardQty: null // 서버에서 강제 NULL 처리
      workCenter: 'WC01',
      defectType: type,                 // 'S' | 'R'
      deviceId: 'DEV01',
      userIp: '127.0.0.1',
      lr: p.side === 'Left' ? 'L' : 'R',
      defectQty: Number(p.qty),
      defectCd: finalDefectCd,
      styleCd: popupData.styleCd,       // ★ 추가
      sizeCd: popupData.size            // ★ 추가
    }

    const res = await fetch('http://127.0.0.1:4000/api/mssql/defect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody)
    })
    const j = await res.json()
    if (!res.ok || !j?.success) throw new Error(j?.error || 'insert failed')
    return true

  }
  // ------------------------------

  return (
    <div className={debugMode ? 'dev-main' : ''} style={{ height: '95vh', display: 'flex', flexDirection: 'column', backgroundColor: debugMode ? '#00ccff' : '#f5f6f7' }}>
      {/* 상단 */}
      <div
        className={debugMode ? 'dev-scope-header' : ''}
        style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0, height: '8vh', backgroundColor: '#203764' }}
      >
        <div style={{ fontSize: '2vw', color: 'white', display: 'flex', alignItems: 'center', marginLeft: '1vw' }}>
          Defective Management
        </div>
        <Button onClick={() => setDebugMode(!debugMode)}>{debugMode ? 'Debug OFF' : 'Debug ON'}</Button>
        <div style={{ fontSize: '2vw', color: 'white', display: 'flex', alignItems: 'center', marginRight: '1vw' }}

          onClick={() => navigate('/')}>
          <TimeNow />

        </div>
      </div>

      {/* 필터 행 */}
      <div className={debugMode ? 'dev-scope-section' : ''} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, }}>
        {/* {!filterOpen && (

          <div style={{ display: "flex", justifyContent: "flex-start", margin: '1vh' }}>
            <Button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                backgroundColor: '#808080', color: 'white', borderRadius: '0.3vw', fontSize: '1vw', fontWeight: 'bold', width: '5vw', height: '4vh'
              }}
            >

            </Button>

          </div>
        )}
        {filterOpen && (
          <div className={debugMode ? 'dev-scope-filter-row' : ''} style={{ display: 'flex', alignItems: 'flex-start', margin: '1vh', gap: '1vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
              <Button
                onClick={() => setFilterOpen(!filterOpen)}
                style={{ backgroundColor: '#808080', color: 'white', borderRadius: '0.3vw', fontSize: '1vw', fontWeight: 'bold', width: '5vw', height: '4vh' }}>

              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
              <div style={{ color: 'white', borderRadius: '0.3vw', fontSize: '1vw', fontWeight: 'bold', width: '7vw', height: '4vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#3b4dff' }}>
                Style_CD
              </div>
              <Select options={styleCdOptions} value={selectedStyleCd} onChange={(val: any) => setSelectedStyleCd(val)} placeholder="" selectFontSize="0.9vw" iconSize="1vw" name="styleCd" boxWidth="10vw" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
              <div style={{ color: 'white', borderRadius: '0.3vw', fontSize: '1vw', fontWeight: 'bold', width: '7vw', height: '4vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#3b4dff' }}>
                Style_Name
              </div>
              <Select options={styleNameOptions} value={selectedStyleName} onChange={(val: any) => setSelectedStyleName(val)} placeholder="" selectFontSize="0.9vw" iconSize="1vw" name="styleName" boxWidth="12vw" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
              <div style={{ color: 'white', borderRadius: '0.3vw', fontSize: '1vw', fontWeight: 'bold', width: '5vw', height: '4vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#3b4dff' }}>
                Size_CD
              </div>
              <Select options={sizeCdOptions} value={selectedSizeCd} onChange={(val: any) => setSelectedSizeCd(val)} placeholder="" selectFontSize="0.9vw" iconSize="1vw" name="sizeCd" boxWidth="10vw" />
            </div>

          </div>
        )} */}
        {/* 뱃지 */}
        <div
          className={debugMode ? 'dev-scope-stats-row' : ''}
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '1vh', gap: '1vw' }}
        >
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

      {/* Grid1 */}
      <div
        className={debugMode ? 'dev-scope-grid-section' : ''}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: '1vh', height: 'auto' }}
      >

        <CustomTable
          // rootClassName='my-table3'
          columns={columns1}
          data={data_grid1_rows}
          colSizes={{
            0: "10vw",   // Style Code
            1: "15vw",   // Grade
            2: "8vw",   // Bonding gap
          }}
          rowSizes={
            {
              0: '6vh', ...Object.fromEntries(
                Array.from({ length: rowCount_grid2_content - 1 }, (_, i) => [i + 1, '4vh'])
              )
            } as Record<number, string>
          }

          horizontalAlign="center"
          verticalAlign="middle"
          mergedCellsSpecMode='original'
          visibleRows={7}
          enableHover={true}
          hoverMode='row'
          cellStyle={(row, col) => { return {} }}
          onCellClickDetailed={({ row }) => {
            const r = row as DefectsOptionRow | undefined
            if (!r) return // 헤더 클릭 시 무시
            setPopupData({
              desc: r.STYLE_NAME ?? '',
              size: r.SIZE_CD ?? '',
              styleCd: r.STYLE_CD ?? ''
            })
            setPopupOpen(true)
          }}
        />
      </div>

      {/* Grid2 */}


      <div
        className={debugMode ? 'dev-scope-grid2-section' : ''}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: '1vh', height: 'auto', }}
      >
        <ToggleContainer
          title='Defect Information Today'
          titleStyle={{ fontSize: '1.3rem', margin: '0 10px', fontWeight: 'bolder', }}
          topBarWidth="97vw"
          topBarStyle={{ height: '5vh', borderBottom: '1px solid #3a3a3aff', backgroundColor: '#ffff', boxShadow: "0 2px 6px #00000014" }}
          // useWrapperDiv={true}
          defaultCollapsed={true}
          // renderButton={() => null}
          style={{ width: 'auto', height: 'auto', backgroundColor: 'red' }}
        // lockMinWidthOnExpand
        // minWidthFrom="content" // wrapper 없을 때 권장
        >
          <div style={{ height: 'auto', width: 'fit-content', marginBottom: '2vh', overflowY: 'auto' }}>
            <CustomTable
              rootClassName='my-table3'
              columns={columns2}
              data={data2}
              mergedCells={[
                // 기존 패턴: 10개
                ...Array.from({ length: rowCount_grid2_content / 2 }, (_, i) => ({
                  row: i * 2 + 1,
                  col: 0,
                  rowSpan: 2
                })),
                {
                  row: rowCount_grid2_content + 1,
                  col: 0,
                  colSpan: 2
                }

              ]}

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
              rowSizes={
                {
                  0: '6vh',
                  ...Object.fromEntries(
                    Array.from({ length: rowCount_grid2_content }, (_, i) => [i + 1, '4vh'])
                  ),
                  [rowCount_grid2_content + 1]: '5vh'
                } as Record<number, string>
              }


              horizontalAlign="center"
              verticalAlign="middle"
              hasVerticalOverflow
              mergedCellsSpecMode='original'
              visibleRows={8}
              cellStyle={(row, col) => { return {} }}
              showTotalRow={true}
              onCellClick={(r, c) => alert(`클릭한 셀: ${r}, ${c}`)}
              onCellClickDetailed={({ gridRow, col, dataIndexFiltered, dataIndexOriginal, row }) => {
                if (!row) return // 헤더
                console.log({ gridRow, col, dataIndexFiltered, dataIndexOriginal, row })
              }}

            />
          </div>

        </ToggleContainer>
      </div>


      <E_Scan_Defect_POPUP
        key={`${popupData.desc}|${popupData.size}|${popupData.styleCd}|${popupOpen ? 1 : 0}`}
        isOpen={popupOpen}
        onClose={() => {
          setPopupOpen(false)
          fetchGrid1Content({
            styleCd: selectedStyleCd,
            styleName: selectedStyleName,
            sizeCd: selectedSizeCd
          })
        }}
        onScrap={async (p) => {
          const ok = await saveDefect(p, 'S')
          if (!ok) return // 팝업 닫지 않음
          setPopupOpen(false)
          console.log("setPopupOpen(false) 호출됨")
          fetchGrid1Content({
            styleCd: selectedStyleCd,
            styleName: selectedStyleName,
            sizeCd: selectedSizeCd
          })
        }}

        onReturn={async (p) => {
          const ok = await saveDefect(p, 'R')
          if (!ok) return // 팝업 닫지 않음
          setPopupOpen(false)
          console.log("setPopupOpen(false) 호출됨")
          fetchGrid1Content({
            styleCd: selectedStyleCd,
            styleName: selectedStyleName,
            sizeCd: selectedSizeCd
          })
        }}


        process="CEMENT"
        defectsByProcess={{ CEMENT: defectName }}

        initialData={{ desc: popupData.desc, size: popupData.size, styleCd: popupData.styleCd }}
      />

      <AlertDialog ref={alertRef} />


    </div>
  )
}
