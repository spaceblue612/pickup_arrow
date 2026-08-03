---
handoff:
  stage: design
  status: ready_for_system_spec_or_implementation_plan
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "01-brainstorm-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
    - "../board-foundation-006/08-sprint-closeout.yaml"
  confirmed_decisions:
    - "BALANCE-METRIC-CATALOG-007: 첫 입력군은 현재 런타임이 지원하는 보드·생성·의존 목표·후보 예산 값으로 제한하고 기존 계산값은 관찰군으로 표시한다"
    - "BALANCE-EXPECTED-LEVEL-007: expected_difficulty_level은 1~100 운영 표식이며 원시 목표·실측값을 대체하는 단일 자동 점수가 아니다"
    - "DATA-GOOGLE-SHEETS-SOT-007: _meta, stage_profiles, metric_guide 세 표준 탭을 사용하고 analysis_ 탭만 비입력 분석 영역으로 허용한다"
    - "DATA-STAGE-PROFILES-SCHEMA-007: stage_profiles는 보호된 1행에 stage_order를 포함한 19개 고정 헤더를 지정 순서로 두고 2행부터 stable stage_id별 입력을 편집한다"
    - "DATA-METRIC-GUIDE-SCHEMA-007: metric_guide는 metric_id, 분류, 그룹, 타입, 필수 여부, 범위, 기본값, 입력 열, 설명을 보호된 표로 제공한다"
    - "DATA-SHEETS-ROW-RULE-007: 완전한 빈 행만 무시하며 부분 행·수식 입력·임의 표준 열·중복 ID는 전체 동기화를 거절한다"
    - "DATA-EXPECTED-LEVEL-BLANK-007: expected_difficulty_level은 선택값이고 빈 값은 미보정으로 표시하며 생성 조건에는 사용하지 않는다"
    - "CONTENT-SHEET-STAGE-REGISTRY-007: 새 stage_id와 고유 stage_order 행은 현재 결정적 생성기를 쓰는 새 스테이지가 되고 별도 맵 콘텐츠가 없으면 전체 직사각 보드를 사용한다"
    - "WORKFLOW-SHEET-APPS-SCRIPT-007: 사람 운영자가 시트에 바인드된 Apps Script 메뉴로 최초 구성·구조 마이그레이션·데이터 검증을 실행한다"
    - "WORKFLOW-SHEET-MIGRATION-007: 필드 추가·삭제·이름 변경은 백업과 버전 전환이 포함된 자동 Migrate로 수행하고 표준 열을 수동 편집하지 않는다"
    - "PUBLICATION-LOCAL-BUILD-007: 동기화한 로컬 스냅샷을 버전 관리하고 게임을 다시 빌드·배포해야 출시본에 반영된다"
    - "WORKFLOW-SYNC-PREVIEW-007: 시트 수정 후 Sync & Preview 한 흐름으로 전체 검증, 로컬 스냅샷 교체, 선택 스테이지 확인을 수행한다"
    - "DATA-LOCAL-SNAPSHOT-007: 런타임과 미리보기는 버전 관리되는 동일 로컬 스냅샷을 사용하고 원격 시트에 직접 연결하지 않는다"
    - "WORKFLOW-LOCAL-SYNC-007: 로컬 동기화 도구만 Apps Script가 제공한 검증 결과를 받아 원자적으로 로컬 스냅샷을 교체한다"
    - "AUTH-NO-SERVICE-ACCOUNT-007: 서비스 계정·JSON 키·Google Cloud Console 의존을 제거한다"
    - "AUTH-APPS-SCRIPT-WEB-ENDPOINT-007: 웹 앱은 배포자 권한으로 실행하고 익명 읽기를 허용하되 검증된 런타임용 밸런스 JSON만 반환한다"
    - "FAIL-LAST-KNOWN-GOOD-007: 인증·네트워크·값 오류는 기존 정상 스냅샷을 보존하고 셀 위치와 원인을 표시한다"
    - "PREVIEW-READ-ONLY-007: 미리보기는 보드 배치, 설정값, 실측값, 기대 레벨, revision을 표시하지만 값을 편집하거나 시트에 쓰지 않는다"
    - "MIGRATE-STAGE-PROFILES-007: 기존 STAGE-001~003 밸런스는 값 변화 없이 초기 스냅샷으로 이전한다"
  changed_items:
    - "FEATURE-BALANCE-METRIC-CATALOG-007"
    - "SYS-BALANCE-SHEET-LIFECYCLE"
    - "SYS-BALANCE-SYNC"
    - "SYS-STAGE-BALANCE-PREVIEW"
    - "SYS-STAGE-CATALOG: local balance profile 소비"
  removed_items:
    - "DATA-HARDCODED-STAGE-BALANCE-007"
    - "WORKFLOW-MANUAL-CSV-IMPORT-007"
    - "RUNTIME-DIRECT-GOOGLE-SHEETS-ACCESS-007"
    - "WORKFLOW-SERVICE-ACCOUNT-PERMISSIONS-007"
    - "AUTH-SERVICE-ACCOUNT-JWT-007"
  deferred_items:
    - "ADVANCED-BALANCE-METRICS-007: 새 채택 조건, 형상·시각·고급 의존·플레이 제약 지표"
    - "PREVIEW-SHEET-WRITEBACK-007"
    - "TOOL-DEDICATED-BALANCE-EDITOR-007"
    - "FEATURE-MAP-GENERATION-MODE-008"
  required_next_actions:
    - "시트 바인드 Apps Script의 Setup·Migrate·Validate와 doGet JSON 응답 계약을 정의한다"
    - "익명 엔드포인트가 반환할 필드, 오류 응답, 배포자 권한과 읽기 전용 경계를 정의한다"
    - "로컬 Sync의 웹 앱 URL 입력, 리다이렉트 처리, schema_version 호환과 원자적 산출물 교체를 정의한다"
    - "SYS-STAGE-CATALOG의 로컬 스냅샷 로딩, 콘텐츠 결합, 오류 전파와 기존 값 이전 계약을 정의한다"
    - "SYS-STAGE-BALANCE-PREVIEW의 실제 생성 경로 재사용, 화면 상태, 선택·재생성·오류 흐름을 정의한다"
    - "자격 증명 제거, 공개 응답 최소화, 스냅샷 결정성, 전체 행 검증과 마지막 정상 데이터 보존 경계를 정의한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "high / independent_qa: Sheets 행을 정규화한 스냅샷 결정성, 스키마·타입·범위·중복·교차 필드 검증"
    - "high / independent_qa: 시트 바인드 Setup과 필드 추가·삭제·이름 변경 Migrate의 백업, 검증과 실패 복구"
    - "high / independent_qa: 새 행의 생성 스테이지 등록, stage_order 진행 순서, 중복 ID·순서 거절"
    - "high / independent_qa: 기존 STAGE-001~003 값과 생성 결과의 이전 전후 동등성"
    - "high / independent_qa: 익명 JSON 응답의 읽기 전용 최소 필드, 로컬 재검증, 원자적 교체와 마지막 정상 스냅샷 보존"
    - "medium / independent_qa: 미리보기와 런타임의 동일 StageCatalog 경로 및 목표·실측값 일치"
    - "user_check: Google Sheets 수정부터 Sync & Preview 결과 확인까지 수동 CSV 없이 완료"
    - "user_check: 읽기 전용 미리보기의 보드·설정값·실측값·오류 정보가 운영 판단에 충분한지 확인"
    - "user_check: stage_profiles와 metric_guide의 열 구성 및 시트 편집 흐름이 운영에 충분한지 확인"
  sot_delta_refs:
    - "SOT-007-BALANCE-METRIC-CATALOG"
    - "SOT-007-GOOGLE-SHEETS-AUTHORING"
    - "SOT-007-BALANCE-SHEET-APPS-SCRIPT-LIFECYCLE"
    - "SOT-007-BALANCE-APPS-SCRIPT-SYNC-SYSTEM"
    - "SOT-007-STAGE-BALANCE-PREVIEW"
    - "SOT-007-STAGE-CATALOG-BALANCE-CONTRACT"
  refs:
    - "01-brainstorm-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
    - "../board-foundation-006/08-sprint-closeout.yaml"
---
