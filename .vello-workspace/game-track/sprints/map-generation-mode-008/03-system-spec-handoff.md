---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "SYS-BOARD-VIEWPORT.play_rect: 현재 UI 기준 x=0부터 viewport_width, y=150부터 viewport_height-90까지의 최대 직사각 clip·입력 영역"
    - "SYS-BOARD-VIEWPORT.scale: base_cell_size=play_rect.width/9, zoom 범위 0.25..2.0, stage load 시 1.0"
    - "SYS-BOARD-VIEWPORT.zoom_at: focus 화면 좌표의 zoom 전 grid 위치를 보존해 cell_size와 board_origin을 갱신한 뒤 축별 clamp"
    - "SYS-BOARD-VIEWPORT.pointer: 단일 포인터 tap·pan 상태와 별도로 두 touch의 거리·중점으로 pinch 상태를 관리하며 pinch 종료는 tap을 발생시키지 않는다"
    - "SYS-BOARD-VIEWPORT.desktop: mouse wheel은 cursor focus로 고정 배율 step을 적용하고 좌클릭 pan·tap과 공존한다"
    - "SYS-GAME-INPUT.preview: read_only_preview는 board navigation 입력을 허용하고 tap selection만 무시한다"
  changed_items:
    - SYS-BOARD-VIEWPORT
    - SYS-GAME-INPUT
  deferred_items:
    - "화면 고정 확대·축소 버튼"
  required_next_actions:
    - "확장 play_rect·zoom transform·pinch 상태와 preview 입력 경계를 한 execution group으로 구현한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "720x1280 play_rect=Rect2(0,150,720,1040)"
    - "zoom focus round-trip, 0.25..2.0 clamp, zoom별 pan clamp"
    - "pinch 후 tap 미발생, mouse wheel focus zoom, preview pan·zoom과 selection 차단"
    - "기존 tap·drag·추출 흐름 회귀"
  sot_delta_refs:
    - SOT-008-BOARD-VIEWPORT-NAVIGATION-V2
  refs:
    - "02-design-handoff.md"
    - "sot-delta.yaml"
---
