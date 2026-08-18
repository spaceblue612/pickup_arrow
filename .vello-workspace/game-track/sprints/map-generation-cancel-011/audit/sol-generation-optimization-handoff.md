# Sol 인계: 대형 스테이지 생성 성능 개선

## 목표

`fixed`와 `random` 모두 큰 보드에서 10초 이내에 유효한 화살 배치를 생성한다.

다음 난이도·밸런스 조건은 유지한다.

- `grid_size`, `target_empty_ratio`, 기본 화살 수와 길이 범위
- `filler_max_length`
- `dependency_target`의 깊이와 초기 제거 가능 비율
- 완전한 해결 순서, 무교착, 비중첩, 현재 스키마와 seed 결정성
- 후보 선택 정책: 목표 충족 후보 우선, 미충족 시 closest-valid 후보

단순히 `max_candidate_attempts`, 빈칸 비율, 화살 길이 또는 난이도 목표를 낮춰 시간을 맞추는 변경은 허용하지 않는다.

## 현재 구조

- `scripts/stage_catalog.gd`: profile에서 스테이지 정의를 조립한다.
- `scripts/dependency_targeting.gd`: 최대 `max_candidate_attempts`개의 seed 후보를 생성·분석·점수화한다.
- `scripts/arrow_placement.gd`: 배치와 해결 순서를 생성한다.
- `scripts/dependency_analyzer.gd`: 의존성 및 난이도 지표를 측정한다.
- `scripts/map_generation_controller.gd`: worker thread에서 비동기 생성한다.

`fixed`는 화살 배열을 저장하는 방식이 아니다. profile seed로 동일 결과를 재생성하며, 현재 프로세스 안에서만 생성 결과를 캐시한다.

## 문제 프로필

`data/stage_balance.json`의 `STAGE-007`:

```text
grid_size: 36x36
generation_mode: fixed
primary_arrow_count: 5
min_length/max_length: 5/14
target_empty_ratio: 0.40
filler_max_length: 3
dependency_depth: 4..8
initial_extractable_ratio: 0.00..0.40
max_candidate_attempts: 64
```

빈칸 40%는 1,296칸 중 778칸을 채운다. 이 프로필은 `ArrowPlacement.generate()`에서 `filler_heavy` 경로를 사용한다. 고밀도 전용 경로는 현재 80% 이상 점유에서만 사용된다.

## 측정 결과

| 케이스 | 결과 |
|---|---|
| STAGE-007, 후보 1개 | 약 5.00초 후 `Could not generate a completely solvable board` |
| STAGE-007, 25초 관찰 | 후보 약 `6 / 64` 진행 |
| STAGE-008, 36x36·빈칸 10%, 후보 1개 | 약 0.97초에 성공 |
| STAGE-009, 50x50·빈칸 40%, 후보 1개 | 약 11.38초 후 실패 |

따라서 보드 변 길이만의 문제는 아니다. 중간 점유율의 무작위 역순 안전 배치가 빈번히 막히고, 후보마다 많은 배치 재시도를 수행하는 것이 병목이다.

## 확인한 비효율

`scripts/arrow_placement.gd`:

- `MAX_BOARD_ATTEMPTS = 240`이며, `filler_heavy`인 경우 역순 안전 배치와 일반 배치를 각각 시도할 수 있다.
- `_place_arrow()`가 점유된 칸을 무작위로 고르고 실패를 반복한다.
- 높은 점유율이 아닌 중간 점유율에서 남은 빈 공간이 조각나면 filler 배치 실패율이 급증한다.

`scripts/dependency_targeting.gd`:

- 실패한 후보를 최대 64개까지 다시 생성한다.
- 현재 고밀도 배치 경로는 `preferred_dependency_depth`를 직접 구성에 사용하지 않아, 목표 깊이를 구조적으로 보장하지 않는다.

`scripts/dependency_analyzer.gd`:

- 후보가 생성된 뒤 전체 그래프와 제거 시뮬레이션을 재계산한다.
- 이 부분도 대형 보드에서는 최적화 대상이지만, STAGE-007의 첫 병목은 배치 실패 재시도다.

## 이미 시도한 실험

실험 워크트리:

```text
/tmp/pickup-arrow-generation-benchmark
baseline commit: e1fe54b (생성 성능 비교 기준 저장)
baseline branch: generation-benchmark-base
experiment branch: generation-benchmark-optimization
```

메인 작업본은 실험으로 변경하지 않았다.

1. dense peel에서 몸통 생성 뒤 탈출 방향을 검증하도록 변경
   - STAGE-007은 dense 경로가 아니라 filler-heavy 경로를 사용하므로 효과 없음
   - 후보 1개 약 5.06초 후 실패

2. 후보당 `MAX_BOARD_ATTEMPTS`를 240에서 16으로 축소하고 후보 64개는 유지
   - 약 21.38초 후 유효 맵을 찾지 못함
   - 단순 예산 축소는 허용 가능한 해결책이 아님

## 기대하는 개선 방향

난이도 수치와 판정 규칙을 유지하면서 다음을 우선 검토한다.

1. 해결 순서와 의존성 목표를 먼저 구성하는 constructive generator.
   - 현재처럼 완성된 보드가 우연히 목표를 만족할 때까지 무작위 재시도하지 않는다.
   - `dependency_depth`, `initial_extractable_ratio` 목표를 구성 단계에서 만족시킨다.

2. filler 배치의 잔여 공간 단편화 방지.
   - 역순 제거 가능한 arrow path를 보장하며 목표 점유 칸 수를 정확히 채운다.
   - filler 길이 범위와 primary 길이 범위를 유지한다.

3. 구성으로 이미 증명된 해결 순서와 의존 그래프를 재활용한다.
   - 결과 지표는 현행 `DependencyAnalyzer`와 동등해야 한다.
   - 최적화 전후 지표 동등성 또는 허용 범위를 테스트로 증명한다.

## 완료 기준

- STAGE-007, STAGE-008, STAGE-009, STAGE-010을 같은 profile/seed 정책으로 각각 10초 이내 생성한다.
- 생성 결과는 `StageCatalog.validate_stage()`를 통과한다.
- 난이도 목표 충족 여부와 observed metrics를 기존 계약대로 제공한다.
- 동일 입력은 동일 출력이어야 한다.
- 10초를 넘길 수 있는 경우에는 기존처럼 무한 대기하지 않고, 구성 단계의 실제 진행률과 취소를 유지한다.
- 기존 회귀 테스트와 새 대형 보드 성능·난이도 회귀 테스트를 통과한다.
