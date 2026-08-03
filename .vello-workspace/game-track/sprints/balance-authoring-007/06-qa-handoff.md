---
handoff:
  stage: qa
  status: passed
  next_skill: vello-game-sprint-closeout-08
  required_inputs:
    - "05-implementation-handoff.md"
    - "04-implementation-plan-handoff.md"
    - "phase-progress.yaml"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "EG-APPS-SCRIPT-SHEET-007 PASS: 한글 guide, Node 동등 hash, 검증된 게시, 손상·용량·property 실패 정책, 최소 doGet JSON"
    - "EG-APPS-SCRIPT-LOCAL-SYNC-007 PASS: redirect HTTP import, 로컬 재검증, 원자적 교체, 실패 마지막 정상 보존, preview·StageCatalog 재사용"
  changed_items:
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE status=verified"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM status=verified"
  removed_items: []
  deferred_items:
    - "실제 Google 웹 앱 배포·익명 접근 사용자 확인"
    - "USER-BALANCE-PREVIEW-USABILITY-007"
  required_next_actions:
    - "사용자가 Code.gs를 교체하고 구조 마이그레이션 또는 데이터 검증을 실행한다"
    - "웹 앱을 배포자 권한·로그인 불필요 접근으로 배포하고 PICKUP_ARROW_SHEETS_URL로 Sync & Preview를 확인한다"
    - "사용자 확인 후 closeout을 요청한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "PASS: node --check and node --test tools/balance_sheet/tests/*.test.mjs"
    - "PASS: test_balance_preview.gd and test_stage_catalog.gd"
    - "PASS: Apps Script·Godot QA 로그 오류·경고 없음"
    - "PASS: service account 환경·Sheets REST API literal 부재"
    - "evidence=/tmp/pickup-arrow-qa-*-apps-script.log"
  sot_delta_refs:
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM"
    - "SOT-007-STAGE-BALANCE-PREVIEW"
  refs:
    - "05-implementation-handoff.md"
    - "04-implementation-plan-handoff.md"
    - "03-system-spec-handoff.md"
    - "sot-delta.yaml"
---
