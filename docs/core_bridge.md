# 공용 코어와 JSON CLI

전체 진행 기준: [Arrow 스테이지 제작 도구 — 전체 단계별 진행 문서](stage_editor_roadmap.md). 총 6단계 중 이 문서는 1단계의 구현과 계약을 설명합니다.

## 적용 범위와 개발환경

Godot 4.7.1 + GDScript 게임을 유지하면서, 기존 게임과 외부 제작 도구가 같은 규칙을 호출하도록 최소 분리했습니다. 저장소 루트의 Godot 프로젝트와 기존 리소스 경로는 유지합니다. 별도 설치나 컴파일 단계는 없습니다.

현재 개발환경에서 확인한 버전은 Godot 4.7.1과 Node.js 22.22.1입니다. CLI 자체는 Godot만 필요하며, Node.js는 기존 Sheets 동기화와 이후 Electron 호스트에 사용합니다. 사용자별 Godot 절대 경로를 공용 데이터에 저장하지 않습니다.

## 현재 구조와 책임

| 구성 | 책임 |
|---|---|
| `PathRule` | 점유 좌표 색인, 머리 앞 직선 경로의 방해 화살표 조회, 제거 가능 판정 |
| `StageValidator` | 화면·생성 설정과 독립적인 런타임 보드 검증 |
| `BoardState` | 로딩, 선택, 제거 완료, 클리어 상태 전환 |
| `StageCatalog` | 기존 밸런스 snapshot 로딩, 스테이지 순서, 생성 호출, 호환용 종합 검증 |
| 기존 생성·분석 모듈 | 후보 구성, 공통 경로 판정을 사용한 풀이 순서·의존 관계, 생성 목표 및 형상 지표 |
| `StageJsonCodec` | JSON 좌표 배열과 Godot 런타임 데이터 사이의 변환 |
| `CoreRequest` / CLI | 요청 검사, 코어 호출, 결과 JSON과 종료 코드 |

게임은 `BoardState`와 `PathRule`을 직접 사용합니다. CLI도 같은 `BoardState`를 사용하며, 애니메이션을 기다리는 대신 허용된 선택 직후 제거 완료를 호출합니다.

`BoardState.load_stage_definition()`은 게임 규칙만 검사합니다. `StageCatalog.validate_stage()`는 호환용 API로서 게임 규칙 검사 후 기존 `generation_profile.shape_target`도 검사합니다. 생성 완료 시에는 이 종합 검사를 유지합니다. 생성 목표를 충족하지 못해도 규칙상 플레이 가능한 수동 맵을 구분할 수 있습니다.

`BoardState`의 기존 ID 로딩·다음 스테이지 진행은 여전히 `StageCatalog`를 사용합니다. 따라서 생성·분석 코드를 모바일 내보내기에서 완전히 제외하는 물리적 분리는 이번 단계의 결과가 아닙니다.

## 실행

저장소 루트에서 실행합니다. `godot`은 설치한 Godot 4.7.1 실행 파일을 가리켜야 합니다.

```bash
godot --version

godot --headless --log-file /tmp/pickup-arrow-validate.log --path . \
  --script res://scripts/bridge/cli_runner.gd -- \
  --input tests/fixtures/core_bridge/validate_request.json \
  --output /tmp/pickup-arrow-validation.json

godot --headless --log-file /tmp/pickup-arrow-action.log --path . \
  --script res://scripts/bridge/cli_runner.gd -- \
  --input tests/fixtures/core_bridge/action_request.json \
  --output /tmp/pickup-arrow-action.json
```

예제의 검증은 성공하고, 행동 예제는 B를 제거한 뒤 A만 남깁니다. 행동 예제의 `arrow_id`를 A로 바꾸면 B가 앞을 막아 `blocked`가 반환됩니다.

한 호출은 요청 파일 하나를 읽고 응답 파일 하나를 쓴 뒤 종료합니다. stdout에는 엔진 로그가 섞일 수 있으므로 JSON 응답은 파일에서 읽습니다. 출력의 부모 디렉터리는 호출자가 준비하며 출력 파일은 덮어씁니다. 입력과 같은 경로는 사용할 수 없습니다. 상대 경로는 실행 작업 디렉터리를 기준으로 해석하며 `res://`, `user://`도 지원합니다.

