---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: direct_execution
  scope_authorization: confirmed
  execution_groups:
    - id: EG-STAGE-SELECT-009
      targets: [SYS-GAME-HOME-FLOW]
      completion: "홈 화면이 넓은 스크롤 영역에 등록된 모든 스테이지 선택 버튼과 고정·랜덤 생성 방식, 크기·목표/실제 빈칸·초기 가능 비율을 표시하고, 탭·드래그를 구분해 각 버튼으로 해당 스테이지를 시작한다."
      risk: medium
      verification_mode: embedded
      verification: ["stage 목록 버튼 입력, 스크롤 범위, 카드 지표와 fixed·random 스테이지 진입 회귀"]
  completion_mode: deliver_only
  required_inputs: ["명시적으로 확정된 direct execution 범위", "sot-delta.yaml"]
  confirmed_decisions: ["홈 제목은 STAGE LIST이며 모든 등록 스테이지를 잠금 없이 노출한다"]
  deferred_items: ["스테이지 잠금·진행도 표시"]
  required_next_actions: ["EG-STAGE-SELECT-009 목록 스크롤 구현 및 embedded 검증"]
  blockers: []
  decisions_needed: []
  verification_requirements: ["test_map_generation_controller", "test_playable_flow"]
  sot_delta_refs: [SOT-009-STAGE-SELECT]
---
