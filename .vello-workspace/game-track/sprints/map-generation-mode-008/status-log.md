## 2026-08-03 / brainstorm / approval_requested

- 대상: 01-brainstorm-handoff.md
- 완료: 고정·랜덤 모드, 새 플레이마다 랜덤 생성, 10초 진행 게이지와 실패 후 홈 복귀 범위 확정
- 제외: 데일리·특수 미션 자체 시스템, Sheets 수동 맵 콘텐츠, preview writeback
- 다음: 사용자 브레인스토밍 승인 또는 수정 요청

## 2026-08-03 / brainstorm / revision_requested

- 대상: 01-brainstorm-handoff.md, sprint.yaml
- 조정: 테스트 전용이 아닌 실제 게임 진행용 랜덤 STAGE-004 한 개를 구현 범위에 추가
- 다음: 수정된 브레인스토밍 사용자 승인 또는 추가 수정

## 2026-08-03 / brainstorm / approved

- 대상: 01-brainstorm-handoff.md
- 승인: 고정·랜덤 생성 모드, 실제 랜덤 STAGE-004, 10초 생성 대기와 실패 후 홈 복귀 범위
- 다음: vello-game-design-02

## 2026-08-03 / design / approval_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 완료: schema v2 generation_mode, 실제 random STAGE-004, 비동기 생성·10초 제한·홈 재시도와 미리보기 계약
- 다음: 사용자 디자인 승인 또는 수정 요청

## 2026-08-03 / design / approved

- 대상: 02-design-handoff.md
- 승인: schema v2, fixed·random lifecycle, STAGE-004, 10초 생성 흐름, 최소 홈·재시도와 미리보기 범위
- 다음: vello-game-system-spec-03

## 2026-08-03 / implementation / delivery_complete

- 완료 그룹: EG-BALANCE-SCHEMA-V2-008, EG-MAP-GENERATION-CONTROLLER-008, EG-RANDOM-STAGE-GAME-FLOW-008, EG-BALANCE-PREVIEW-MODE-008
- 자동 검증: Node schema·Apps Script, 전체 영향 Godot 회귀, main·preview 시작 통과
- 남은 확인: 세 independent_qa group, 실제 Sheets v2 migration·sync, 게임 생성 흐름과 preview user gate
- 다음: vello-game-qa-06

## 2026-08-03 / qa / passed

- 판정: EG-BALANCE-SCHEMA-V2-008, EG-MAP-GENERATION-CONTROLLER-008, EG-RANDOM-STAGE-GAME-FLOW-008 통과
- 확인: schema migration·hash, fixed·random seed, 비동기 timeout·stale 폐기, 실제 STAGE-004 진행과 gameplay 회귀
- 남은 확인: 실제 Sheets v2 migration·sync, 게임 생성 흐름, preview mode·seed 가독성
- 다음: 사용자 확인

## 2026-08-03 / user_check / repair_requested

- 실패: v1 stage_profiles 표준 범위 밖 데이터로 구조 마이그레이션이 중단됨
- 보완: 전체 기존 탭을 숨김 백업한 뒤 표준 밖 데이터는 백업에만 보존하고 v2 migration을 계속하도록 수정
- 검증: Apps Script syntax와 migration fixture 통과
- 다음: Code.gs 재교체·새 배포 후 구조 마이그레이션 재시도

## 2026-08-03 / user_check / repair_requested

- 실패: _meta는 v1이지만 stage_profiles에 v2 generation_mode 헤더가 있는 부분 마이그레이션 상태 감지
- 보완: v1 또는 부분 v2 헤더를 자동 판별하고 누락 mode·STAGE-004를 보정하도록 수정
- 검증: Apps Script syntax와 v1·부분 v2 migration fixture 통과
- 다음: Code.gs 재교체·새 배포 후 구조 마이그레이션 재시도

## 2026-08-03 / user_check / repair_requested

- 실패: v1 숫자 입력 검증이 새 generation_mode 값 쓰기를 거절함
- 보완: v2 표 쓰기 전에 기존 data validation을 제거하고 v2 규칙을 재적용하도록 수정
- 다음: Code.gs 재교체·새 배포 후 구조 마이그레이션 재시도

