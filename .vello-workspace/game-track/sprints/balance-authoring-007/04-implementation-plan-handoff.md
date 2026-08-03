---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: full
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
    - "sot-delta.yaml"
  execution_groups:
    - id: EG-APPS-SCRIPT-SHEET-007
      bundles: [BUNDLE-BOUND-SHEET-MENU-007, BUNDLE-VALIDATED-PUBLICATION-007, BUNDLE-ANONYMOUS-JSON-007]
      targets: [SYS-BALANCE-SHEET-LIFECYCLE, SYS-BALANCE-PUBLICATION, SYS-BALANCE-WEB-ENDPOINT]
      completion_criteria:
        - "저장소의 Code.gs가 세 표준 탭, 19개 profile 열, 한글 metric_guide 설명과 초기 STAGE-001~003를 생성한다"
        - "데이터 검증이 Node schema와 같은 행·필드·중복·교차 규칙으로 snapshot을 정규화한다"
        - "검증 성공만 이전 게시본을 교체하고 게시 실패·용량 초과는 이전 게시본을 보존한다"
        - "doGet은 마지막 정상 snapshot 또는 명시적 오류 JSON만 반환하고 시트·쓰기 API에 접근하지 않는다"
        - "익명 응답은 runtime profile 외 sheet URL·ID·operator_note·credential을 포함하지 않는다"
      risk: high
      verification: independent_qa
    - id: EG-APPS-SCRIPT-LOCAL-SYNC-007
      bundles: [BUNDLE-ANONYMOUS-HTTP-IMPORT-007, BUNDLE-ATOMIC-SNAPSHOT-007, BUNDLE-PREVIEW-SYNC-007]
      targets: [SYS-BALANCE-SYNC, SYS-STAGE-BALANCE-PREVIEW]
      completion_criteria:
        - "sync CLI가 PICKUP_ARROW_SHEETS_URL만 입력받아 redirect를 따르고 정상 JSON을 로컬에서 재검증한다"
        - "HTTP·응답·schema·hash 실패는 data/stage_balance.json과 마지막 정상 preview를 바꾸지 않는다"
        - "preview Sync 안내에서 서비스 계정 문구가 제거되고 Apps Script 게시 URL 흐름을 사용한다"
        - "서비스 계정 인증·Sheets REST setup·migrate 코드와 자격 증명 환경 계약을 제거한다"
        - "운영 문서가 검증·게시→웹 앱 배포→URL 설정→Sync & Preview 순서를 안내한다"
      risk: high
      verification: independent_qa
  user_gates:
    - id: USER-APPS-SCRIPT-SYNC-WORKFLOW-007
      after: EG-APPS-SCRIPT-LOCAL-SYNC-007
      check: "실제 Google Sheets에서 데이터 검증·게시, 웹 앱 익명 배포, URL 설정과 Sync & Preview를 확인한다"
    - id: USER-BALANCE-PREVIEW-USABILITY-007
      after: EG-APPS-SCRIPT-LOCAL-SYNC-007
      check: "동기화된 스테이지와 오류 표시가 운영 판단에 충분한지 확인한다"
  confirmed_decisions:
    - "게임 런타임과 StageCatalog의 로컬 snapshot 계약은 유지한다"
    - "Apps Script 게시본은 현재 문서 전용 메뉴 검증을 통과해야 갱신된다"
    - "공개 웹 엔드포인트는 읽기 전용이며 로컬 CLI가 다시 검증한다"
  changed_items:
    - "Apps Script Code.gs"
    - "Google Sheets sync CLI"
    - "balance preview sync bridge"
    - "balance authoring 운영 문서와 tests"
  removed_items:
    - "service account JWT auth"
    - "Google Sheets REST setup·migrate client"
    - "spreadsheet ID와 credential JSON 환경 입력"
  deferred_items:
    - "비공개 OAuth endpoint"
    - "runtime direct remote balance"
    - "preview sheet writeback"
  required_next_actions:
    - "EG-APPS-SCRIPT-SHEET-007 구현·검증"
    - "EG-APPS-SCRIPT-LOCAL-SYNC-007 구현·검증"
    - "두 independent_qa group 판정 후 실제 Google 사용자 확인"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "Node Apps Script fixture tests and balance_sheet tests"
    - "tests/test_balance_preview.gd"
    - "tests/test_stage_catalog.gd"
    - "영향받은 gameplay regression and balance_preview.tscn headless startup"
    - "credential·service-account literal·runtime remote access static check"
  sot_delta_refs:
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM"
    - "SOT-007-STAGE-BALANCE-PREVIEW"
  refs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
    - "sot-delta.yaml"
---
