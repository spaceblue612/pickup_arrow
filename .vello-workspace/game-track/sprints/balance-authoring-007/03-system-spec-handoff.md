---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "SYS-BALANCE-SHEET-LIFECYCLE: 바인드 Apps Script 메뉴가 현재 문서 전용 권한으로 Setup·Migrate·Validate를 실행한다"
    - "SYS-BALANCE-PUBLICATION: 데이터 검증 성공 시 정규화 snapshot을 생성하고 script lock 아래 ScriptProperties에 게시하며 실패 시 이전 게시본을 복구한다"
    - "SYS-BALANCE-PUBLICATION: 게시 payload는 UTF-8 JSON의 Base64 chunk와 마지막 manifest로 저장하고 총 payload가 450000자를 넘으면 게시를 거절한다"
    - "SYS-BALANCE-WEB-ENDPOINT: doGet은 시트에 접근하지 않고 마지막 게시 snapshot만 JSON으로 반환하며 미게시·손상 상태는 ok=false 오류 JSON으로 반환한다"
    - "AUTH-BALANCE-WEB-ENDPOINT: 웹 앱은 배포자 권한·익명 접근으로 배포하고 응답은 runtime profile 필드만 포함한다"
    - "SYS-BALANCE-SYNC: Node.js 22 로컬 CLI가 PICKUP_ARROW_SHEETS_URL을 GET하고 ContentService redirect를 따라 2xx JSON을 읽는다"
    - "SYS-BALANCE-SYNC: 로컬에서 schema_version·profile 전체·정렬·content_hash를 재검증한 뒤에만 data/stage_balance.json을 원자적으로 교체한다"
    - "SYS-STAGE-BALANCE-PREVIEW: Sync 성공 뒤에만 snapshot과 목록을 다시 읽고 실패 시 마지막 정상 보드와 오류를 유지한다"
    - "SYS-STAGE-CATALOG: 런타임은 버전 관리된 로컬 snapshot만 읽고 원격 URL이나 Apps Script를 호출하지 않는다"
  changed_items:
    - "SYS-BALANCE-SHEET-LIFECYCLE"
    - "SYS-BALANCE-PUBLICATION"
    - "SYS-BALANCE-WEB-ENDPOINT"
    - "SYS-BALANCE-SYNC"
    - "SYS-STAGE-BALANCE-PREVIEW sync bridge"
  removed_items:
    - "AUTH-BALANCE-SHEETS service account JWT"
    - "Google Sheets REST setup·migrate adapter"
    - "spreadsheet ID·service account JSON 환경 입력"
  deferred_items:
    - "인증된 비공개 웹 엔드포인트"
    - "런타임 직접 원격 밸런스"
    - "시트 writeback"
  required_next_actions:
    - "Apps Script 기준 파일과 schema fixture를 저장소에서 단일 검증 대상으로 제공한다"
    - "검증 성공 게시·실패 이전 게시본 유지·doGet 최소 JSON 응답을 구현한다"
    - "CLI를 sync 전용 익명 HTTP importer로 교체하고 서비스 계정 모듈과 setup·migrate 명령을 제거한다"
    - "미리보기 안내와 README를 검증→게시→Sync & Preview 흐름으로 갱신한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "high / independent_qa: Apps Script schema·검증·snapshot hash가 Node schema와 동일한 fixture 결과를 만든다"
    - "high / independent_qa: 검증 실패·게시 용량 초과·property 손상 시 이전 정상 게시본 또는 명시적 오류를 보존한다"
    - "high / independent_qa: 익명 응답에 sheet URL·ID·operator_note·credential·쓰기 동작이 포함되지 않는다"
    - "high / independent_qa: HTTP redirect·비2xx·ok=false·잘못된 JSON·hash 불일치가 로컬 마지막 정상 snapshot을 바꾸지 않는다"
    - "medium / independent_qa: preview Sync 성공·실패와 기존 StageCatalog 결과가 유지된다"
    - "user_check: 시트 데이터 검증·웹 앱 배포·URL 설정·Sync & Preview 흐름"
  sot_delta_refs:
    - "SOT-007-BALANCE-METRIC-CATALOG"
    - "SOT-007-GOOGLE-SHEETS-AUTHORING"
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM"
    - "SOT-007-STAGE-BALANCE-PREVIEW"
    - "SOT-007-STAGE-CATALOG-BALANCE-CONTRACT"
  refs:
    - "02-design-handoff.md"
    - "sot-delta.yaml"
---
