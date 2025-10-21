import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * UI5 유사 버튼 그리드
 * - 부모 컨테이너의 실시간 크기(ResizeObserver)를 기준으로 행 단위로 배치
 * - 각 버튼 폭/높이는 텍스트 실제 픽셀 폭(measureText)과 폰트/패딩으로 계산
 * - 컨테이너를 넘는 높이는 overflow-auto로 스크롤 처리
 * - 선택 상태 관리 및 단일/다중/비활성 선택 모드 지원
 * - 선택 상태 스타일을 프롭스(selectedVariant)로 지정 가능
 */

type Ui5ButtonVariant =
  | "default"
  | "emphasized"
  | "transparent"
  | "positive"
  | "negative"
  | "attention";

export type Ui5LikeButtonGridProps = {
  /** 1차원 텍스트 배열 */
  items: string[];
  /** 버튼 스타일 변형(기본 상태) */
  variant?: Ui5ButtonVariant;
  /** 선택 상태 스타일 변형 */
  selectedVariant?: Ui5ButtonVariant;
  /** 버튼 간격(px) */
  gap?: number;
  /** 수평 패딩(px) */
  paddingX?: number;
  /** 수직 패딩(px) */
  paddingY?: number;
  /** 폰트: size(px), weight, family 각각 별도 지정 */
  fontSize?: number; // px
  fontWeight?: number | "normal" | "bold" | "bolder" | "lighter";
  fontFamily?: string;
  /** 버튼 최소/최대 크기 제약 */
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** 클릭 핸들러 */
  onClick?: (text: string, index: number) => void;
  /** 외부 클래스 */
  className?: string;

  /** 선택 모드: 단일/다중/없음 */
  selectionMode?: "single" | "multiple" | "none";
  /**
   * 선택 상태 제어용(Controlled)
   * - 선택된 인덱스 배열
   */
  selectedIndices?: number[];
  /**
   * 비제어 기본 선택값(Uncontrolled)
   */
  defaultSelectedIndices?: number[];
  /**
   * 선택 변경 콜백
   */
  onSelectionChange?: (selectedIndices: number[], selectedTexts: string[]) => void;

  /** 컨테이너 채움 옵션 */
  fillWidth?: boolean;   // 부모 폭을 채움(기본 true)
  fillHeight?: boolean;  // 부모 높이를 채움(기본 false, 미지정 시 내용 높이만큼)

  buttonStyle?: React.CSSProperties; // 인라인 스타일 주입
};

