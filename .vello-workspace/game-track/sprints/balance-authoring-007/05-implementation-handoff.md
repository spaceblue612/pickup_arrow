---
handoff:
  stage: implementation
  status: ready_for_qa
  next_skill: vello-game-qa-06
  completed_groups:
    - "EG-APPS-SCRIPT-SHEET-007: BUNDLE-BOUND-SHEET-MENU-007, BUNDLE-VALIDATED-PUBLICATION-007, BUNDLE-ANONYMOUS-JSON-007"
    - "EG-APPS-SCRIPT-LOCAL-SYNC-007: BUNDLE-ANONYMOUS-HTTP-IMPORT-007, BUNDLE-ATOMIC-SNAPSHOT-007, BUNDLE-PREVIEW-SYNC-007"
  remaining_independent_qa:
    - "EG-APPS-SCRIPT-SHEET-007"
    - "EG-APPS-SCRIPT-LOCAL-SYNC-007"
  pending_user_gates:
    - "USER-APPS-SCRIPT-SYNC-WORKFLOW-007"
    - "USER-BALANCE-PREVIEW-USABILITY-007"
  required_inputs:
    - "04-implementation-plan-handoff.md"
    - "03-system-spec-handoff.md"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "Code.gs 데이터 검증 성공이 ScriptProperties 마지막 정상 snapshot을 게시하고 doGet은 게시본만 반환"
    - "sync CLI는 PICKUP_ARROW_SHEETS_URL만 사용하고 원격 응답을 로컬 schema로 재검증"
    - "게임 런타임과 preview는 검증 후 원자적으로 교체된 data/stage_balance.json만 소비"
  changed_items:
    - "tools/balance_sheet/apps_script/Code.gs"
    - "tools/balance_sheet/cli.mjs"
    - "tools/balance_sheet/snapshot_io.mjs"
    - "tools/balance_sheet/README.md"
    - "tools/balance_sheet/tests/apps_script.test.mjs"
    - "tools/balance_sheet/tests/sheets.test.mjs"
    - "scripts/balance_preview.gd"
  removed_items:
    - "tools/balance_sheet/google_auth.mjs"
    - "tools/balance_sheet/google_sheets_client.mjs"
    - "tools/balance_sheet/sheets_requests.mjs"
    - "service account setup·migrate·sync 환경 계약"
  deferred_items:
    - "비공개 OAuth endpoint"
    - "runtime direct remote balance"
    - "preview sheet writeback"
  required_next_actions:
    - "두 independent_qa group을 검증한다"
    - "QA 통과 후 사용자가 기존 Apps Script를 새 Code.gs로 교체하고 구조 마이그레이션·웹 앱 배포·Sync & Preview를 확인한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "PASS: node --check < tools/balance_sheet/apps_script/Code.gs"
    - "PASS: node --test tools/balance_sheet/tests/*.test.mjs"
    - "PASS: test_balance_preview.gd, test_stage_catalog.gd, test_gameplay_core.gd, test_playable_flow.gd"
    - "PASS: test_arrow_placement.gd, test_dependency_analyzer.gd, test_dependency_targeting.gd, test_dependency_targeting_large_board.gd, test_board_foundation.gd"
    - "PASS: main.tscn and balance_preview.tscn headless startup"
    - "PASS: service account 환경·API literal 부재와 Godot ERROR·WARNING 없음"
  sot_delta_refs:
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM"
    - "SOT-007-STAGE-BALANCE-PREVIEW"
  refs:
    - "04-implementation-plan-handoff.md"
    - "03-system-spec-handoff.md"
    - "sot-delta.yaml"
---
