---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: direct_execution
  scope_authorization: confirmed
  execution_groups:
    - id: EG-HOME-SUMMARY-LOADING-010
      targets: [SYS-GAME-HOME-FLOW, SYS-HOME-SUMMARY-LOADER]
      completion_criteria:
        - "홈 화면이 요약 생성보다 먼저 그려진다"
        - "등록 스테이지 요약이 워커에서 순차 생성되고 완료 수 프로그레스가 표시된다"
        - "요약 미준비 고정 스테이지 선택은 메인 스레드를 차단하지 않는다"
      risk: medium
      verification_mode: embedded
  user_gates:
    - "실행 중 홈 화면과 로딩 진행 표시의 체감 확인"
  completion_mode: deliver_only
  required_inputs: ["명시적으로 확정된 direct execution 범위", "current-design/current-design.yaml", "sot-delta.yaml"]
  confirmed_decisions: ["홈 화면 선표시", "순차 비동기 요약 로딩", "완료 수 프로그레스 표시"]
  changed_items: [SOT-010-HOME-SUMMARY-LOADING]
  required_next_actions: ["EG-HOME-SUMMARY-LOADING-010 구현 및 embedded 검증"]
  verification_requirements: ["test_map_generation_controller", "영향받는 게임플레이 회귀", "headless 시작 화면 확인"]
  sot_delta_refs: [SOT-010-HOME-SUMMARY-LOADING]
  refs: ["scripts/main.gd", "scripts/map_generation_controller.gd", "tests/test_map_generation_controller.gd"]
---