## 2026-08-03 / user_check / repair_requested

- 실패: 이전 쓰기 실패로 v2 헤더와 A:G만 남은 표를 재변환해 H:S 필수값이 비어 있음
- 보완: 완전한 숨김 `stage_profiles` 백업을 찾아 원본으로 사용하고 `_meta`가 이미 v2인 중단 상태도 자동 복구
- 검증: Apps Script syntax와 중단 상태·백업 선택 회귀 fixture 통과
- 다음: Code.gs 재교체 후 구조 마이그레이션 재시도

## 2026-08-03 / user_check / repair_requested

- 실패: 중단 상태 판정이 모든 행의 H:S 공백만 허용해 2행만 손상된 실제 상태를 놓침
- 보완: 일부 손상 행을 감지하고 해당 stage_id가 완전한 백업에 있을 때만 자동 복구
- 검증: 실제 오류와 같은 단일 손상 행 회귀 fixture

## 2026-08-03 / user_check / verification_aid_added

- 추가: 디버그 전용 TEST STAGE-004·TEST HOME과 random runtime seed 표시
- 보류: 정식 홈 이동·스테이지 선택 UX는 별도 스프린트
- 검증: 직접 진입·홈 복귀·재진입 seed 변경, 필수 gameplay 회귀, main 시작 통과

## 2026-08-03 / user_check / blocker

- 실패: 크기만 확대한 profile이 목표 점유 셀과 filler 수를 크게 늘려 기존 dependency target 후보를 찾지 못함
- 보완: filler-heavy 배치는 역순 해결 가능성을 보장하고 fixed 생성 실패를 홈에 표시
- 차단: STAGE-002 25x25와 STAGE-004 16x16의 dependency target 재설정·sync 필요

## 2026-08-03 / design / revision_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 변경: 난이도 범위 hard reject를 closest-valid 선택으로 교체하고 fixed 후보 반복 탐색을 추가
- 다음: 수정 디자인 승인 요청

## 2026-08-03 / design / approval_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 완료: depth backbone, soft target 점수, forced 관측 전용, fixed candidate seed 채택 흐름
- 다음: 사용자 승인 또는 수정 요청

## 2026-08-03 / design / revision_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 변경: 모든 채택 후보에 완전한 풀이와 무교착을 절대 조건으로 명시
- 다음: 수정 디자인 재승인 요청

## 2026-08-03 / design / approved

- 대상: 02-design-handoff.md, sot-delta.yaml
- 승인: 풀이 보장, closest-valid 선택, forced 관측 전용, fixed 후보 반복 생성
- 다음: vello-game-system-spec-03

## 2026-08-03 / implementation / delivery_complete

- 완료 그룹: EG-DIFFICULTY-TARGETING-V2-008, EG-FIXED-CANDIDATE-PREVIEW-V2-008
- 자동 검증: 완전 풀이 hard gate, depth backbone, closest-valid fallback, fixed candidate seed와 전체 영향 회귀 통과
- 남은 확인: 독립 QA, fixed 후보 반복과 16x16 random 재진입 사용자 확인
- 다음: vello-game-qa-06

## 2026-08-03 / qa / passed

- 판정: EG-DIFFICULTY-TARGETING-V2-008 통과
- 확인: 완전 풀이·무교착, depth backbone, exact-first·closest-valid, 현재 16x16·25x25와 10초 random 흐름
- 남은 확인: fixed 후보 반복과 16x16 random 재진입 사용자 확인
- 다음: 사용자 확인

## 2026-08-03 / user_check / revision_requested

- 통과: random 재배치가 오류 없이 다른 배열을 생성함
- 수정: 보드 clip을 화면 폭·UI 제외 세로 영역으로 확대하고 pinch·mouse wheel zoom을 추가
- 확인: 로컬 STAGE-004 target_empty_ratio는 아직 0.4로 시트의 0.1이 sync되지 않음

## 2026-08-03 / design / approval_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 완료: 확장 play area, 0.25x~2.0x focus zoom, preview pan·zoom과 기존 tap·drag 호환
- 다음: 사용자 디자인 승인 또는 수정 요청

## 2026-08-03 / user_check / repair_requested