## 프로토콜 v1

첫 실제 앱 구현에서 `analyze_stage`를 추가했습니다. 입력은 기존 런타임 stage와 같고, 유효한 보드에 `analysis`를 반환합니다. `available_arrow_ids`, `blockers_by_arrow`, `dependents_by_arrow`, `solution_order`, `dependency_depth`, `solution_status`(`solved`/`unsolvable`), `path_scope=single_deterministic_path`를 포함합니다. 기존 `dependency_depth`는 노드 수 기준을 유지하며 UI의 연결 횟수는 유효한 비순환 관계에서 1을 뺀 값입니다. 입력 오류에는 분석을 붙이지 않으며 실행 오류·시간 초과는 해결 불가능으로 바꾸지 않습니다. 압박 빈도·커버리지·관문 목표의 검증 API는 아직 없습니다.

요청의 공통 필드는 다음과 같습니다.

```json
{
  "protocol_version": 1,
  "request_id": "example-001",
  "operation": "apply_action",
  "arrow_id": "A",
  "stage": {
    "id": "STAGE-CLI",
    "grid_size": [5, 5],
    "blocked_cells": [],
    "arrows": [
      {
        "id": "A",
        "head_cell": [2, 2],
        "cells": [[2, 2], [1, 2]],
        "direction": "RIGHT"
      }
    ]
  }
}
```

- `operation`: `validate_stage`, `analyze_stage`, `apply_action`, `translate_arrow`, `reshape_arrow`. `arrow_id`는 행동·이동·변형 요청에서 필수입니다.
- `stage_contract`: 생략하면 `runtime_v1`입니다. 기존 자료 호환을 위해 1칸 화살도 허용합니다. 편집기는 `authoring_v1`을 강제하며 같은 `StageValidator`에서 최소 2칸을 적용합니다. 그 외 연결·방향·겹침·금지 칸 규칙은 동일합니다.
- `request_id`, 스테이지 ID, 화살표 ID는 공백만으로 이루어지지 않은 문자열입니다. 프로토콜에서 ID 형식을 새로 강제하지 않습니다.
- 좌표는 1부터 시작하는 정수 쌍입니다. 격자 한 변은 최대 999, 전체 면적은 최대 10,000칸입니다.
- `cells`는 머리부터 몸통 끝까지 연결된 좌표입니다. 첫 좌표는 `head_cell`과 같고 두 번째 좌표는 머리 방향의 바로 뒤여야 합니다.
- 방향은 `UP`, `DOWN`, `LEFT`, `RIGHT`입니다.
- `blocked_cells`는 생략하면 빈 배열입니다. 배치를 금지하는 영역이며 탈출 경로의 벽이 아닙니다.
- 입력의 생성 설정·측정값 등 추가 필드는 런타임 변환에서 제외합니다. 이 API는 schema v3 생성 설정 JSON을 받는 API가 아닙니다.
- 시작 보드에는 화살표가 하나 이상 있어야 합니다. 반환된 클리어 보드의 빈 `arrows`는 종료 상태이며 새 시작 보드로 검증할 수 없습니다.

검증 결과:

```json
{
  "protocol_version": 1,
  "request_id": "example-001",
  "ok": true,
  "validation": {"valid": true, "errors": []}
}
```

`apply_action`은 검증 성공 시 `action`을 추가합니다.

| 필드 | 의미 |
|---|---|
| `event` | 최종 결과: `blocked`, `selection_invalid`, `extraction_completed`, `stage_cleared` |
| `selection_event` | 최초 선택 결과. 제거 허용 시 `extraction_requested` |
| `path_result` | 기존 `is_extractable`, `blocking_arrow_ids`, `error` |
| `state` | 기존 `BoardState.get_state()`의 JSON 표현 |
| `stage` | 행동 후 남은 화살표와 보드 정보 |

