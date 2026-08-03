# Google Sheets 밸런스 운영

Google Sheets는 운영 원본이고 게임은 `data/stage_balance.json`만 읽습니다. 게임 실행 중에는 Google에 접속하지 않습니다.

## 1. Apps Script 설치

1. 새 Google Spreadsheet에서 `확장 프로그램 → Apps Script`를 엽니다.
2. `apps_script/Code.gs` 전체를 `Code.gs`에 붙여넣고 저장합니다.
3. 시트를 새로고침한 뒤 `Pickup Arrow → 최초 구성`을 실행합니다.

최초 구성은 `_meta`, `stage_profiles`, `metric_guide`와 초기 스테이지 4개를 만들고 검증된 첫 동기화 데이터를 게시합니다. `STAGE-001~003`은 `fixed`, `STAGE-004`는 `random`입니다.

## 2. 웹 앱 배포

Apps Script에서 `배포 → 새 배포 → 웹 앱`을 선택합니다.

- 실행 사용자: 나
- 액세스 권한: 모든 사용자(로그인 불필요)

배포 후 `/exec`로 끝나는 웹 앱 URL을 복사합니다. 이 URL은 검증된 런타임용 밸런스 JSON만 읽기 전용으로 반환합니다. URL을 아는 사람은 JSON을 읽을 수 있으므로 공개 문서에는 올리지 않습니다.

스크립트 코드를 바꾼 뒤에는 기존 배포를 새 버전으로 갱신해야 `/exec` URL에 반영됩니다.

## 3. 정상 운영

1. `stage_profiles` 값을 수정하거나 새 행을 추가합니다.
2. `Pickup Arrow → 데이터 검증`을 실행합니다.
3. 검증과 게시가 통과하면 로컬에서 다음을 실행합니다.

```bash
export PICKUP_ARROW_SHEETS_URL="https://script.google.com/macros/s/.../exec"
node tools/balance_sheet/cli.mjs sync
```

미리보기는 같은 환경 변수를 사용합니다.

```bash
/home/mantie/Applications/Godot/godot --path . balance_preview.tscn
```

`Sync from Sheets`를 누르면 웹 앱 JSON을 다시 검증한 뒤에만 로컬 snapshot을 교체합니다. 네트워크나 검증이 실패하면 마지막 정상 snapshot과 보드를 유지합니다.

## 구조 변경

표준 열을 직접 추가·삭제·이름 변경하지 않습니다. 이번 Code.gs로 교체하고 웹 앱을 새 버전으로 배포한 뒤 `Pickup Arrow → 구조 마이그레이션`을 실행합니다. schema v1은 기존 입력 검증을 제거한 뒤 `generation_mode` 열과 v2 입력 규칙을 적용하고, 기존 스테이지를 `fixed`, `STAGE-004`를 `random`으로 변경합니다. 중단된 마이그레이션으로 v2 헤더와 일부 값만 남은 경우에는 숨겨진 최신 완전 원본 백업에서 자동 복구합니다. 기존 `stage_profiles`, `metric_guide`와 v1 표준 범위 밖의 값은 숨겨진 백업 탭에 보존됩니다.

## 공개 범위

웹 응답에는 `schema_version`, `source_revision`, `content_hash`, `profiles`만 포함됩니다. 시트 URL·ID, `operator_note`, 자격 증명과 쓰기 기능은 포함되지 않습니다.
