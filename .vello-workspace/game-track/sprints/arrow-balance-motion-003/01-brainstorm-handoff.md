---
handoff:
  stage: brainstorm
  status: ready_for_design
  interview_type: no-interview
  next_skill: vello-game-design-02
  required_inputs:
    - "../../../../MyRequest/요구사항2_브레인스토밍_결과.md"
    - "../../current-design/current-design.yaml"
    - "08-sprint-closeout.yaml"
  confirmed_decisions:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004의 대상은 지역·단위별 화살 선행 의존성과 순서 강제성이다"
    - "길이 범위와 빈칸 비율은 형상 밀도 수치, 선행 의존 그래프는 난이도 수치로 분리한다"
    - "후보 범위는 분석·거절, 모듈 템플릿, 그래프 우선 합성 방식이다"
    - "DECISION-DEPENDENCY-004: ADVANCED-DEPENDENCY-DIFFICULTY-004는 다음 별도 스프린트로 이관한다"
  deferred_items:
    - "ADVANCED-DEPENDENCY-DIFFICULTY-004: 다음 스프린트 디자인·구현 대상으로 이관"
  required_next_actions:
    - "현재 스프린트 closeout에서 ADVANCED-DEPENDENCY-DIFFICULTY-004와 본 handoff를 carry_forward에 기록"
    - "다음 스프린트에서 본 handoff와 최신 current-design.yaml 및 직전 08-sprint-closeout.yaml을 입력으로 vello-game-design-02 실행"
    - "vello-game-design-02에서 후보 A 의존 그래프 분석기, 난이도 지표, 목표 허용 범위를 확정"
  blockers: []
  decisions_needed:
    - "DESIGN-DEPENDENCY-004: 후보 A MVP에 포함할 지표와 난이도별 목표 허용 범위"
  verification_requirements:
    - "설계 단계에서 의존 깊이, 시작 이동 가능 비율, 강제 상태 비율과 실제 체감 난이도의 상관관계를 정의"
  sot_updates_required:
    - "구현 스프린트 closeout 시 확정된 의존 지표를 current-design.yaml에 반영"
  refs:
    - "../../../../MyRequest/요구사항2_브레인스토밍_결과.md"
    - "04-implementation-plan-handoff.md"
    - "../../current-design/current-design.yaml"
---
