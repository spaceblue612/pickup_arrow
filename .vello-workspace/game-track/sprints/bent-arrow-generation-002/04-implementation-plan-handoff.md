---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: design_delta
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "03-system-spec-handoff.md"
  execution_groups:
    - id: EG-SHAPE-RULE-001
      bundles: [BUNDLE-SHAPE-001, BUNDLE-PATH-002, BUNDLE-PLACE-001]
      targets: [SYS-STAGE-CATALOG, SYS-PATH-RULE, SYS-ARROW-PLACEMENT]
      completion_criteria:
        - "길이 1~20의 연결된 꺾인 몸통 데이터를 검증한다"
        - "전체 몸통의 이동 경로와 다른 몸통의 충돌을 판정한다"
        - "고정 seed로 비중복이며 해결 가능한 보드를 생성한다"
      risk: high
      verification: independent_qa
    - id: EG-RUNTIME-002
      bundles: [BUNDLE-STATE-002, BUNDLE-PRESENT-001]
      targets: [SYS-BOARD-STATE, SYS-TOUCH-FEEDBACK]
      completion_criteria:
        - "몸통 어느 칸을 눌러도 해당 화살을 선택한다"
        - "꺾인 몸통과 화살촉을 표시한다"
        - "추출 시 전체 몸통이 화살촉 방향으로 함께 이동한다"
        - "기존 스테이지 진행과 막힘 상태 불변 규칙을 유지한다"
      risk: high
      verification: independent_qa
  user_gates:
    - id: USER-VISUAL-001
      after_group: EG-RUNTIME-002
      check: "모바일 세로 화면에서 꺾인 몸통, 화살촉 방향, 선택 영역을 육안 확인"
  confirmed_decisions:
    - "기존 단일 cell 데이터는 cells 배열로 교체한다"
    - "배치 실패는 제한된 재시도 후 명시적 generation_error로 반환한다"
  deferred_items:
    - "생성 난이도 조절 화면"
    - "생성 seed 입력 화면"
  required_next_actions:
    - "IMPLEMENT-SHAPE-001: EG-SHAPE-RULE-001 구현"
    - "IMPLEMENT-RUNTIME-002: EG-RUNTIME-002 구현"
    - "QA-BENT-001: 두 실행 그룹 독립 검증"
    - "USER-VISUAL-001: 자동 검증 후 사용자 화면 확인"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "각 그룹은 Godot 4.7.1 헤드리스 테스트의 명령, 판정, 실패 ID, 재검증 필요 여부를 기록"
    - "EG-SHAPE-RULE-001은 길이 경계, 잘못된 몸통, 충돌, seed 생성, 해결 순서를 검증"
    - "EG-RUNTIME-002는 몸통 선택, 차단 상태 불변, 전체 몸통 이동, 스테이지 진행을 검증"
  sot_updates_required:
    - "closeout 시 새 규칙과 시스템을 current-design.yaml 및 entity-ledger.yaml에 반영"
  refs:
    - "03-system-spec-handoff.md"
---
