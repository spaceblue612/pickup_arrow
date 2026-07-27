---
handoff:
  stage: design
  status: ready_for_system_spec
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "../arrow-balance-motion-003/01-brainstorm-handoff.md"
    - "../arrow-balance-motion-003/08-sprint-closeout.yaml"
    - "../../current-design/current-design.yaml"
  confirmed_decisions:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004: 화살을 노드, 선행 제거 조건을 방향 간선으로 표현한다"
    - "형상 밀도 수치와 선행 의존 난이도 수치를 분리한다"
    - "첫 구현 경로는 후보 A 의존 그래프 분석·측정 방식이다"
    - "이번 스프린트는 A인 분석·출력을 먼저 구현하고, B인 목표 범위 기반 생성 선별·재생성은 후속 작업으로 둔다"
    - "간선 방향은 blocker에서 blocked 화살로 향한다"
    - "의존 깊이는 정적 의존 그래프의 최장 경로 노드 수, 시작 이동 가능 비율은 초기 추출 가능 수/전체 수로 정의한다"
    - "강제 상태 비율은 결정적 해결 시뮬레이션의 각 제거 상태 중 선택지가 1개인 상태의 비율로 정의한다"
    - "평균 선택지 수와 결정적 전체 해결 순서를 함께 출력해 후속 B가 같은 분석 결과를 재사용한다"
  changed_items:
    - "SYS-ARROW-PLACEMENT: 생성 보드의 의존 그래프와 난이도 지표 산출 대상"
    - "SYS-PATH-RULE: 화살별 직접 blocker 관계 제공 대상"
  deferred_items:
    - "B: 목표 난이도 범위 판정과 범위 밖 보드 선별·재생성"
    - "모듈 템플릿 생성 방식"
    - "그래프 우선 형상 합성 방식"
  required_next_actions:
    - "의존 분석기 입력·출력과 오류 계약을 system spec으로 확정"
    - "고정 보드와 실제 생성 스테이지를 대상으로 A를 구현·검증"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "동일 seed와 보드에서 의존 그래프와 지표가 재현 가능해야 한다"
    - "의존 깊이, 시작 이동 가능 비율, 강제 상태 비율을 손으로 계산 가능한 고정 보드와 대조한다"
    - "현재 세 스테이지의 해결 가능성과 기존 배치 프로필을 유지한다"
  sot_updates_required:
    - "closeout에서 확정된 의존 지표와 생성기 적용 규칙을 current-design.yaml에 반영"
  refs:
    - "../arrow-balance-motion-003/01-brainstorm-handoff.md"
    - "../arrow-balance-motion-003/08-sprint-closeout.yaml"
    - "../../../../MyRequest/요구사항2_브레인스토밍_결과.md"
---
