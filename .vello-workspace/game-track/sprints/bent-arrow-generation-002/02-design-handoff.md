---
handoff:
  stage: design
  status: ready_for_system_spec
  next_skill: vello-game-system-spec-03
  route: design_delta
  scope_authorization: confirmed
  required_inputs:
    - "../../current-design/current-design.yaml"
    - "../../../../MyRequest/요구사항1.txt"
  confirmed_decisions:
    - "G-SHAPE-001: 화살은 1~20개의 중복 없는 상하좌우 인접 몸통 칸으로 구성되며 꺾일 수 있다"
    - "G-SHAPE-002: 화살 데이터는 몸통 칸 목록, 화살촉 칸, 화살촉 방향을 가진다"
    - "G-MOVE-001: 선택한 화살의 전체 몸통은 화살촉 방향으로 직선 평행 이동하여 보드 밖으로 빠져나간다"
    - "G-BLOCK-001: 이동 중 몸통의 어느 칸이라도 다른 화살의 몸통 칸과 만나면 선택한 화살은 이동할 수 없다"
    - "G-BLOCK-002: 막힌 선택은 보드 상태를 바꾸지 않고 기존 막힘 피드백을 표시한다"
    - "G-PLACE-001: 배치 알고리즘은 길이 1~20의 꺾인 화살을 보드 안에 겹치지 않게 생성한다"
    - "G-PLACE-002: 생성된 보드는 모든 화살을 제거할 수 있는 해결 순서가 있을 때만 유효하다"
  changed_items:
    - "G-RULE-002"
    - "G-RULE-003"
    - "G-CONTENT-001"
    - "G-CONTENT-002"
    - "G-CONTENT-003"
  required_next_actions:
    - "SPEC-SHAPE-001: 꺾인 몸통 데이터와 검증 계약 정의"
    - "SPEC-PATH-002: 몸통 전체의 이동 충돌 판정 계약 정의"
    - "SPEC-PLACE-001: 무작위 배치, 재시도, 해결 가능성 검증 계약 정의"
    - "SPEC-RENDER-001: 몸통 선택 영역과 꺾인 선 렌더링 계약 정의"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "VERIFY-SHAPE-001: 길이 경계 1과 20, 연결성, 중복, 범위 검증"
    - "VERIFY-PATH-002: 꺾인 몸통 일부가 다른 몸통과 만나는 모든 이동을 차단"
    - "VERIFY-PLACE-001: 고정 seed 생성 결과의 비중복성과 해결 가능성 검증"
    - "VERIFY-FLOW-002: 생성된 꺾인 화살을 선택해 스테이지를 끝까지 해결"
  sot_updates_required:
    - "closeout에서 G-SHAPE-*, G-MOVE-001, G-BLOCK-*, G-PLACE-*를 current-design.yaml에 반영"
  refs:
    - "../../current-design/current-design.yaml"
    - "../../../../MyRequest/요구사항1.txt"
---
