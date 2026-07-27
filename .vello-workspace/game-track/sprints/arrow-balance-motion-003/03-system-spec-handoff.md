---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
  confirmed_decisions:
    - "SYS-PATH-RULE 입력은 selected_arrow의 head_cell·direction과 보드 점유 셀이며, 출력 blocker는 화살촉 직선 경로의 점유 화살 ID이다"
    - "SYS-PATH-RULE은 선택 화살 전체 cells의 평행 이동 영역을 검사하지 않는다"
    - "SYS-TOUCH-FEEDBACK은 추출 진행도를 cell 단위 실수로 소유한다"
    - "몸통 index i의 위치는 진행도 정수부가 i 이하이면 초기 cells[i-step], i 초과이면 head_cell + direction*(step-i)를 사용하고 소수부는 인접 위치를 선형 보간한다"
    - "추출 완료 진행도는 화살촉에서 화면 경계 밖까지의 직선 거리와 후위 몸통 수를 합산한다"
    - "SYS-BOARD-STATE는 마지막 몸통의 화면 이탈 콜백 전까지 선택 화살을 remaining_arrows에 유지한다"
  changed_items:
    - "SYS-PATH-RULE: head ray blocker contract"
    - "SYS-TOUCH-FEEDBACK: per-segment trail motion contract"
    - "SYS-BOARD-STATE: extraction completion ordering retained"
  removed_items:
    - "extraction_draw_offset 기반 고정 형상 평행 이동 계약"
  deferred_items:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004"
  required_next_actions:
    - "화살촉 라인 판정과 전체 몸통 평행 판정의 차이를 회귀 테스트로 고정"
    - "몸통별 시작·중간·종료 위치 계산을 테스트 가능한 함수로 구현"
    - "실제 Tween 중간 시점과 완료 후 제거 순서를 통합 검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "risk=high; SYS-PATH-RULE, SYS-TOUCH-FEEDBACK, SYS-BOARD-STATE 통합 회귀"
    - "꺾인 몸통의 후위 index별 정수·소수 진행 위치 검증"
    - "기존 스테이지 seed 재현성과 전체 해결 순서 재검증"
  sot_updates_required:
    - "closeout에서 CORE-SNAKE-EXTRACTION-004 및 CORE-HEAD-RAY-COLLISION-004 활성화"
  refs:
    - "02-design-handoff.md"
---
