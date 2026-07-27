---
handoff:
  stage: design
  status: ready_for_system_spec
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "../../../../MyRequest/요구사항2.txt"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "CORE-SNAKE-EXTRACTION-004: 화살촉은 방향 1라인으로 이동하고 각 후위 몸통은 바로 앞 몸통의 이동 경로를 순차적으로 따른다"
    - "CORE-HEAD-RAY-COLLISION-004: 이동 가능 판정은 화살촉 진행 1라인에 있는 다른 화살 또는 자기 몸통으로 한정한다"
    - "화살 전체 형상을 유지하는 평행 이동은 제거한다"
    - "화살 전체 형상의 평행 이동 영역을 사용하는 충돌 판정은 제거한다"
  changed_items:
    - "SYS-PATH-RULE: 전체 몸통 평행 이동 충돌에서 화살촉 1라인 충돌로 변경"
    - "SYS-TOUCH-FEEDBACK: 고정 형상 오프셋에서 선행 몸통 경로 추종 표시로 변경"
  removed_items:
    - "CORE-BODY-COLLISION-001의 전체 몸통 평행 이동 경로 판정"
  deferred_items:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004: 다음 별도 스프린트"
  required_next_actions:
    - "SYS-PATH-RULE의 화살촉 1라인 입력·출력 계약 정의"
    - "SYS-TOUCH-FEEDBACK의 연속 진행도와 몸통별 경로 추종 계약 정의"
    - "BOARD-STATE의 추출 완료 시점과 입력 잠금 계약 유지 확인"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "화살촉 라인 밖의 다른 화살은 이동을 차단하지 않는다"
    - "화살촉 라인 위의 다른 화살과 자기 몸통은 이동을 차단한다"
    - "후위 몸통은 선행 몸통의 초기 경로와 화살촉 직선 경로를 순서대로 따른다"
    - "마지막 몸통이 화면 밖으로 나간 뒤에만 상태에서 화살을 제거한다"
  sot_updates_required:
    - "closeout에서 extraction과 collision gameplay 규칙을 갱신"
  refs:
    - "../../current-design/current-design.yaml"
    - "05-implementation-handoff.md"
---