export default function CustomButton(props: Ui5LikeButtonGridProps) {
  const {
    items,
    variant = "default",
    selectedVariant = "emphasized", // 없으면 variant로 폴백
    gap = 8,
    paddingX = 12,
    paddingY = 6,
    fontSize = 14,
    fontWeight = 400,
    fontFamily = "'Noto Sans', ui-sans-serif, system-ui",
    minWidth = 32,
    minHeight = 34, // 버튼들의 높이
    maxWidth,
    maxHeight,
    onClick,
    className,
    selectionMode = "single",
    selectedIndices,
    defaultSelectedIndices = [],
    onSelectionChange,
    fillWidth = true,
    fillHeight = false,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // --- 선택 상태 관리 (Controlled 우선, 아니면 Uncontrolled) ---
  const isControlled = Array.isArray(selectedIndices);
  const [internalSelected, setInternalSelected] = useState<number[]>(defaultSelectedIndices);

  // none 모드일 때는 항상 선택 없음으로 간주
  const effectiveSelected =
    selectionMode === "none"
      ? []
      : (isControlled ? (selectedIndices as number[]) : internalSelected);

  const selectedSet = useMemo(() => new Set(effectiveSelected), [effectiveSelected]);

  // 부모 크기 추적
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = useMemo(() => createMeasurer(fontSize, fontWeight, fontFamily), [fontSize, fontWeight, fontFamily]);

  const buttons = useMemo(() => {
    const sizes = items.map((text, originalIndex) => {
      const textW = measure(text);
      const width = clamp(Math.ceil(textW + paddingX * 2), minWidth, maxWidth ?? Infinity);
      const height = clamp(
        Math.ceil(fontSize * 1.2 + paddingY * 2),
        minHeight,
        maxHeight ?? Infinity
      );
      return { text, width, height, originalIndex };
    });

    // 행 포장
    const lines: { items: typeof sizes; y: number; height: number }[] = [];
    let x = 0, y = 0, lineH = 0;
    let current: typeof sizes = [];
    const cw = Math.max(containerSize.w, 0);

    sizes.forEach((btn) => {
      const wWithGap = (current.length ? gap : 0) + btn.width;
      if (x + wWithGap > cw && current.length) {
        lines.push({ items: current, y, height: lineH });
        y += lineH + gap;
        x = 0;
        lineH = 0;
        current = [];
      }
      current.push(btn);
      x += (current.length > 1 ? gap : 0) + btn.width;
      lineH = Math.max(lineH, btn.height);
    });
    if (current.length) {
      lines.push({ items: current, y, height: lineH });
      y += lineH;
    }

    const totalHeight = lines.reduce((acc, l, i) => acc + l.height + (i ? gap : 0), 0);

    return { lines, totalHeight };
  }, [items, containerSize.w, gap, measure, paddingX, paddingY, minWidth, maxWidth, minHeight, maxHeight, fontSize]);

  const theme = ui5ThemeFor(variant);
  const selectedTheme = ui5ThemeFor(selectedVariant ?? variant);

  // --- 선택 처리 ---
  const commitSelection = (next: number[]) => {
    if (selectionMode === "none") return; // 선택 비활성
    if (!isControlled) setInternalSelected(next);
    if (onSelectionChange) {
      const texts = next.map((i) => items[i]).filter((v) => typeof v !== "undefined");
      onSelectionChange(next, texts);
    }
  };

  const toggleIndex = (idx: number) => {
    if (selectionMode === "none") return; // 선택 비활성
    if (selectionMode === "single") {
      const isSame = effectiveSelected.length === 1 && effectiveSelected[0] === idx;
      commitSelection(isSame ? [] : [idx]);
    } else {
      const next = new Set(effectiveSelected);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      commitSelection(Array.from(next).sort((a, b) => a - b));
    }
  };

  const innerHeight = fillHeight
    ? Math.max(buttons.totalHeight, containerSize.h) // 부모 높이를 채우되, 내용이 더 크면 스크롤
    : buttons.totalHeight;                            // 부모 높이 미고정 시, 내용 높이만큼만 차지

  return (
    <div
      ref={containerRef}
      className={["relative overflow-auto", className].filter(Boolean).join(" ")}
      style={{
        width: fillWidth ? "100%" : undefined,
        height: fillHeight ? "100%" : undefined,
        maxWidth: "100%",
        maxHeight: "100%",
      }}
      role="list"
      aria-label="ui5-like button grid"
    >
      <div style={{ position: "relative", height: innerHeight }}>
        {buttons.lines.map((line, li) => (
          <div
            key={li}
            style={{ position: "absolute", top: line.y, left: 0, height: line.height, display: "flex", gap }}
          >
            {line.items.map((btn, bi) => {
              const isSelected = selectionMode !== "none" && selectedSet.has(btn.originalIndex);
              const variantClass = isSelected ? selectedTheme.className : theme.className;
              return (
                <button
                  key={bi}
                  type="button"
                  onClick={() => {
                    toggleIndex(btn.originalIndex);
                    if (onClick) onClick(btn.text, btn.originalIndex);
                  }}
                  className={`ui5-btn shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded ${variantClass}`}
                  style={{
                    width: btn.width,
                    height: btn.height,
                    fontFamily,
                    fontSize,
                    fontWeight,
                    lineHeight: 1.2,
                    padding: `${paddingY}px ${paddingX}px`,
                    ...props.buttonStyle,   // 외부 스타일 병합
                  }}
                  aria-pressed={selectionMode !== "none" ? isSelected : undefined}
                  data-selected={selectionMode !== "none" ? (isSelected ? "true" : "false") : undefined}
                >
                  {btn.text}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <style>{cssReset}</style>
      <style>{ui5Styles}</style>
    </div>
  );
}

/** Utilities */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toCanvasFont(sizePx: number, weight: Ui5LikeButtonGridProps["fontWeight"], family: string) {
  const w = typeof weight === "number" ? String(weight) : weight || "normal";
  return `${w} ${sizePx}px ${family}`;
}

function createMeasurer(sizePx: number, weight: Ui5LikeButtonGridProps["fontWeight"], family: string) {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");

  // 두 컨텍스트 공통 타입으로 강제하여 'RenderingContext' 유니온 회피
  type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const get2dCtx = (c: HTMLCanvasElement | OffscreenCanvas): Ctx2D => {
    const ctx = (c as any).getContext("2d") as Ctx2D | null;
    if (!ctx) throw new Error("2D context unavailable");
    return ctx;
  };

  const ctx = get2dCtx(canvas);

  return (text: string) => {
    ctx.font = toCanvasFont(sizePx, weight, family);
    const metrics = ctx.measureText(text);
    return metrics.width;
  };
}

function ui5ThemeFor(variant: Ui5ButtonVariant) {
  switch (variant) {
    case "emphasized":
      return { className: "ui5-emphasized" };
    case "transparent":
      return { className: "ui5-transparent" };
    case "positive":
      return { className: "ui5-positive" };
    case "negative":
      return { className: "ui5-negative" };
    case "attention":
      return { className: "ui5-attention" };
    default:
      return { className: "ui5-default" };
  }
}

const cssReset = `
.ui5-btn {
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background-color 120ms ease, box-shadow 120ms ease, transform 60ms ease;
  user-select: none;
  white-space: nowrap;
}
.ui5-btn:active { transform: translateY(0.5px); }
.ui5-btn:disabled { cursor: not-allowed; opacity: 0.6; }
`;

const ui5Styles = `
/* SAP UI5 유사 팔레트/상태 */
.ui5-default { background-color: #ffffff; color: #0064d9; box-shadow: inset 0 0 0 1px #bbbbbb; }
.ui5-default:hover { background-color: #efefef; }
.ui5-default:active { background-color: #e5e5e5; }

.ui5-emphasized { background-color: #0070f2; color: #fff; box-shadow: inset 0 0 0 1px #0a6ed1; }
.ui5-emphasized:hover { background-color: #085caf; }
.ui5-emphasized:active { background-color: #074a8c; }

.ui5-transparent { background-color: transparent; color: #0a6ed1; box-shadow: inset 0 0 0 1px transparent; }
.ui5-transparent:hover { background-color: rgba(10,110,209,0.10); }
.ui5-transparent:active { background-color: rgba(10,110,209,0.16); }

.ui5-positive { background-color: #107e3e; color: #fff; box-shadow: inset 0 0 0 1px #107e3e; }
.ui5-positive:hover { background-color: #0e6f37; }

.ui5-negative { background-color: #bb0000; color: #fff; box-shadow: inset 0 0 0 1px #bb0000; }
.ui5-negative:hover { background-color: #9f0000; }

.ui5-attention { background-color: #e9730c; color: #fff; box-shadow: inset 0 0 0 1px #e9730c; }
.ui5-attention:hover { background-color: #cf660b; }

/* 선택 상태 스타일(기본 규칙). 선택된 버튼은 강조 외곽선 등 */
.ui5-btn[data-selected="true"].ui5-default { background-color: #eaf1fb; box-shadow: inset 0 0 0 1px #0a6ed1; }
.ui5-btn[data-selected="true"].ui5-emphasized { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.9); }
.ui5-btn[data-selected="true"].ui5-transparent { background-color: rgba(10,110,209,0.20); box-shadow: inset 0 0 0 1px #0a6ed1; }
.ui5-btn[data-selected="true"].ui5-positive { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.05); }
.ui5-btn[data-selected="true"].ui5-negative { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.05); }
.ui5-btn[data-selected="true"].ui5-attention { box-shadow: inset 0 0 0 2px #ffffff; filter: brightness(1.05); }
`;

// 사용 예시
// <div style={{width: 600, height: 240}}>
//   <CustomButton
//     items={["Apple", "Banana", "Cherry", "Dragon Fruit", "Elderberry", "Fig"]}
//     variant="transparent"
//     selectedVariant="emphasized"
//     fontSize={16}
//     fontWeight={600}
//     fontFamily="'Noto Sans'"
//     selectionMode="multiple"
//     selectedIndices={[0,2]}
//     onSelectionChange={(idxs, texts) => console.log(idxs, texts)}
//     onClick={(text, idx) => console.log("clicked", text, idx)}
//   />
// </div>



//프롭스 설명

// items
//  ─ 문자열 배열. 버튼에 표시될 텍스트 리스트. 필수.

// variant
//  ─ 버튼 기본 스타일. UI5 테마 기반.
//  ─ 값: "default" | "emphasized" | "transparent" | "positive" | "negative" | "attention"
//  ─ 기본값: "default"

// selectedVariant
//  ─ 버튼이 선택되었을 때의 스타일. variant와 동일한 타입.
//  ─ 지정하지 않으면 variant와 동일하게 적용됨.
//  ─ 기본값: "negative" (현재 코드 설정)

// gap
//  ─ 버튼 사이 간격(px).
//  ─ 기본값: 8

// paddingX
//  ─ 버튼 좌우 패딩(px).
//  ─ 기본값: 12

// paddingY
//  ─ 버튼 상하 패딩(px).
//  ─ 기본값: 6

// fontSize
//  ─ 버튼 텍스트 크기(px).
//  ─ 기본값: 14

// fontWeight
//  ─ 버튼 텍스트 두께.
//  ─ number 또는 "normal" | "bold" | "bolder" | "lighter"
//  ─ 기본값: 400

// fontFamily
//  ─ 버튼 텍스트 폰트 패밀리.
//  ─ 기본값: "'Noto Sans', ui-sans-serif, system-ui"

// minWidth
//  ─ 버튼 최소 너비(px).
//  ─ 기본값: 32

// minHeight
//  ─ 버튼 최소 높이(px).
//  ─ 기본값: 28

// maxWidth
//  ─ 버튼 최대 너비(px).
//  ─ 기본값: undefined (제한 없음)

// maxHeight
//  ─ 버튼 최대 높이(px).
//  ─ 기본값: undefined (제한 없음)

// onClick
//  ─ 버튼 클릭 핸들러.
//  ─ 시그니처: (text: string, index: number) => void

// className
//  ─ 외부에서 주입하는 CSS 클래스.

// selectionMode
//  ─ 선택 모드.
//  ─ "single": 하나만 선택 가능
//  ─ "multiple": 여러 개 선택 가능
//  ─ 기본값: "single"

// selectedIndices
//  ─ 선택 상태를 외부에서 완전히 제어할 때 사용 (Controlled).
//  ─ 선택된 버튼의 인덱스 배열.

// defaultSelectedIndices
//  ─ 비제어(Uncontrolled)일 때 초기 선택값.
//  ─ 기본값: []

// onSelectionChange
//  ─ 선택 상태가 바뀔 때 호출되는 콜백.
//  ─ 시그니처: (selectedIndices: number[], selectedTexts: string[]) => void

// fillWidth
//  ─ 컴포넌트가 부모의 가로폭을 채울지 여부.
//  ─ 기본값: true

// fillHeight
//  ─ 컴포넌트가 부모의 세로높이를 채울지 여부. false면 내용 높이만큼만 차지.
//  ─ 기본값: false