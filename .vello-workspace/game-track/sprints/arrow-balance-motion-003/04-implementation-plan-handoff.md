---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  route: design_delta
  scope_authorization: confirmed
  completion_mode: deliver_only
  required_inputs:
    - "../../../../MyRequest/요구사항2.txt"
    - "../../current-design/current-design.yaml"
  execution_groups:
    - id: EG-PATH-MOTION-003
      bundles: [BUNDLE-SELF-BLOCK-003, BUNDLE-EXTRACTION-MOTION-003]
      targets: [SYS-PATH-RULE, SYS-BOARD-STATE, SYS-TOUCH-FEEDBACK]
      completion_criteria:
        - "화살촉 진행선 위의 자기 몸통도 선택 화살을 차단한다"
        - "추출 화살은 조절 가능한 등속도로 화면 밖까지 매 프레임 표시된다"
        - "추출 중 입력 잠금과 완료 후 제거 순서를 유지한다"
      risk: medium
      verification: user_check
    - id: EG-BALANCE-PROFILE-003
      bundles: [BUNDLE-LENGTH-LEVEL-003, BUNDLE-FILL-RATIO-003]
      targets: [SYS-ARROW-PLACEMENT, SYS-STAGE-CATALOG, CONTENT-STAGES-001-003]
      completion_criteria:
        - "스테이지별 최소·최대 길이를 생성기에 전달한다"
        - "목표 빈칸 비율까지 짧은 보충 화살을 배치한다"
        - "실제 빈칸 비율과 보충 화살 수를 생성 결과에서 확인할 수 있다"
        - "고정 seed 재현성과 완전한 해결 순서를 유지한다"
      risk: high
      verification: independent_qa
    - id: EG-SNAKE-EXTRACTION-004
      bundles: [BUNDLE-HEAD-RAY-RULE-004, BUNDLE-SNAKE-TRAIL-004]
      targets: [SYS-PATH-RULE, SYS-BOARD-STATE, SYS-TOUCH-FEEDBACK]
      completion_criteria:
        - "화살촉 진행 1라인의 점유 셀만 이동 차단에 사용한다"
        - "화살촉 라인 밖에서 전체 몸통 평행 이동에만 걸리던 화살은 차단하지 않는다"
        - "후위 몸통은 선행 몸통의 경로를 cell 간 연속 보간으로 따라간다"
        - "마지막 몸통이 화면 밖으로 나간 뒤 화살을 제거한다"
        - "추출 속도 변수와 입력 잠금을 유지한다"
      risk: high
      verification: independent_qa
  user_gates:
    - id: USER-SNAKE-MOTION-004
      after_group: EG-SNAKE-EXTRACTION-004
      check: "꺾인 후위 몸통이 화살촉과 선행 몸통의 경로를 뱀처럼 따라가는지 확인"
  confirmed_decisions:
    - "자기 차단은 화살촉에서 진행 방향으로 뻗은 선 위의 자기 몸통을 대상으로 한다"
    - "빈칸 비율은 전체 격자 중 비어 있는 칸의 비율로 정의한다"
    - "기본 화살 배치 뒤 목표 점유 칸까지 짧은 보충 화살을 추가한다"
    - "기존 호출은 목표 빈칸 비율을 생략하면 고정 화살 수 동작을 유지한다"
    - "사용자 확인에서 고정 형상 평행 이동과 전체 몸통 평행 충돌 판정이 부적합하다고 확정"
    - "EG-SNAKE-EXTRACTION-004가 USER-MOTION-003을 대체한다"
  deferred_items:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004: 지역·단위별 맞물림과 연쇄 의존성 수치화"
  required_next_actions:
    - "IMPLEMENT-PATH-MOTION-003: EG-PATH-MOTION-003 구현 및 자동 검증"
    - "IMPLEMENT-BALANCE-PROFILE-003: EG-BALANCE-PROFILE-003 구현"
    - "IMPLEMENT-SNAKE-EXTRACTION-004: EG-SNAKE-EXTRACTION-004 구현"
    - "QA-BALANCE-003: 생성기와 전체 플레이 흐름 독립 검증"
    - "USER-SNAKE-MOTION-004: 뱀 형태 경로 추종 확인"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "test_gameplay_core.gd: 자기 몸통 차단과 상태 전환"
    - "test_playable_flow.gd: 이동 거리·시간 산정과 입력 잠금"
    - "test_playable_flow.gd: 몸통별 경로 추종 진행도와 실제 Tween 완료 순서"
    - "test_arrow_placement.gd: 길이 범위, 빈칸 비율, 보충 화살, seed 재현, 해결 가능성"
    - "test_stage_catalog.gd: 스테이지별 생성 프로필과 검증"
    - "전체 헤드리스 회귀 테스트 4개와 main.tscn 기동"
  sot_updates_required:
    - "closeout 시 자기 차단 규칙과 배치 프로필을 current-design.yaml 및 entity-ledger.yaml에 반영"
  refs:
    - "../../../../MyRequest/요구사항2.txt"
    - "../../current-design/current-design.yaml"
    - "02-design-handoff.md"
    - "03-system-spec-handoff.md"
---
