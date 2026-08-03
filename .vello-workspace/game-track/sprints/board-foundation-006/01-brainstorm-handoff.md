---
handoff:
  stage: brainstorm
  status: ready_for_design
  interview_type: focused-interview
  next_skill: vello-game-design-02
  required_inputs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../../../MyRequest/스테이지_난이도_수치_항목.md"
    - "../../current-design/current-design.yaml"
    - "../dependency-targeting-005/08-sprint-closeout.yaml"
  confirmed_decisions:
    - "ROADMAP-BOARD-OPERATIONS-006: A 보드 기반 확장, B 밸런스 운영 도구, C 맵 생성 정책 순서로 진행한다"
    - "SPRINT-BOARD-FOUNDATION-006: 이번 스프린트는 A인 요구사항 1~3만 디자인 대상으로 삼는다"
    - "FEATURE-BOARD-DIMENSIONS-006: 보드는 스테이지별 width와 height 입력으로 확정되는 유한한 직사각 격자이며 실행 중 무한 확장하지 않는다"
    - "FEATURE-BOARD-SIZE-EXPECTATION-006: 99x99는 대표 대형 보드이고 한 변 999는 성능 검증 대상이며 99999 크기는 지원 목표가 아니다"
    - "FEATURE-BOARD-PAN-006: 보드가 화면을 넘으면 보드 전체를 드래그해 탐색할 수 있어야 한다"
    - "FEATURE-BOARD-MASK-006: 기본값은 전체 직사각 격자를 사용하고 선택적으로 도트 입력에서 배치 불가 영역을 설정한다"
    - "FEATURE-BOARD-STORAGE-006: 목표 크기에서 메모리 부족이 확인될 때 희소 저장과 청크 렌더링을 적용한다"
  changed_items:
    - "FEATURE-BOARD-DIMENSIONS-006"
    - "FEATURE-BOARD-PAN-006"
    - "FEATURE-BOARD-MASK-006"
  removed_items:
    - "FEATURE-INFINITE-EXPANDING-BOARD"
    - "TARGET-BOARD-SIDE-99999"
  deferred_items:
    - "EPIC-BALANCE-AUTHORING-007: 요구사항 4~6의 난이도 항목 확정, 운영 편집 방식, 스테이지 미리보기"
    - "FEATURE-MAP-GENERATION-MODE-008: 요구사항 7의 고정 맵·랜덤 맵 옵션"
  required_next_actions:
    - "FEATURE-BOARD-DIMENSIONS-006의 스테이지별 크기 데이터와 검증 규칙을 설계한다"
    - "FEATURE-BOARD-PAN-006의 뷰포트 초과 판정, 드래그 이동, 입력 충돌 규칙을 설계한다"
    - "FEATURE-BOARD-MASK-006의 도트 입력 형식, 좌표 매핑, 배치·경로 검증 규칙을 설계한다"
    - "대표 대형 보드 프로파일링 기준과 희소 저장·청크 렌더링 전환 조건을 정한다"
  blockers: []
  decisions_needed:
    - "DESIGN-BOARD-LIMIT-006: 실기 프로파일링으로 입력 상한과 실패 정책 확정"
    - "DESIGN-BOARD-MASK-FORMAT-006: 사람이 관리할 도트 입력 파일 형식과 검증 오류 형식 확정"
    - "DESIGN-BOARD-RENDERING-006: 밀집 렌더링의 허용 범위와 조건부 희소·청크 전략 확정"
  verification_requirements:
    - "기존 9x9 스테이지의 생성, 입력, 추출, 완료 흐름을 보존한다"
    - "대표 99x99 보드의 로딩, 드래그 탐색, 메모리와 프레임 성능을 측정한다"
    - "한 변 999 입력은 전체 점유를 보장하지 않고 안전한 생성·거절 및 저장 전략을 검증한다"
    - "배치 불가 셀에 화살을 생성하거나 배치한 스테이지 데이터를 거절한다"
  refs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../../../MyRequest/스테이지_난이도_수치_항목.md"
    - "../../current-design/current-design.yaml"
    - "../dependency-targeting-005/08-sprint-closeout.yaml"
---
