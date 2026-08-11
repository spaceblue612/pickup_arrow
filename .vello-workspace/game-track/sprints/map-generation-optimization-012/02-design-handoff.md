---
handoff:
  stage: design
  status: needs_user_approval
  next_skill: vello-game-implementation-plan-04
  goal_alignment:
    parent_goal_refs: ["current-design.yaml#generation", "current-design.yaml#dependency_analysis", "04-implementation-plan-handoff.md#completion_criteria"]
    change_goal: "파일 기반 필수 요구사항 계약으로 대형 맵 최적화의 기능·난이도·형상·성능 회귀를 동시에 차단한다."
    relation: extend
    preserved_outcomes: ["10초 생성 제한", "profile 점유율·길이·화살 수", "완전한 풀이와 무교착", "dependency 목표", "fixed 결정성과 random 다양성", "보드 전역 분산·굴곡·꼬임"]
  required_inputs: ["current-design/current-design.yaml", "sot-delta.yaml#MAP-GEN-ACCEPTANCE-012"]
  confirmed_decisions: [MG-GOV-001, MG-GOV-002, MG-GOV-003, MG-GOV-004, MG-GOV-005, MG-FUNC-001, MG-FUNC-002, MG-FUNC-003, MG-DIFF-001, MG-SEED-001, MG-MODE-001, MG-MODE-002, MG-SPACE-001, MG-SPACE-002, MG-SHAPE-001, MG-SHAPE-002, MG-PERF-001, MG-VISUAL-001]
  changed_items: [generation.acceptance_contract]
  required_next_actions: ["요구사항 계약 승인", "승인 후 기존 구현을 전 요구사항 기준으로 재검증하고 생성기를 재설계"]
  verification_requirements: ["요구사항 파일 fail-closed schema validation", "각 필수 ID별 독립 assertion", "STAGE-007~010 통합 판정", "MG-VISUAL-001 사용자 확인"]
  sot_delta_refs: [MAP-GEN-ACCEPTANCE-012]
  refs: ["sot-delta.yaml"]
---
