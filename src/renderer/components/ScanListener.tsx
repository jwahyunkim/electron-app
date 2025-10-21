"use client";
import React, { useEffect, useRef } from "react";

export type ScanListenerProps = {
  /** 완료된 스캔 문자열 콜백 */
  onScan: (code: string) => void;
  /** 버퍼 플러시 구분키. 기본: Enter */
  delimiterKeys?: string[];
  /** 인터키 타임아웃(ms). 기본 60. 0이면 비활성화 */
  timeoutMs?: number;
  /** 버퍼 최대 길이 도달 시 즉시 플러시 */
  maxLen?: number;
  /** 허용 문자 정규식. 기본: 영문/숫자 */
  allowRegex?: RegExp;

  /** (선택) 스캔 결과 최소 글자수. 미설정이면 비활성 */
  minChars?: number;
  /** (선택) 허용되는 정확한 글자수 목록. 예: [8,12]. 미설정이면 비활성 */
  allowedLengths?: number[];
};

const DEFAULT_ALNUM = /^[A-Za-z0-9]$/;

export default function ScanListener({
  onScan,
  delimiterKeys = ["Enter"],
  timeoutMs = 60,
  maxLen,
  allowRegex = DEFAULT_ALNUM,
  minChars,
  allowedLengths=[3],
}: ScanListenerProps) {
  const bufRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);

  // pending 관련: 첫 키를 보류하기 위한 변수
  const pendingKeyRef = useRef<string | null>(null);
  const pendingTimeRef = useRef<number | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const PENDING_THRESHOLD_MS = 40; // 조정 가능

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const clearPendingTimer = () => {
    if (pendingTimerRef.current != null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingKeyRef.current = null;
    pendingTimeRef.current = null;
  };

  const shouldAccept = (s: string) => {
    // allowedLengths 우선
    if (allowedLengths && allowedLengths.length > 0) {
      return allowedLengths.includes(s.length);
    }
    if (minChars && minChars > 0) {
      return s.length >= minChars;
    }
    return true;
  };

  const flush = () => {
    if (!bufRef.current) return;
    const out = bufRef.current;
    bufRef.current = "";
    clearTimer();
    // 조건 검사: 허용 길이/최소 길이
    if (!shouldAccept(out)) {
      // 조건 불충족: 무시
      return;
    }
    onScan(out);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const now = performance.now();

      // 구분키 처리(Enter 등)
      if (delimiterKeys.includes(e.key)) {
        // pending이 있고 빠르게 들어온 경우 pending을 버퍼로 합침
        if (pendingKeyRef.current && pendingTimeRef.current != null && now - pendingTimeRef.current < PENDING_THRESHOLD_MS) {
          bufRef.current += pendingKeyRef.current;
        }
        clearPendingTimer();
        if (bufRef.current) {
          flush();
        }
        return;
      }

      // 허용 문자만
      if (!allowRegex.test(e.key)) return;

      // 첫 키: 보류
      if (!pendingKeyRef.current && bufRef.current === "") {
        pendingKeyRef.current = e.key;
        pendingTimeRef.current = now;
        if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = window.setTimeout(() => {
          // 두번째 키가 오지 않으면 보류 버림
          clearPendingTimer();
        }, PENDING_THRESHOLD_MS);
        return;
      }

      // 보류 상태가 있으면, 시간 내면 보류+현재를 버퍼에 추가
      if (pendingKeyRef.current) {
        if (pendingTimeRef.current != null && now - pendingTimeRef.current < PENDING_THRESHOLD_MS) {
          bufRef.current += pendingKeyRef.current + e.key;
          clearPendingTimer();
        } else {
          // 보류 만료: 현재 키를 새로운 보류로 설정
          pendingKeyRef.current = e.key;
          pendingTimeRef.current = now;
          if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = window.setTimeout(() => {
            clearPendingTimer();
          }, PENDING_THRESHOLD_MS);
          return;
        }
      } else {
        // 보류 없고 버퍼가 이미 있으면 즉시 누적
        bufRef.current += e.key;
      }

      // 최대 길이 도달 시 즉시 flush
      if (maxLen && bufRef.current.length >= maxLen) {
        flush();
        return;
      }

      // 인터키 타임아웃 리셋(버퍼가 있는 경우만)
      clearTimer();
      if (timeoutMs > 0 && bufRef.current) {
        timerRef.current = window.setTimeout(() => flush(), timeoutMs);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimer();
      clearPendingTimer();
      bufRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRegex, delimiterKeys, maxLen, onScan, timeoutMs, minChars, JSON.stringify(allowedLengths)]);

  return null;
}
