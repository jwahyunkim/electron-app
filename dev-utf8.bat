@echo off
REM 콘솔 코드페이지를 UTF-8(65001)로
chcp 65001 >nul

REM UTF-8 로케일 환경 (Node/Electron 일부 라이브러리에서 사용)
set LANG=ko_KR.UTF-8
set LC_ALL=ko_KR.UTF-8

REM 개발 서버 실행
    npm run dev:fix
