---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: direct_execution
  scope_authorization: confirmed
  execution_groups:
    - id: EG-MAP-GENERATION-OPTIMIZATION-012
      targets: [SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-ANALYZER, SYS-DEPENDENCY-TARGETING]
      completion_criteria:
        - "STAGE-007~010이 profile과 seed 정책을 유지하며 각각 10초 안에 생성된다"
        - "생성 결과가 목표 점유율, 의존성 범위, 완전한 풀이, 결정성을 유지한다"
        - "외곽 스트립이나 과도한 일렬 배치 없이 화살촉과 굴곡이 보드 전역에 분산된다"
        - "지원하지 않는 보드 형태는 기존 생성 경로를 사용한다"
      risk: medium
      verification_mode: embedded
  completion_mode: deliver_only
  required_inputs: ["사용자가 확정한 외곽 스트립 생성 금지", "current-design/current-design.yaml"]
  confirmed_decisions: ["새 워크트리에서 실험", "고정·랜덤 공통 분산형 생성 로직", "generation_mode는 seed 정책만 구분", "기존 생성기 fallback 유지", "의존 그래프 재사용"]
  changed_items: [SYS-ARROW-PLACEMENT, SYS-DEPENDENCY-ANALYZER, SYS-DEPENDENCY-TARGETING]
  required_next_actions: ["EG-MAP-GENERATION-OPTIMIZATION-012 구현 및 embedded 검증"]
  verification_requirements: ["대형 스테이지 성능·외곽 정렬 회귀", "test_gameplay_core", "test_stage_catalog", "test_playable_flow", "test_arrow_placement"]
  refs: ["scripts/arrow_placement.gd", "scripts/dependency_analyzer.gd", "scripts/dependency_targeting.gd"]
---
