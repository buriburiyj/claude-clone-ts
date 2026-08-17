# claude-clone-ts

TypeScript + Ink 기반 CLI 에이전트. OpenRouter 무료 모델 체인으로 동작한다.

## 명령
- 테스트: `npm test` (node:test, 39개)
- 타입체크: `npx tsc --noEmit`
- 개발 실행: `npm run dev` (dist가 낡으면 bin/cc.js가 src를 직접 실행)

## 규칙
- 기존 파일 수정은 반드시 `edit_file`. `write_file`은 새 파일 전용.
- 도구 추가 시 `src/tools/index.ts`의 export/import/배열 세 곳을 모두 갱신한다.
- 경로는 `resolveSafe`를 통과시킨다. 작업 디렉터리 밖은 차단된다.