`state.phase`는 기존 enum 값입니다: `LOADING=0`, `READY=1`, `EXTRACTING=2`, `CLEARED=3`, `PROTOTYPE_COMPLETE=4`. 호출 사이에 상태를 보관하지 않으며 다음 행동에는 이전 결과의 `action.stage`를 전달합니다.

자기 몸도 방해물로 판정합니다. 없는 화살표 ID는 게임과 동일하게 `selection_invalid`로 처리하고 보드를 유지합니다. 유효하지 않은 보드는 `validation.valid=false`와 오류 목록을 반환하고 행동을 실행하지 않습니다.

## 오류와 종료 코드

### 제작용 전체 이동 확장

`translate_arrow`는 `arrow_id`와 `offset: [dx, dy]`를 받습니다. 각 이동량은 -999~999 정수입니다. 원본 검증 후 전체 화살을 한 칸씩 직각으로 옮기며 공통 검증기로 중간 배치를 검사합니다. 남은 거리가 큰 축 우선, 동률이면 가로 우선이며 장애물 우회 경로 탐색은 하지 않습니다. 입력을 수정하지 않고 응답의 `edit`에 `accepted`, `event`, `errors`, `stage`를 반환합니다. 이동 거절은 처리 성공(종료 0)이지만 `accepted=false`이고 원본 `stage`를 반환합니다. 형식 오류는 종료 2입니다. 이동 성공이 클리어 가능성을 보장하지는 않으며 새 분석은 별도로 실행합니다.

관련 회귀: `tests/test_editor_manipulation.gd`, `tool/tests/editor-core.test.mjs`. UI·기존 자료 처리 기준은 [직접 편집 기록](stage_editor_arrow_editing.md)에 설명합니다.

### 공통 오류 코드

`reshape_arrow`는 `arrow_id`와 머리부터 연결된 새 `cells` 배열(최대 10,000칸)을 받습니다. 원본을 복제한 뒤 대상의 머리·몸체·방향을 갱신하고 같은 `StageValidator`로 최종 배치를 검사합니다. 방향은 첫 두 칸에서 파생하며 별도 방향 입력은 받지 않습니다. `edit` 응답은 전체 이동과 같은 형식이며 거절 시 원본을 반환합니다. 회전 도중 원호나 풀이 가능성은 검사하지 않습니다. 관련 회귀는 `tests/test_arrow_reshape.gd`입니다.

| 종료 코드 | 의미 |
|---|---|
| `0` | 요청 처리 완료. 보드 검증 실패·막힘·없는 화살표 선택도 여기에 포함 |
| `2` | 잘못된 JSON·인자·요청 형식, 지원하지 않는 버전·작업 |
| `1` | 입력 읽기·출력 쓰기 오류 또는 내부 실행 오류 |

요청·파일 오류 응답에는 `ok=false`와 `error: {code, message}`가 포함됩니다. 보드 검증 실패는 `ok=true`, `validation.valid=false`입니다. 출력 경로가 없거나 쓸 수 없으면 JSON 파일을 보장할 수 없으므로 stderr와 종료 코드를 확인합니다. 읽거나 파싱할 수 없는 요청은 `request_id=""`로 반환합니다.

호출자는 요청별 임시 디렉터리와 로그를 사용하고, 자식 프로세스 종료를 확인한 뒤 결과를 읽어야 합니다. 이후 Electron 호스트에서 `spawn` 인자 배열, 시간 제한·취소·임시 파일 정리를 담당합니다. 현재 CLI에는 생성·Solver·난이도 분석 작업이 없습니다.

## 검증

외부 테스트 프레임워크 없이 실행합니다.

```bash
godot --headless --log-file /tmp/pickup-arrow-validator.log --path . --script tests/test_stage_validator.gd
godot --headless --log-file /tmp/pickup-arrow-bridge.log --path . --script tests/test_core_bridge.gd
godot --headless --log-file /tmp/pickup-arrow-cli.log --path . --script tests/test_core_cli.gd
```

검증 대상은 잘못된 런타임 데이터, 생성 목표와 규칙의 분리, JSON 왕복 변환, 자기 몸·상호 막힘·복수 방해물, 실제 상태 전환과 클리어, 기존 생성 맵 풀이 재생, 실제 CLI 프로세스 결과, 한글·공백 경로, 잘못된 JSON·인자·파일 접근입니다.

