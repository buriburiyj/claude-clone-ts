# claude-clone-ts

Claude Code 스타일의 터미널 코딩 에이전트. OpenRouter 무료 모델 위에서 동작하며,
툴 호출 루프 · 승인 흐름 · 세션 복원 · MCP 연동을 TypeScript + Ink로 직접 구현했습니다.

```
> wrappedTools가 어디서 어떻게 쓰이는지 설명해줘
⏺ grep(wrappedTools)
  ⎿  Found 11 matches
⏺ Read(src/cli.tsx:1-100)
  ⎿  Read 100 lines
⏺ Read(src/tools/wrap.ts)
  ⎿  Read 75 lines
⏺
  wrappedTools는 도구 실행을 감싸서 이벤트를 발행하는 래퍼입니다.
  ...
```

## 기능

**에이전트 루프** — 툴 호출을 스트리밍으로 받아 실행하고 결과를 되먹입니다.
`stepCountIs(20)`으로 무한 루프를 막고, 모델이 불안정하면 3회 재시도 후 다음 모델로 폴백합니다.

**승인 흐름** — 파일 쓰기나 셸 실행 전에 승인을 묻습니다. 한 턴에 여러 툴이 호출되면
큐로 하나씩 처리해서, 하나를 승인했다고 나머지가 묻지 않고 통과하는 일이 없습니다.
`edit_file` / `write_file`은 변경 전후 diff를 먼저 보여줍니다.

**세션** — 대화 상태를 JSON으로 저장하고 `/resume`으로 복원합니다.
`/compact`는 지금까지의 대화를 요약해 새 세션으로 넘깁니다.

**MCP** — stdio 기반 MCP 서버에 붙어 툴을 가져옵니다. JSON Schema는 zod로 변환해
내장 툴과 동일하게 취급합니다.

**플랜 모드** — 쓰기 계열 툴을 차단해서 읽기만 하는 탐색 모드로 전환합니다.

## 슬래시 커맨드

| 명령 | 설명 |
|------|------|
| `/help` | 사용 가능한 명령 목록 |
| `/clear` | 화면과 대화 기록 초기화 |
| `/theme` | 색 테마 전환 |
| `/sessions` | 이전 세션 목록 |
| `/resume <id>` | 세션 복원 (prefix 매칭) |
| `/cost` | 토큰 사용량과 비용 |
| `/context` | 컨텍스트 윈도우 사용량 |
| `/compact` | 대화 요약 후 압축 |
| `/exit` | 종료 |

`!` 프리픽스로 셸을 직접 실행합니다 (`!git status`). 승인 없이 바로 돌아가고
모델 컨텍스트에도 들어가지 않습니다.

`ctrl+o`로 접힌 툴 출력을 펼치고, `esc`로 생성을 중단하며, `ctrl+c` 두 번으로 종료합니다.

## 실행

```bash
npm install
export OPENROUTER_API_KEY=sk-or-...
npm run dev
```

기본 모델은 `nvidia/nemotron-3-ultra-550b-a55b:free`이며, 실패 시
`nemotron-3-super-120b` → `gpt-oss-20b` 순으로 폴백합니다. `src/llm/client.ts`에서 바꿀 수 있습니다.

## 토큰 최적화

무료 모델의 컨텍스트가 넉넉하지 않아 실제로 측정하며 줄였습니다.

**중복 MCP 툴 제거** — filesystem MCP의 14개 툴 중 내장 툴과 겹치는 9개를 걷어내고,
`grep` / `glob`을 네이티브로 구현했습니다. 툴 정의 2,679 → 1,682 토큰.

**부분 읽기** — `read_file`에 `offset` / `limit`을 추가하고 기본 상한을 200줄로 두었습니다.
시스템 프롬프트에서 "grep으로 위치를 찾은 뒤 그 구간만 읽어라"를 유도합니다.
같은 질문에 501줄 → 175줄로 줄었고, 답변 품질은 오히려 올라갔습니다.

**출력 접기** — 긴 셸 출력을 앞 50줄 + 뒤 20줄만 남기고 접습니다.
앞부분만 자르면 에러 메시지가 사라지는 문제가 있어 양쪽을 남깁니다.

## 구조

```
src/
  cli.tsx          REPL, 에이전트 루프, 슬래시 커맨드
  llm/client.ts    OpenRouter 클라이언트, 모델 목록
  mcp/client.ts    MCP stdio 클라이언트
  tools/           fs, edit, shell, search(grep/glob), skill, wrap
  session/         상태 직렬화, 세션 저장소
  prompt/system.ts 시스템 프롬프트
  permissions/     플랜 모드
  ui/              Ink 컴포넌트 (승인, diff, 마크다운, 테마)
```

## 알려진 한계

- 병렬 툴 호출 시 `⏺` 호출 줄과 `⎿` 결과 줄의 짝이 시각적으로 어긋납니다.
- `ctrl+o`는 개별 블록이 아니라 전체 출력을 한꺼번에 토글합니다.
- 테스트가 없습니다.

## 라이선스

ISC