- 실패: STAGE-004 target_empty_ratio 0.1 동기화 후 고밀도 random 생성이 10초를 초과함
- 원인: 무작위 filler 배치가 90% 점유에서 빈 추출 통로를 반복 탐색함
- 다음: 기존 완전 풀이·10초 계약 안에서 고밀도 생성 경로 보완

## 2026-08-03 / implementation / repair_complete

- 보완: 가장자리 primary와 바깥쪽 순차 제거 filler로 90% 점유 고밀도 보드를 직접 구성
- 검증: 16x16·target 0.1 전체 풀이와 실제 빈칸 비율, random controller가 1초 미만 테스트 실행에서 통과
- 남은 확인: 실제 게임 재진입, 확장 play area·zoom 디자인 승인

## 2026-08-03 / user_check / repair_requested

- 실패: 고밀도 보드가 1셀 filler 위주로 표시되어 화살 형태와 밀도 인상이 부적절함
- 보완: 연속 셀은 filler_max_length 안의 2~3셀 화살로 묶고 끊어진 한 칸만 1셀로 유지
- 검증: 다중 셀 filler 우세, 90% 점유, 전체 풀이, 10초 예산과 필수 gameplay 회귀 통과

## 2026-08-03 / user_check / repair_requested

- 실패: 행 단위 고밀도 배치가 같은 길이·방향의 직선 화살을 반복해 기존 무작위 형태 다양성을 잃음
- 보완: 제거 가능한 셀에서 길이·방향·몸통 굴곡을 무작위로 구성하고 생성된 제거 순서를 해답으로 보존
- 검증: 길이 2종 이상, 방향 3종 이상, 꺾인 filler, 90% 점유, 전체 풀이와 필수 gameplay 회귀 통과

## 2026-08-03 / design / approved

- 대상: 02-design-handoff.md, sot-delta.yaml
- 승인: 확장 play area, focus 기반 pinch·mouse wheel zoom, preview pan·zoom
- 다음: vello-game-system-spec-03

## 2026-08-03 / implementation / delivery_complete

- 완료 그룹: EG-BOARD-VIEWPORT-ZOOM-V2-008
- 구현: 현재 UI 기준 화면 전체 폭·y=150..하단 90px 보드 영역, 0.25x..2.0 focus zoom, preview pan·zoom
- 검증: play_rect·pinch·wheel·tap 차단, 필수 gameplay 회귀와 main·preview 시작 통과
- 다음: 실제 화면 공간 활용과 확대축소 조작 사용자 확인

## 2026-08-03 / user_check / repair_complete

- 실패: 격자는 play_rect에서 잘렸지만 화살 선·연결부·화살촉은 경계 밖까지 표시됨
- 보완: 선 두께를 고려한 선분 절단과 원형 연결부·화살촉 polygon 교차 clipping 적용
- 검증: 경계 교차·완전 외부 geometry, 필수 gameplay 회귀와 preview 시작 통과

## 2026-08-03 / user_check / passed

- 통과: 확장 보드 영역, 확대축소, 화살 clipping과 STAGE-004 고밀도 랜덤 배치
- 남은 확인: fixed preview의 새 후보 seed·배열 변화

## 2026-08-03 / user_check / repair_complete

- 실패: preview 하단 metrics가 보드 높이를 줄이고 상단 toolbar 버튼 가시성을 낮춤
- 보완: metrics 기본 접힘·Show Metrics 토글, toolbar 버튼 폭 축소와 남은 영역 전체 preview 사용
- 검증: metrics 토글 회귀와 preview scene 시작 오류·경고 없음

## 2026-08-03 / user_check / passed

- 통과: fixed preview의 새 후보 seed·배열 재생성
- 판정: 구현 후 사용자 확인 항목 전체 완료
- 다음: vello-game-sprint-closeout-08

## 2026-08-03 / sprint_closeout / completed

- 완료: fixed·random 생성, 10초 생성 흐름, 풀이 보장·closest-valid, STAGE-004, fixed 후보 preview, 확장 보드·zoom·전체 clipping
- 반영: 검증·사용자 승인 SOT delta를 current-design과 entity ledger에 병합하고 대체된 초기안을 폐기
- 다음: 새 스프린트 범위 선택