기존 필수 4개와 보드·의존 관계·생성·미리보기 회귀 테스트도 실행합니다. `STAGE-010`의 대형 생성 테스트는 변경 전부터 약 41초와 의존 관계 목표 미달로 실패했습니다. 이 문제는 CLI나 검증 분리와 별개의 생성 알고리즘 과제이며 기준을 완화하지 않습니다.

동일 환경에서 `test_large_stage_generation.gd`를 변경 전후 각각 실행한 결과입니다. 각 시간은 같은 seed로 두 번 생성한 값이며, 네 스테이지 모두 화살표 수와 출력된 구조·형상 지표가 유지되었습니다.

| 스테이지 | 변경 전 | 변경 후 | 기준 결과 |
|---|---|---|---|
| STAGE-007 | 101 / 98ms | 100 / 99ms | 통과 |
| STAGE-008 | 132 / 131ms | 130 / 129ms | 통과 |
| STAGE-009 | 197 / 189ms | 197 / 197ms | 통과 |
| STAGE-010 | 40952 / 40977ms | 41013 / 40899ms | 변경 전후 모두 시간·의존 관계 목표 실패 |

이번 구현의 Ubuntu/Linux 검증 결과는 Godot 16개 스위트 중 14개 통과, 기존 Sheets Node.js 테스트 3개 통과입니다. 필수 4개와 신규 3개 스위트는 모두 통과했습니다. Windows/macOS 실기 검증은 이후 플랫폼 단계에서 수행합니다.

실패한 기존 스위트는 다음 두 개입니다.

- `test_large_stage_generation.gd`: 위 STAGE-010의 10초 제한과 의존 관계 목표 실패.
- `test_dependency_targeting_large_board.gd`: 12×12와 15×15 사례가 첫 후보·기본 seed를 기대하지만, 실제로 두 번째 후보와 seed 1120015 / 1150018을 선택합니다. 관련 생성·분석·경로 모듈을 변경 전 상태로 복원한 임시 프로젝트에서도 동일한 결과를 확인했습니다.

두 기존 실패의 기준이나 생성 설정을 이번 변경에 맞춰 수정하지 않았습니다.

## 다음 이행 단계

단계별 범위와 완료 조건은 [전체 진행 문서](stage_editor_roadmap.md)를 기준으로 관리합니다.

handoff의 `game/` 재배치는 적용하지 않았습니다. 완성 맵 저장소가 이미 존재한다는 가정도 적용하지 않았습니다. 현재 `data/stage_balance.json`은 Google Sheets에서 받은 schema v3 생성 설정이며, 고정 모드도 완성 맵 로딩이 아닌 seed 기반 생성입니다.

다음 작업은 도구의 최소 제작 흐름을 확정하는 것입니다. 생성 설정과 완성 맵을 구분하고, 열기 → 생성/수정 → 검증 → 저장 → 게임 반영의 첫 범위를 정한 뒤 Electron 개발환경을 도입합니다. 기존 GDScript 생성기와 분석기를 재사용하고 TypeScript에 두 번째 판정 엔진을 만들지 않습니다.

운영 원본은 로컬 제작으로 단계적으로 전환합니다. 새 저장·게임 로딩 흐름을 검증하기 전까지 Sheets 동기화와 Godot 미리보기를 유지합니다. Electron은 main에서 Godot를 실행하고 preload에 제한된 IPC를 두며 renderer에 Node 권한을 직접 제공하지 않습니다.

Solver를 외부에 노출할 때는 `solved`, `unsolvable`, `unknown`을 구분합니다. 현재는 화살표 제거가 장애물만 줄이는 규칙이므로 의존 관계 기반 반복 제거가 충분하지만, 새 기믹이 생기면 이 전제를 다시 검토합니다. 기존 선택지·강제 선택 비율은 한 결정적 풀이 경로에서 관측한 지표이며 전체 풀이 공간이나 체감 난이도 점수로 해석하지 않습니다.
