## 2026-08-02 / brainstorm / approval_requested

- 대상: 01-brainstorm-handoff.md
- 완료: 요구사항 4~6을 Google Sheets 원본, 검증된 로컬 동기화, 스테이지 미리보기 범위로 확정
- 제외: 수동 CSV 운영, 런타임 직접 시트 접속, 전용 편집 UI, 고정·랜덤 맵 정책
- 다음: 사용자 브레인스토밍 승인 또는 수정 요청

## 2026-08-02 / brainstorm / approved

- 대상: 01-brainstorm-handoff.md
- 승인: Google Sheets 원본, 검증된 로컬 동기화, 스테이지 미리보기 범위
- 다음: vello-game-design-02

## 2026-08-02 / design / approval_requested

- 대상: 02-design-handoff.md
- 완료: 첫 메트릭군, Sheets 스키마, 원자적 동기화, 읽기 전용 미리보기 계약
- 다음: 사용자 디자인 승인 또는 수정 요청

## 2026-08-03 / design / revision_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 조정: Google Sheets의 _meta·stage_profiles·metric_guide 물리 구조, 18개 고정 헤더, 행·분석 탭 규칙과 기존 STAGE-001 예시 추가
- 다음: 수정된 디자인 사용자 승인 또는 추가 수정

## 2026-08-03 / design / revision_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 조정: A 방식 확정, stage_order 기반 신규 스테이지 등록, Setup·Migrate 쓰기 권한과 정상 Sync 읽기 권한 분리, 재빌드 배포 계약 추가
- 다음: 수정된 디자인 사용자 승인 또는 추가 수정

## 2026-08-03 / design / approved

- 대상: 02-design-handoff.md
- 승인: 19개 시트 열, 신규 스테이지 등록, Setup·Migrate·Sync 권한 수명주기와 재빌드 배포 범위
- 다음: vello-game-system-spec-03

## 2026-08-03 / implementation / delivery_complete

- 완료 그룹: EG-BALANCE-SCHEMA-CORE-007, EG-GOOGLE-SHEETS-CLI-007, EG-DYNAMIC-STAGE-CATALOG-007, EG-STAGE-BALANCE-PREVIEW-007
- 자동 검증: Node schema·Sheets fixture, 전체 Godot 회귀, main·preview 시작, credential·backup 제외 통과
- 남은 확인: 독립 QA, 실제 Google Sheets 권한 전환·Sync & Preview, 미리보기 운영 적합성
- 다음: vello-game-qa-06

## 2026-08-03 / qa / passed

- 판정: 네 independent_qa execution group 모두 통과
- 보완 확인: 전체 metric_guide 분류, content-hash revision, hard protected ranges, 실패 snapshot 재로드의 마지막 정상 캐시 보존
- 남은 확인: USER-SHEETS-AUTHORING-WORKFLOW-007, USER-BALANCE-PREVIEW-USABILITY-007
- 다음: 실제 Google Sheets와 preview 사용자 확인

## 2026-08-03 / design / revision_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 조정: 서비스 계정·Cloud Console 의존을 폐기하고 시트 바인드 Apps Script와 로컬 스냅샷 동기화 방식으로 회수
- 결정 필요: Apps Script JSON 웹 엔드포인트 접근 방식
- 다음: 사용자 선택 후 수정 디자인 승인 요청

## 2026-08-03 / design / approval_requested

- 대상: 02-design-handoff.md, sot-delta.yaml
- 확정안: 배포자 권한·익명 읽기 Apps Script JSON과 로컬 재검증·스냅샷 교체
- 제거: 서비스 계정, JSON 키, Google Cloud Console 의존
- 다음: 수정 디자인 사용자 승인 또는 수정 요청

## 2026-08-03 / design / approved

- 대상: 02-design-handoff.md
- 승인: 익명 읽기 Apps Script JSON, 로컬 재검증·스냅샷 교체, 런타임 오프라인 유지
- 다음: 수정 시스템 명세와 구현

## 2026-08-03 / implementation / delivery_complete

- 완료 그룹: EG-APPS-SCRIPT-SHEET-007, EG-APPS-SCRIPT-LOCAL-SYNC-007
- 교체: 서비스 계정 Sheets REST를 익명 Apps Script 게시와 로컬 HTTP 재검증으로 변경
- 자동 검증: Apps Script fixture, sync 실패 원자성, 전체 영향 Godot 회귀와 장면 시작 통과
- 다음: 두 교체 그룹 독립 QA

## 2026-08-03 / qa / passed

- 판정: EG-APPS-SCRIPT-SHEET-007, EG-APPS-SCRIPT-LOCAL-SYNC-007 통과
- 확인: 게시 snapshot 동등성·복구, 익명 응답 최소화, 로컬 원자성, preview·StageCatalog 유지
- 남은 확인: 실제 Apps Script 교체·배포·Sync & Preview

## 2026-08-03 / user_check / accepted

- 확인: Apps Script 익명 웹 앱에서 3개 스테이지 동기화, 로컬 snapshot 갱신, preview 표시 정상
- 판정: USER-APPS-SCRIPT-SYNC-WORKFLOW-007, USER-BALANCE-PREVIEW-USABILITY-007 통과
- 다음: balance-authoring-007 closeout 준비

## 2026-08-03 / closeout / completed

- 완료: 6개 SOT delta 적용, 서비스 계정 기반 2개 delta 폐기
- 갱신: current-design, project state, sprint index, entity ledger
- 판정: balance-authoring-007 completed
- 이관: 고급 밸런스 지표, 시트 writeback, 전용 편집기, 고정·랜덤 맵과 시트 맵 콘텐츠
