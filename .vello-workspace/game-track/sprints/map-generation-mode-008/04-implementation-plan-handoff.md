---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: full
  scope_authorization: confirmed
  execution_groups:
    - id: EG-BOARD-VIEWPORT-ZOOM-V2-008
      targets: [SYS-BOARD-VIEWPORT, SYS-GAME-INPUT]
      completion: "보드가 확장된 play area에서 clip되고 pan·pinch·wheel zoom과 preview navigation이 기존 tap·추출 흐름을 깨지 않고 동작한다."
      risk: medium
      verification_mode: user_check
      verification:
        - "play_rect 크기, zoom focus·범위·clamp, pinch state와 preview input 자동 회귀"
        - "실제 세로 화면의 공간 활용·확대축소 조작 확인"
  user_gates:
    - id: USER-BOARD-VIEWPORT-ZOOM-008
      group: EG-BOARD-VIEWPORT-ZOOM-V2-008
      check: "세로 화면에서 보드 영역이 충분히 넓고 pinch·wheel zoom 및 pan이 자연스럽다."
  completion_mode: deliver_only
  required_inputs:
    - "03-system-spec-handoff.md"
    - "sot-delta.yaml"
  confirmed_decisions:
    - "확장 play area, 0.25x..2.0 focus zoom, preview navigation 계약을 구현한다"
  deferred_items:
    - "화면 고정 확대·축소 버튼"
    - "정식 홈 이동·스테이지 선택 UX"
  required_next_actions:
    - "EG-BOARD-VIEWPORT-ZOOM-V2-008 구현과 자동 검증 뒤 사용자 확인을 요청한다"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "test_board_foundation, playable_flow와 필수 gameplay 회귀"
    - "main·preview headless 시작 오류 없음"
  sot_delta_refs:
    - SOT-008-BOARD-VIEWPORT-NAVIGATION-V2
  refs:
    - "03-system-spec-handoff.md"
    - "02-design-handoff.md"
    - "sot-delta.yaml"
---
