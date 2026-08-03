---
handoff:
  stage: design
  status: ready_for_system_spec_or_implementation_plan
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "01-brainstorm-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
    - "../dependency-targeting-005/08-sprint-closeout.yaml"
  confirmed_decisions:
    - "CORE-VARIABLE-BOARD-006: 스테이지별 양의 정수 width와 height로 유한한 직사각 보드를 확정하며 런타임 무한 확장은 없다"
    - "CORE-BOARD-SIZE-GUARD-006: 99x99를 대표 대형 보드로 검증하고 한 변 999는 조건부 처리하며 자원 한도 초과 입력은 축소 없이 거절한다"
    - "CORE-BOARD-MASK-006: 마스크가 없으면 전체 셀이 배치 가능하고 마스크가 있으면 지정 셀의 화살 배치와 표시를 제외한다"
    - "CORE-MASK-PATH-006: 배치 불가 셀은 충돌체나 경계가 아니며 추출 경로는 직사각 보드 외곽까지 유지한다"
    - "CORE-PLAYABLE-CAPACITY-006: 생성 밀도와 용량은 배치 가능 셀 수를 기준으로 계산한다"
    - "UX-BOARD-PAN-006: 이동 임계값 미만은 선택, 이상은 선택 취소 후 보드 드래그로 처리하며 보드 전체가 드래그 표면이다"
    - "UX-BOARD-FIT-006: 기존 9x9 기준 셀 크기를 유지하고 넘치는 축만 이동하며 스테이지 시작 시 보드 중심을 표시한다"
    - "UX-BOARD-INPUT-PHASE-006: 기존 추출 중 입력 잠금을 유지하고 READY 상태에서만 선택과 이동을 허용한다"
  changed_items:
    - "SYS-STAGE-CATALOG: 스테이지별 grid_size와 blocked_cells 소유·검증"
    - "SYS-ARROW-PLACEMENT: 배치 가능 셀 기반 용량·밀도·몸통 생성"
    - "SYS-PATH-RULE: 스테이지별 grid_size 사용 및 blocked_cells 비충돌 규칙 유지"
    - "SYS-BOARD-STATE: 활성 보드 크기와 마스크를 런타임 상태로 전달"
    - "SYS-TOUCH-FEEDBACK: 탭과 드래그 이동 임계값 분리"
    - "SYS-BOARD-VIEWPORT: 화면 변환, 표시 범위, 이동 오프셋, 선택 좌표 관리"
  removed_items:
    - "GLOBAL-GRID-SIZE-9X9"
    - "AUTO-FIT-ENTIRE-BOARD-BY-CELL-SHRINK"
    - "FEATURE-INFINITE-EXPANDING-BOARD"
    - "TARGET-BOARD-SIDE-99999"
  deferred_items:
    - "EPIC-BALANCE-AUTHORING-007: 난이도 항목, 운영 편집 방식, 스테이지 미리보기"
    - "FEATURE-MAP-GENERATION-MODE-008: 고정 맵·랜덤 맵 옵션"
    - "OPT-SPARSE-CHUNK-RENDERING-006: 대표 성능 검증에서 필요성이 확인될 때만 구현 계획에 포함"
  required_next_actions:
    - "SYS-SPEC-BOARD-DATA-006: grid_size, 원본 도트 입력, 정규화 blocked_cells의 소유권과 검증 계약 정의"
    - "SYS-SPEC-BOARD-GENERATION-006: 마스크 기반 배치·밀도·결정성 및 분석기 입출력 정의"
    - "SYS-SPEC-BOARD-VIEWPORT-006: 보드 좌표 변환, 가시 셀 범위, 드래그 상태, 탭 취소 계약 정의"
    - "SYS-SPEC-BOARD-RESOURCE-GUARD-006: 밀집 방식 프로파일링 기준, 안전 상한, 오류 정책, 희소·청크 전환 조건 정의"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "high / independent_qa: 기존 9x9 전체 회귀와 서로 다른 직사각 보드 크기의 생성·검증·플레이 흐름"
    - "high / independent_qa: 마스크 기본값, 잘못된 마스크, 배치 불가 셀 점유 거절, 해결 가능 생성의 결정성"
    - "high / independent_qa: 대표 99x99 로딩·가시 범위 렌더링·메모리·프레임·생성 시간"
    - "high / independent_qa: 한 변 999 입력의 안전한 처리 또는 명시적 거절과 정수 용량 계산"
    - "user_check: 화살 위를 포함한 드래그, 짧은 탭 선택, 경계 고정, 스테이지 시작 위치의 실제 조작감"
  sot_delta_refs:
    - "SOT-006-VARIABLE-BOARD-RULE"
    - "SOT-006-BOARD-MASK-RULE"
    - "SOT-006-BOARD-NAVIGATION-RULE"
    - "SOT-006-GENERATION-MASK-CONTRACT"
    - "SOT-006-BOARD-VIEWPORT-SYSTEM"
    - "SOT-006-STAGE-CATALOG-BOARD-CONTRACT"
  refs:
    - "01-brainstorm-handoff.md"
    - "sot-delta.yaml"
    - "../../current-design/current-design.yaml"
---
