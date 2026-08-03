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
    - "DATA-STAGE-BOARD-006: SYS-STAGE-CATALOG의 원본 입력은 grid_size와 선택적 mask_rows이며 mask_rows 미지정은 전체 배치 가능이다"
    - "DATA-MASK-ROWS-006: mask_rows는 height개 문자열, 각 문자열은 width개 문자이며 .은 배치 가능, #은 배치 불가, 좌상단은 좌표 (1,1)이다"
    - "DATA-BLOCKED-CELLS-006: 공개 스테이지 정의는 행 우선 정렬된 Array[Vector2i] blocked_cells를 소유하고 소비 시스템은 내부 membership set을 만들 수 있다"
    - "GUARD-BOARD-RESOURCE-006: grid_size 각 축은 1..999이고 width x height는 1..10000이며 위반은 정규화·생성 전에 오류로 거절한다"
    - "SYS-STAGE-CATALOG: 마스크 문자·행·열, 범위, 최소 1개 배치 가능 셀, 화살의 배치 불가 셀 점유를 검증하고 정규화 데이터를 전달한다"
    - "SYS-ARROW-PLACEMENT: blocked_cells를 선택 입력으로 받아 배치 가능 셀 수를 용량·목표 빈칸 비율의 분모로 사용하고 몸통 후보에서 배치 불가 셀을 제외한다"
    - "SYS-DEPENDENCY-TARGETING: 모든 후보 생성에 동일한 정규화 blocked_cells를 전달해 seed 결정성을 유지한다"
    - "SYS-PATH-RULE 및 SYS-DEPENDENCY-ANALYZER: blocked_cells를 충돌 입력으로 받지 않고 직사각 grid_size 외곽까지 기존 화살 차단 규칙을 적용한다"
    - "SYS-BOARD-STATE: stage_loaded 상태에 grid_size와 blocked_cells를 복제 보관하고 state_changed에 공개한다"
    - "SYS-BOARD-VIEWPORT: 9x9 기준 셀 크기, 플레이 영역, grid_size로 화면 변환과 축별 이동 한도를 계산하고 가시 셀 범위에 1셀 여유를 더해 렌더링 대상으로 반환한다"
    - "SYS-BOARD-VIEWPORT: 누름 위치와 시작 offset을 저장하고 누적 화면 이동이 설정 임계값을 넘으면 PANNING으로 전환하며 release 탭 요청을 취소한다"
    - "SYS-BOARD-VIEWPORT: FIT 축은 중앙 고정, OVERFLOW 축은 보드 가장자리와 플레이 영역 사이로 offset을 clamp하고 스테이지 로드 시 보드 중심에서 시작한다"
    - "SYS-TOUCH-FEEDBACK: READY에서만 탭·드래그를 소비하며 선택 hit-test는 screen_to_grid 변환 후 해당 셀의 화살 ID를 조회한다"
    - "EXTRACTION-BOARD-EDGE-006: 추출 가능 판정과 추출 완료 거리는 활성 grid_size의 직사각 외곽과 마지막 몸통 이탈을 기준으로 하며 pan offset과 무관하다"
  changed_items:
    - "SYS-STAGE-CATALOG: 원본 mask_rows 정규화, 자원 가드, runtime board definition"
    - "SYS-ARROW-PLACEMENT: blocked_cells 입력과 playable capacity"
    - "SYS-DEPENDENCY-TARGETING: blocked_cells 전달"
    - "SYS-BOARD-STATE: grid_size와 blocked_cells 상태 공개"
    - "SYS-PATH-RULE: stage grid_size 계약 유지"
    - "SYS-BOARD-VIEWPORT: 좌표 변환, 가시 범위, 이동 상태·경계"
    - "SYS-TOUCH-FEEDBACK: 탭·드래그 분기와 grid hit-test"
  deferred_items:
    - "OPT-SPARSE-CHUNK-RENDERING-006: 10000셀 가드와 가시 범위 렌더링 검증 실패 시 재검토"
    - "EPIC-BALANCE-AUTHORING-007"
    - "FEATURE-MAP-GENERATION-MODE-008"
  required_next_actions:
    - "EG-BOARD-DATA-MASK-006: 스테이지 데이터, 마스크 정규화·검증, 생성 파이프라인 계약 구현"
    - "EG-BOARD-VIEWPORT-006: 좌표 변환, 가시 범위 렌더링, 탭·드래그 상태와 추출 거리 구현"
    - "EG-BOARD-LARGE-REGRESSION-006: 9x9 회귀, 직사각·마스크, 99x99, 999축 안전 가드 검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "risk=high; SYS-STAGE-CATALOG, SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-TARGETING, SYS-BOARD-STATE 통합 QA"
    - "동일 grid_size, mask_rows, seed, 생성 프로필의 blocked_cells·arrows·solution_order가 동일"
    - "마스크 행·열·문자·전면 차단·점유 위반과 999축·10000셀 가드를 개별 오류로 거절"
    - "99x99와 999x10에서 전체 격자 draw loop 없이 가시 범위만 반환하고 좌표 왕복·pan clamp가 유효"
    - "짧은 탭, 임계값 미만 이동, 임계값 이상 드래그, 화살 위 드래그, 추출 중 입력 잠금 자동 검증"
    - "user_check: 실제 화면의 시작 위치, 드래그 감도, 경계 고정, 화살 탭 오인 방지"
  sot_delta_refs:
    - "SOT-006-VARIABLE-BOARD-RULE"
    - "SOT-006-BOARD-MASK-RULE"
    - "SOT-006-BOARD-NAVIGATION-RULE"
    - "SOT-006-GENERATION-MASK-CONTRACT"
    - "SOT-006-BOARD-VIEWPORT-SYSTEM"
    - "SOT-006-STAGE-CATALOG-BOARD-CONTRACT"
  refs:
    - "02-design-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
---
