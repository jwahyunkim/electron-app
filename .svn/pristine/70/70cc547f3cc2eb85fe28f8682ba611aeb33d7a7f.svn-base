!include "MUI2.nsh"

!macro preInit
  ; 설치 마법사 언어 고정(영어)
  StrCpy $LANGUAGE 1033
!macroend

!macro customInit
  ; APPNAME 환경변수 있으면 그걸 쓰고, 없으면 기본값 E_SCAN
  ReadEnvStr $0 "APPNAME"
  StrCmp $0 "" 0 +2
  StrCpy $0 "E_SCAN"

  ; 최종 설치 경로 강제 (런처와 패턴 통일)
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\$0_electron-app"
!macroend
