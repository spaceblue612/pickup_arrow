# 01. 시스템 아키텍처

## 1. 시스템 경계와 책임

```text
단일 Git 저장소: arrow-game/ (예시)

┌────────────────────────────────────────────┐
│ tool/ — Electron 데스크톱 제작 도구          │
│ React + TypeScript: 편집 UI, 옵션, 결과 표시 │
│ Electron main / Node.js: 파일, 맵 생성, 실행 │
│ preload / IPC: 안전한 UI→OS 기능 연결       │
└──────────────────┬─────────────────────────┘
                   │ JSON 파일 + 프로세스 호출
                   ▼
┌────────────────────────────────────────────┐
│ game/ — Godot 프로젝트                     │
│ core/bridge: 외부 요청 처리                │
│ core/runtime: 규칙 및 상태 처리            │
│ core/analysis: Solver, 난이도 분석         │
│ scenes/, ui/, assets/: 실제 모바일 게임     │
└────────────────────────────────────────────┘

게임 UI는 같은 core/runtime을 직접 사용한다.
제작 도구는 core/runtime을 복사/재구현하지 않는다.
```

### 주요 역할

| 구성 | 소유하는 책임 | 소유하지 않는 책임 |
|---|---|---|
| Tool UI (`React`) | 편집 화면, 캔버스/패널, 옵션, 진행 상태, 분석 결과 | 게임 충돌/제거 규칙 |
| Tool Host (`Electron main` + Node.js) | 파일 저장/열기, 맵 후보 생성, Godot 프로세스 호출, OS 경로/설정 | 게임 규칙의 최종 판정 |
| Core Runtime (`GDScript`) | 격자 상태, 이동 경로 판정, 충돌/제거, 규칙에 따른 상태 전이 | 화면, 애니메이션, 도구 패널 |
| Core Analysis (`GDScript`) | 스테이지 유효성, 클리어 탐색, 난이도 측정 | 화면 렌더링 |
| Core Bridge (`GDScript`) | JSON 입력 파싱, 분석/규칙 함수 호출, JSON 결과 직렬화 | 규칙의 별도 복제 |
| Game UI (`Godot`) | 터치/입력, 스프라이트, 화면, 애니메이션, 사운드 | 중복된 판정 로직 |

## 2. 제안하는 물리적 디렉터리

**실제 저장소 점검 후 최소 이동으로 조정할 초안**이다.

```text
arrow-game/
├── game/                      # Godot 루트 (project.godot)
│   ├── project.godot
│   ├── core/
│   │   ├── runtime/
│   │   │   ├── path_rule.gd    # 기존 파일 이관 또는 현재 경로 유지
│   │   │   └── board_state.gd  # 기존 파일 이관 또는 현재 경로 유지
│   │   ├── analysis/
│   │   │   ├── stage_validator.gd
│   │   │   ├── stage_solver.gd
│   │   │   └── difficulty_evaluator.gd
│   │   └── bridge/
│   │       └── cli_runner.gd
│   ├── scenes/
│   ├── ui/
│   ├── assets/
│   └── stages/                # 게임이 직접 읽는 정식 스테이지 데이터
├── tool/
│   ├── src/
│   │   ├── main/              # Electron main, Node 작업, Godot 호출
│   │   ├── preload/           # 명시적인 IPC API 노출
│   │   └── renderer/          # React UI
│   └── package.json
├── scripts/                  # 테스트/실행 도우미(필요 시)
└── docs/                     # 아키텍처·계약·운영 문서
```

- `game/`에 실제 `project.godot`가 없을 수도 있다. **최초에는 디렉터리 재배치 자체가 목적이 아니다.** 파일 이동은 필요성이 입증되면 실시한다.
- `res://`는 Godot 프로젝트 루트를 가리키므로 공용 GDScript를 그 안에서 관리하면 참조가 수월하다.
- `stages/`는 우선 게임 프로젝트 내부를 **정본**으로 가정한다. 이미 다른 데이터 경로가 있다면 기존 경로를 우선한다. 같은 데이터를 도구 폴더에 별도 복제하지 않는다.

## 3. 제작 도구 → 게임 코어 호출

초기 프로토콜: **JSON 요청 파일 → Godot headless 프로세스 → JSON 응답 파일**.

