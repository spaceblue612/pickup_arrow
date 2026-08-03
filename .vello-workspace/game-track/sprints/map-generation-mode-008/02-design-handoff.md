---
handoff:
  stage: design
  status: ready_for_system_spec_or_implementation_plan
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "01-brainstorm-handoff.md"
    - "../../current-design/current-design.yaml"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "RULE-BOARD-PLAY-AREA-008: 보드 클리핑은 좌우 화면 폭을 사용하고 위쪽 gameplay UI와 아래쪽 상태 영역만 제외한 세로 영역 전체를 사용한다"
    - "RULE-BOARD-DEFAULT-SCALE-008: 기본 셀 크기는 가로 약 9칸이 보이는 기존 크기를 유지하되 넓어진 세로 영역에는 더 많은 행을 표시한다"
    - "FEATURE-BOARD-ZOOM-008: 0.25x~2.0x 범위에서 터치 pinch와 데스크톱 mouse wheel로 확대·축소한다"
    - "RULE-ZOOM-FOCUS-008: 확대·축소 중심은 pinch 중점 또는 mouse cursor이며 해당 지점의 보드 좌표를 화면상 같은 위치에 유지한다"
    - "RULE-PREVIEW-NAVIGATION-008: read-only preview도 pan·zoom은 허용하고 화살 선택·추출만 막는다"
    - "RULE-BOARD-NAVIGATION-COMPAT-008: 기존 이동거리 기반 tap·drag 구분과 보드 외곽 clamp를 zoom 배율별로 유지한다"
    - "RULE-TARGET-EMPTY-RATIO-008: target_empty_ratio는 플레이 가능 셀 중 비어 있을 셀 비율이며 0.1은 약 90% 셀 점유를 뜻한다"
  changed_items:
    - RULE-BOARD-PLAY-AREA-008
    - RULE-BOARD-DEFAULT-SCALE-008
    - FEATURE-BOARD-ZOOM-008
    - RULE-ZOOM-FOCUS-008
    - RULE-PREVIEW-NAVIGATION-008
    - RULE-BOARD-NAVIGATION-COMPAT-008
  deferred_items:
    - "화면 고정 확대·축소 버튼"
    - "정식 홈 이동·스테이지 선택 UX"
    - "preview candidate seed의 Google Sheets 자동 writeback"
  required_next_actions:
    - "확대 영역·zoom transform·멀티터치 상태와 read-only preview 입력 경계를 system spec에서 정의한다"
    - "보드 viewport와 게임 입력 회귀를 구현 계획에 반영한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "720x1280에서 play area가 좌우 폭과 UI 제외 세로 공간을 사용한다"
    - "기본 배율에서 가로 약 9칸과 9칸보다 많은 세로 행이 보인다"
    - "pinch·mouse wheel 확대축소가 focus 위치를 유지하고 허용 범위와 보드 외곽을 넘지 않는다"
    - "preview에서는 pan·zoom이 되고 tap으로 화살이 제거되지 않는다"
    - "target_empty_ratio=0.1 snapshot은 실제 빈 셀 비율 0.1 이내 한 셀 오차를 유지한다"
  sot_delta_refs:
    - SOT-008-BOARD-VIEWPORT-NAVIGATION-V2
    - SOT-008-BALANCE-PREVIEW-MODE-V2
    - SOT-008-RANDOM-STAGE-004-V2
  refs:
    - "01-brainstorm-handoff.md"
    - "../../current-design/current-design.yaml"
    - "sot-delta.yaml"
---
