# to8 — 패스키로 잠근 소개 페이지 (과제 8)

과제 1의 소개 페이지 [`webtest`](https://github.com/stulss/webtest) 를 Next.js로 옮기고,
`/private` 비공개 영역을 **WebAuthn 패스키로만** 잠갔다. 비밀번호는 없다.
공개 소개(`/`)는 지금처럼 누구나 볼 수 있다.

## 무엇이 지나는 자리

| 흐름 | 화면 / API | 핵심 소스 |
|---|---|---|
| 패스키 등록 (첫 자리 생성) | `/login` → `POST /api/webauthn/register/{options,verify}` | `app/webauthn-client.ts` → `app/api/webauthn/register/*` → `lib/service/auth.ts` → `lib/repository/{challenge,user,credential}.ts` |
| 패스키 로그인 | `/login` → `POST /api/webauthn/authenticate/{options,verify}` | 위와 동형, `lib/session.ts` 로 세션 발급 |
| 로그아웃 | `POST /api/auth/logout` | `app/api/auth/logout/route.ts` → `lib/session.ts` → `lib/repository/session.ts` |
| 비공개 자료 조회 | `/private`, `GET /api/items` | `middleware.ts` → `app/private/page.tsx` → `lib/service/item.ts` → `lib/repository/item.ts` → `lib/dto/records.ts` |

## 로컬 실행

```bash
npm install
vercel env pull .env.local      # Vercel KV 자격증명 (KV_REST_API_*)
npm run dev                      # http://localhost:3000
```

`localhost` 는 WebAuthn secure-context 예외라 `WEBAUTHN_*` 없이도 동작한다
(`rpID="localhost"`, `origin="http://localhost:3000"` 기본값).

## 검증

```bash
npm run typecheck
npm test
node --env-file=.env.local scripts/verify-webauthn.mjs
```

두 "기기" 시나리오는 Chrome DevTools → WebAuthn 탭의 가상 인증기로 확인한다.
자세한 절차는 `docs/검증안내서.md`.

## 배포

Next.js 기본 빌드로 Vercel 에 배포. Storage 탭에서 **Vercel KV(Upstash Redis)** 통합을 추가하고,
`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` 을 프로덕션 도메인으로 설정한다. 순서는 `docs/05_배포.md`.

## 문서

- `docs/00_과제_요구사항_매핑.md` — 통과 기준 C01–C53 1:1 매핑
- `docs/01_기획.md` — 설계·KV 키 구조·흐름
- `docs/인증_구현_설명서.md` — 6항목 설명서 + 빠른 확인 4줄 + AI/나 3줄
- `docs/검증안내서.md` / `docs/트러블슈팅.md` / `docs/05_배포.md`
- `작업내역_체크리스트.md` — 진행 상황 SSOT