```text
[제작 도구: 분석 실행]
  → main 프로세스에서 작업용 임시 폴더 생성
  → request.json 쓰기
  → Godot 실행 파일을 인자 배열로 실행 (shell 문자열 명령 지양)
  → GDScript bridge가 request.json 파싱
  → 기존 runtime/analysis 기능 호출
  → response.json 쓰기 + 종료 코드 반환
  → Electron main이 결과/오류 판정
  → preload IPC를 통해 React UI에 전달
```

호출 형태 예시(개념; 실제 Godot 버전/인자 처리 확인 후 구현):

```bash
godot --headless --path ./game --script res://core/bridge/cli_runner.gd -- --input /tmp/request.json --output /tmp/response.json
```

- `cli_runner.gd`는 Godot 버전에 맞는 커맨드라인 스크립트 진입점을 사용한다(`SceneTree`/`MainLoop` 방식 확인).
- `stdout`에 엔진 로그가 섞일 수 있으므로 초기에는 출력 JSON을 **독립 파일**에 기록한다. 오류는 종료 코드, 오류 JSON, 로그를 함께 관리한다.
- 요청 식별자와 임시 파일을 분리하고 프로세스 종료/시간 제한/취소/정리 정책을 둔다.
- **호출은 Electron renderer가 아니라 main에서 수행**한다. `preload`에 최소한의 명시적 IPC만 노출한다. Node 전체 API를 렌더러에 개방하지 않는다.
- 호출 빈도가 많아질 때만 상시 실행 코어 프로세스/배치 처리를 검토한다. **처음부터 IPC 서버나 HTTP API를 만들지 않는다.**

## 4. 규칙 공유 방식

```text
Godot 게임 화면 ──직접 호출──▶ core/runtime
Electron 제작 도구 ──JSON→core/bridge──▶ core/runtime + core/analysis
```

- 게임 플레이에 필요한 핵심 규칙은 `core/runtime`에 모은다.
- 무거운 `core/analysis`는 제작 도구의 오프라인 평가 기능이다. 모바일 내보내기 때 포함 여부/의존성을 점검해 불필요한 코드를 제외할 방법을 검토한다.
- 기존 코드가 씬/전역 상태에 결합돼 있다면 입력과 출력만 분리하는 **최소 어댑터**부터 시도한다. 대규모 재작성 금지.

## 5. 플랫폼·개발환경 원칙

지원 대상: **Windows, Ubuntu(Linux), macOS**. 기본 UI/내부 로직 코드는 공용으로 유지한다.

- Electron 자체는 세 플랫폼에서 사용 가능하다. 실제 설치 패키지(예: Windows 설치 파일, Ubuntu `.deb`, macOS `.dmg`)는 각 OS 특성에 맞게 별도로 제작·검증한다.
- OS마다 Godot 실행 파일 경로가 다르므로 **앱 로컬 설정**으로 관리한다. 필요하면 프로젝트 경로도 로컬 설정으로 둔다.
- 공용 JSON과 Git 추적 파일에는 사용자별 절대 경로를 저장하지 않는다.
- 경로 결합은 Node `path` 등을 사용하고, 명령 실행은 `spawn` 계열에 인자 배열을 전달하여 공백·인코딩·OS 차이를 처리한다.
- macOS의 아키텍처 및 코드 서명/공증, Linux 배포판 차이, Windows 패키징은 **최종 배포 단계**에서 점검한다. 초기 작업의 선행조건이 아니다.
- 개발 초기에는 개발 머신에 설치된 Godot 실행 파일을 활용한다. Godot 실행 파일을 Electron 배포본에 동봉할지는 추후 결정한다.

## 6. 결정/비결정 사항

**확정:** Monorepo, 게임=Godot, 코어=GDScript 단일 원본, 도구=Electron+React+TypeScript+Node.js, 데스크톱 3개 OS, 별도 서버 없음, JSON 교환, 단계적 구축.

**미확정:** 실제 파일 경로, 스테이지 데이터 스키마, 난이도 점수식, 맵 생성 세부 알고리즘, 도구 화면 레이아웃, 배포 자동화, Godot 프로세스 상주 여부.
