# CLAUDE.md — 과제 8 (패스키로 잠근 소개 페이지)

## 읽는 순서

1. 워크스페이스 헌법 `../law.md`
2. 이 파일
3. `작업내역_체크리스트.md` (진행 상황·결정·다음 할 일의 단일 진실 공급원)
4. 계획서 `~/.claude/plans/8-fluttering-chipmunk.md` 또는 `docs/01_기획.md`
5. 지금 하는 작업과 직접 관련된 파일 1~2개만

## 토큰 절약

- 폴더 전체 훑기 금지. 진행 상황은 `작업내역_체크리스트.md` 한 파일로 확인한다.
- `node_modules/`, `.next/`, `.git/`은 읽지 않는다.

## 이 프로젝트가 하는 일

`webtest`(과제 1의 소개 페이지)를 Next.js로 옮기고, `/private` 비공개 영역을 **패스키(WebAuthn)로만**
잠근다. 비밀번호는 없다. 공개 소개(`/`)는 그대로 누구나 본다.

- 스택: Next.js 16 App Router + `@simplewebauthn` v13 + Redis (Vercel Marketplace)
- 저장소: 관계형 DB 아님. `lib/kv.ts` → `@vercel/kv`. 키 구조는 `docs/01_기획.md` 참조.

## 과제 8 불변 규칙

1. 로그인 수단은 **패스키 하나**. 비밀번호 입력칸을 어디에도 두지 않는다 (C35).
2. 사용자(자리) ID는 **세션 쿠키에서만** 얻는다. URL·헤더·요청 본문에서 읽지 않는다.
3. challenge는 **서버가 만들어 KV에 저장**하고, 검증은 항상 저장값(`expectedChallenge`)으로 한다.
   소비는 `kv.getdel`(원자적 1회). TTL 5분.
4. 개인키·세션 원문·user handle을 코드·문서·로그·스크린샷에 남기지 않는다.
5. 비공개 항목 단건은 `item.spaceId === 세션 spaceId` 확인 후에만 접근·삭제한다. 아니면 404.
6. 응답은 `lib/dto/` 화이트리스트를 거친다. KV 원본 객체를 그대로 반환하지 않는다.
7. `NEXT_PUBLIC_*` 금지. `REDIS_URL`·`WEBAUTHN_*`는 서버 전용.
8. 회원가입 없음: 패스키를 처음 등록하면 그 사람 몫의 "비공개 자리"가 생긴다. 등록 입력은
   패스키 이름 1칸뿐(비밀 아님).
9. 소개 페이지 콘텐츠는 **가공(fabricated)** 이며 화면에 그 사실을 고지한다. 실명 외 실제 개인정보 0.
10. 마지막 패스키는 삭제할 수 없다(409). 자리 정리는 "비공개 자리 삭제"로만.

## 작업 종료 조건

코드 변경 후 `작업내역_체크리스트.md`의 작업 로그·진행 체크리스트를 갱신해야 그 작업이 끝난 것이다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
