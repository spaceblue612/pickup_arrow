---
handoff:
  stage: brainstorm
  status: ready_for_design
  interview_type: focused-interview
  next_skill: vello-game-design-02
  required_inputs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../../../MyRequest/스테이지_난이도_수치_항목.md"
    - "../../current-design/current-design.yaml"
    - "../board-foundation-006/08-sprint-closeout.yaml"
  confirmed_decisions:
    - "SPRINT-BALANCE-AUTHORING-007: 이번 스프린트는 요구사항 4~6의 난이도 항목 규정, 운영 편집 방식, 스테이지 미리보기를 대상으로 삼는다"
    - "FEATURE-GOOGLE-SHEETS-AUTHORING-007: Google Sheets를 사람이 편집하는 밸런스 운영 원본으로 사용한다"
    - "SYNC-LOCAL-RUNTIME-007: 동기화 단계가 시트 데이터를 검증된 로컬 게임 데이터로 변환하고 런타임은 이 결과를 사용한다"
    - "OPERATIONS-NO-MANUAL-CSV-007: 운영자가 CSV를 직접 저장·불러오기 하는 흐름은 사용하지 않는다"
    - "FEATURE-STAGE-BALANCE-PREVIEW-007: 동기화된 스테이지의 화살 배치, 설정 난이도 값, 실제 측정값과 기대 레벨을 함께 확인한다"
    - "ROADMAP-BOARD-OPERATIONS-006: A 완료 후 B를 진행하고 고정·랜덤 맵 정책 C는 다음 범위로 유지한다"
  changed_items:
    - "FEATURE-BALANCE-METRIC-CATALOG-007"
    - "FEATURE-GOOGLE-SHEETS-AUTHORING-007"
    - "FEATURE-STAGE-BALANCE-PREVIEW-007"
  removed_items:
    - "WORKFLOW-MANUAL-CSV-IMPORT-007"
    - "RUNTIME-DIRECT-GOOGLE-SHEETS-ACCESS-007"
  deferred_items:
    - "TOOL-DEDICATED-BALANCE-EDITOR-007: Sheets 운영으로 해결되지 않는 문제가 확인될 때만 검토"
    - "ADVANCED-BALANCE-METRICS-007: 지역·모듈·관문·시간 및 힌트 제약 지표"
    - "FEATURE-MAP-GENERATION-MODE-008: 고정 맵·랜덤 맵 옵션"
  required_next_actions:
    - "확정 설정값, 계산 관찰값, 추가 유보값을 분류하고 각 타입·범위·필수 여부를 설계한다"
    - "Google Sheets의 탭·열·행·스키마 버전과 스테이지 ID 기반 참조 구조를 설계한다"
    - "시트 읽기, 인증, 검증, 로컬 변환, 변경 감지, 실패 시 이전 정상 데이터 보존 흐름을 설계한다"
    - "동기화와 미리보기의 작업 순서 및 배치·목표값·실측값·오류 표시 구조를 설계한다"
  blockers: []
  decisions_needed:
    - "DESIGN-BALANCE-METRIC-SET-007: 첫 적용 메트릭과 범위, 관찰 전용·유보 분류"
    - "DESIGN-SHEETS-SCHEMA-007: 시트 탭 구조, 열 타입, 범위 표현, 버전 및 행 식별 규칙"
    - "DESIGN-SYNC-PREVIEW-WORKFLOW-007: 인증 주체, 동기화 명령, 로컬 산출물, 미리보기 진입 방식"
  verification_requirements:
    - "동일한 시트 스냅샷은 동일한 검증 결과와 런타임 밸런스 데이터를 생성한다"
    - "누락 열, 중복 스테이지 ID, 잘못된 타입·범위·참조를 런타임 실행 전에 거절한다"
    - "동기화 실패 시 마지막 정상 로컬 데이터를 훼손하지 않고 구체적인 오류를 제공한다"
    - "Google 인증 정보는 저장소와 게임 빌드에 포함하지 않는다"
    - "미리보기의 설정값과 실측값이 실제 런타임 생성 결과와 일치한다"
    - "운영자가 시트 수정부터 동기화·미리보기까지 수동 CSV 없이 완료할 수 있는지 확인한다"
  refs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../../../MyRequest/스테이지_난이도_수치_항목.md"
    - "../../current-design/current-design.yaml"
    - "../board-foundation-006/08-sprint-closeout.yaml"
---
