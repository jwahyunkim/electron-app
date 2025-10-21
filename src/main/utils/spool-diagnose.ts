// C:\Changshin\test\electron-app_final\src\main\utils\spool-diagnose.ts
import { runPS } from "./ps";

export type Preflight = {
  name: string;

  // Win32_Printer 기반
  workOffline?: boolean;
  printerStatus?: number;           // 3 Idle, 4 Printing, 5 WarmingUp, 7 Offline 등
  extendedPrinterStatus?: number;
  detectedErrorState?: number;      // 2 NoError, 4 NoPaper, 7 DoorOpen, 8 Jammed 등
  printerState?: number;

  // 큐(잡) 기반 (Get-PrintJob)
  jobStatus?: number;               // 비트 플래그 (ERROR, PAPEROUT 등)
  jobReasons?: string[];            // JobStatusReasons (문자 배열)
};

export async function preflightCheck(printerName: string): Promise<Preflight | null | undefined> {
  const name = (printerName || "").replace(/"/g, '\\"');

  // 프린터(WMI) + 최신 잡(Queue) 동시 조회 (하드닝: 항상 정상 종료)
  const ps = `
    $ErrorActionPreference = 'SilentlyContinue'
    try {
      # ✅ UTF-8 강제 (한글 깨짐 방지)
      [Console]::OutputEncoding = [Text.Encoding]::UTF8
      $OutputEncoding = [Console]::OutputEncoding
      $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

      # 1) 프린터 상태: Win32_Printer 우선 (정확 일치)
      $p = Get-CimInstance Win32_Printer -Filter "Name='${name}'" -ErrorAction SilentlyContinue

      # 1-1) 이름/공유명/대소문자/부분매칭 폴백
      if (-not $p) {
        $all = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue
        if ($all) {
          # 정확 일치(Name/ShareName)
          $p = $all | Where-Object { $_.Name -eq "${name}" -or $_.ShareName -eq "${name}" } | Select-Object -First 1
          # 대소문자 무시
          if (-not $p) {
            $p = $all | Where-Object { $_.Name -ieq "${name}" -or $_.ShareName -ieq "${name}" } | Select-Object -First 1
          }
          # 부분 포함
          if (-not $p) {
            $p = $all | Where-Object { ($_.Name -like "*${name}*") -or ($_.ShareName -like "*${name}*") } | Select-Object -First 1
          }
        }
      }

      # 1-2) 그래도 없으면 Get-Printer로 최소 정보 구성(있을 때만)
      if (-not $p) {
        $gp = Get-Printer -Name "${name}" -ErrorAction SilentlyContinue
        if ($gp) {
          $p = [PSCustomObject]@{
            Name                  = $gp.Name
            WorkOffline           = $gp.WorkOffline       # ← 가능하면 채워줌
            PrinterStatus         = $gp.PrinterStatus
            ExtendedPrinterStatus = $null
            DetectedErrorState    = $null
            PrinterState          = $null
          }
        }
      }

      # 2) 최신 잡 + 사유
      $job = $null
      $reasons = @()
      try {
        $jobs = Get-PrintJob -PrinterName "${name}" -ErrorAction SilentlyContinue
        if ($jobs) {
          # SubmittedTime / TimeSubmitted 모두 대응하여 최신 1건
          $jobs = $jobs | ForEach-Object {
            $t = $null
            try {
              if ($_.SubmittedTime) { $t = [datetime]$_.SubmittedTime }
              elseif ($_.TimeSubmitted) { $t = [datetime]$_.TimeSubmitted }
            } catch {}
            [PSCustomObject]@{
              Raw   = $_
              Ticks = if ($t) { $t.Ticks } else { 0 }
            }
          } | Sort-Object -Property @{Expression='Ticks';Descending=$true}, @{Expression='Raw.Id';Descending=$true}
          $job = ($jobs | Select-Object -First 1).Raw
          if ($job -and $job.JobStatusReasons) { $reasons = @($job.JobStatusReasons) }
        }
      } catch {}

      if ($p) {
        [PSCustomObject]@{
          name                   = $p.Name
          workOffline            = $p.WorkOffline
          printerStatus          = $p.PrinterStatus
          extendedPrinterStatus  = $p.ExtendedPrinterStatus
          detectedErrorState     = $p.DetectedErrorState
          printerState           = $p.PrinterState
          jobStatus              = (if ($job) { [int]$job.JobStatus } else { $null })
          jobReasons             = $reasons
        } | ConvertTo-Json -Compress
      } else {
        ""  # 프린터 객체가 없어도 프로세스는 성공 종료
      }
    } catch {
      ""    # 어떤 오류도 프로세스 실패(exit!=0)로 만들지 않음
    }
  `;
  const out = await runPS(ps);
  return out ? JSON.parse(out) : undefined;
}

/** 사용자 경고문 */
export function interpretPreflight(p?: Preflight | null): string | null {
  if (!p) return "프린터 정보를 가져오지 못했습니다.";

  // 오프라인 감지
  if (p.workOffline) return "프린터가 오프라인 상태입니다.";
  if (p.printerStatus === 7) return "프린터가 오프라인 상태로 보고됩니다.";
  if ((p.jobReasons || []).some(r => String(r).toLowerCase().includes("offline"))) {
    return "프린터가 오프라인 상태로 보고됩니다.";
  }

  // 하드 에러(DetectedErrorState 우선)
  switch (p.detectedErrorState) {
    case 4:  return "용지가 없습니다.";
    case 7:  return "덮개(커버)가 열려 있습니다.";
    case 8:  return "용지 걸림이 발생했습니다.";
    case 13: return "사용자 개입이 필요합니다.";
  }

  // 큐 비트/사유 기반 힌트
  const has = (mask: number) => !!((p.jobStatus ?? 0) & mask);
  const reasons = (p.jobReasons || []).map(s => String(s).toLowerCase());

  if (has(0x0040) || reasons.some(r => r.includes("paper")))              return "용지가 없습니다.";
  if (reasons.some(r => r.includes("door") || r.includes("cover")))       return "덮개(커버)가 열려 있습니다.";
  if (reasons.some(r => r.includes("jam")))                               return "용지 걸림이 발생했습니다.";
  if (has(0x0400) || reasons.some(r => r.includes("user")))               return "사용자 개입이 필요합니다.";
  if (has(0x0002)) /* ERROR */                                            return "프린터 오류(Queue) — 사용자 개입 필요.";

  // 일반 상태
  switch (p.printerStatus) {
    case 5: return "프린터가 예열 중입니다.";
    case 4: // Printing
    case 3: // Idle
    case 2: // 일부 드라이버가 Idle처럼 씀
      return null;
    default:
      return "프린터 상태가 불명확합니다.";
  }
}

/** DB 에러코드/메시지 */
export function preflightToErr(p?: Preflight | null):
  | { code: string; msg: string } | null {
  if (!p) return { code: "STATUS_UNAVAILABLE", msg: "프린터 정보를 가져오지 못했습니다." };

  const has = (mask: number) => !!((p.jobStatus ?? 0) & mask);
  const reasons = (p.jobReasons || []).map(s => String(s).toLowerCase());

  // 오프라인
  if (p.workOffline || p.printerStatus === 7 || reasons.some(r => r.includes("offline")) || has(0x0020)) {
    return { code: "PRINTER_OFFLINE", msg: "프린터가 오프라인으로 보고됩니다." };
  }

  // 명시적 하드에러
  if (p.detectedErrorState === 4 || has(0x0040) || reasons.some(r => r.includes("paper"))) {
    return { code: "NO_PAPER", msg: "용지가 없습니다." };
  }
  if (p.detectedErrorState === 7 || reasons.some(r => r.includes("door") || r.includes("cover"))) {
    return { code: "DOOR_OPEN", msg: "덮개(커버)가 열려 있습니다." };
  }
  if (p.detectedErrorState === 8 || reasons.some(r => r.includes("jam"))) {
    return { code: "JAMMED", msg: "용지 걸림이 발생했습니다." };
  }
  if (p.detectedErrorState === 13 || has(0x0400) || reasons.some(r => r.includes("user"))) {
    return { code: "USER_INTERVENTION", msg: "사용자 개입이 필요합니다." };
  }

  // 큐 일반 ERROR 비트
  if (has(0x0002)) {
    return { code: "USER_INTERVENTION", msg: "프린터 오류(Queue) — 사용자 개입 필요." };
  }

  // 예열/불명확
  if (p.printerStatus === 5) return { code: "STATUS_UNCLEAR", msg: "프린터가 예열 중입니다." };

  // 정상
  return null;
}
