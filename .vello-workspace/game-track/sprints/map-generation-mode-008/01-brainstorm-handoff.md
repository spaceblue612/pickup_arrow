---
handoff:
  stage: brainstorm
  status: ready_for_design
  interview_type: focused-interview
  next_skill: vello-game-design-02
  required_inputs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../current-design/current-design.yaml"
    - "../balance-authoring-007/08-sprint-closeout.yaml"
  confirmed_decisions:
    - "SPRINT-MAP-GENERATION-MODE-008: 이번 스프린트는 요구사항 7의 고정·랜덤 맵 생성 모드와 생성 대기 실패 흐름을 대상으로 삼는다"
    - "FEATURE-MAP-GENERATION-MODE-008: 일반 스테이지는 고정 맵을 사용하고 데일리 챌린지·특수 미션 같은 콘텐츠는 랜덤 모드를 선택할 수 있다"
    - "FEATURE-RANDOM-MAP-PER-PLAY-008: 랜덤 모드는 새 플레이를 시작할 때마다 새 맵을 생성한다"
    - "FEATURE-MAP-GENERATION-WAIT-008: 랜덤 생성 중 진행 게이지를 표시하며 최대 대기 시간은 10초다"
    - "FEATURE-MAP-GENERATION-TIMEOUT-008: 10초 안에 생성되지 않으면 문제 메시지를 표시하고 홈으로 이동해 다시 시도하도록 안내한다"
    - "CONTENT-RANDOM-STAGE-004-008: 테스트 전용 fixture가 아니라 실제 게임 진행에서 플레이할 수 있는 랜덤 STAGE-004를 한 개 추가한다"
  changed_items:
    - FEATURE-MAP-GENERATION-MODE-008
    - FEATURE-RANDOM-MAP-PER-PLAY-008
    - FEATURE-MAP-GENERATION-WAIT-008
    - FEATURE-MAP-GENERATION-TIMEOUT-008
    - CONTENT-RANDOM-STAGE-004-008
  deferred_items:
    - "FEATURE-DAILY-CHALLENGE-008: 데일리 챌린지의 날짜·보상·진행 시스템"
    - "FEATURE-SPECIAL-MISSION-008: 특수 미션의 편성·보상 시스템"
    - "FEATURE-SHEET-MAP-CONTENT-008: Google Sheets의 mask_rows와 수동 고정 화살 배치 콘텐츠"
    - "FEATURE-BALANCE-PREVIEW-WRITEBACK-008: 미리보기에서 Google Sheets로 값을 다시 쓰는 기능"
  required_next_actions:
    - "고정 모드의 맵 표현과 재사용 수명주기를 현재 결정적 seed 생성 구조에 맞춰 설계한다"
    - "랜덤 모드의 새 플레이 경계, seed 생성·소유권과 재시도 규칙을 설계한다"
    - "생성 진행률 산정, 10초 취소, 문제 메시지와 홈 이동 흐름을 설계한다"
    - "Google Sheets stage profile에 생성 모드를 표현하는 데이터 계약과 검증·동기화 변경을 설계한다"
    - "실제 게임 진행에서 STAGE-003 다음에 랜덤 STAGE-004를 진입·재플레이하는 흐름을 설계한다"
    - "대표 보드 크기에서 생성 시간과 메인 스레드 응답성을 검증하는 기준을 정한다"
  decisions_needed:
    - "DESIGN-FIXED-MAP-REPRESENTATION-008: 고정 모드가 결정적 seed 재생성 결과를 사용할지 별도 배치 snapshot을 사용할지 확정"
    - "DESIGN-RANDOM-SEED-LIFECYCLE-008: 새 플레이·실패 후 재시도·앱 재실행의 seed 수명주기 확정"
    - "DESIGN-GENERATION-PROGRESS-008: 실제 진행률을 계산할 수 없는 구간을 포함한 게이지 표시 규칙 확정"
  verification_requirements:
    - "고정 모드는 같은 스테이지의 새 플레이에서도 동일한 맵을 제공한다"
    - "랜덤 모드는 새 플레이마다 다른 seed를 사용하면서 모든 기존 해결 가능성·난이도 조건을 지킨다"
    - "랜덤 생성 중 진행 게이지가 갱신되고 게임 입력이나 화면이 멈춘 것처럼 보이지 않는다"
    - "10초 제한이나 생성 실패 시 부분 맵을 시작하지 않고 문제 메시지 뒤 홈으로 안전하게 이동한다"
    - "실제 게임 진행에 등록된 STAGE-004가 새 플레이마다 다른 유효 맵을 생성하며 테스트 fixture에만 존재하지 않는다"
    - "고정·랜덤 모드가 Google Sheets 동기화, StageCatalog, 미리보기와 기존 스테이지 진행을 깨뜨리지 않는다"
  refs:
    - "../../../../MyRequest/요구사항3.txt"
    - "../../current-design/current-design.yaml"
    - "../balance-authoring-007/08-sprint-closeout.yaml"
---
