# evidence — 증거 색인 (과제 8)

이 폴더의 `*.md` / `*.json` 은 `scripts/verify-webauthn.mjs` 가 실행 중인 서버를 상대로 자동 생성한다.
`*.png` 는 사람이 시크릿 창·Chrome DevTools·Upstash 콘솔에서 촬영해 넣는다.
어디에도 세션 원문·KV 토큰·개인키·user handle 원문을 남기지 않는다.

## 자동 생성 파일

| 파일 | 내용 | 통과 기준 |
|---|---|---|
| `webauthn-verify-results.json` | 전체 요약 (`summary.all_pass`) + 각 체크 상태코드 | C16·C17·C20·C28·C29·C30·C31·C33·C34·C36–C40·C42·C44·C45 |
| `challenge-log.json` | 등록 5 + 로그인 5 challenge 의 앞 16자·시각 (전부 상이) | C20, C28 |
| `서명검증_성공_실패.md` | 정상 서명 200 / 1바이트 변조 서명 401 | C29, C30 |
| `이미쓴질문_재사용.md` | challenge 첫 사용 200 / 재사용 400 | C31, C33 |
| `패스키_삭제_후.md` | 패스키 2개 → #1 삭제 → 남은 것 로그인 200 / 삭제된 것 400 / 마지막 삭제 409 | C42, C44, C45, C46 |
| `계정간_격리_요청응답.md` | 자리 A·B 양방향 404, 건수 3→3 불변, 스푸핑 쿼리 무시 | C36–C40 |
| `미로그인_차단_요청응답.md` | 쿠키 없이 401 / `/private` 307 / 로그아웃 뒤 재사용 401 | C16, C17, C18, C34 |

## 촬영해서 넣을 파일 (사용자)

| 파일명(예) | 무엇을 담나 | 연결 기준 |
|---|---|---|
| `T08-E01-public-incognito.png` | 시크릿 창에서 연 공개 소개 첫 화면 + "지어낸 내용" 고지 | C10, C11, C12 |
| `T08-E02-private-redirect.png` | 로그인 없이 `/private` → `/login`, 페이지 소스(Ctrl+U)에 항목 텍스트 없음 | C15, C18 |
| `T08-E03-register-prompt.png` | 실기기/구글 비밀번호 관리자의 패스키 생성 프롬프트 | C25, C26 |
| `T08-E04-passkey-list.png` | 비공개 영역의 패스키 목록 — 이름 + 등록 날짜 + 저장 위치 문구 (2개) | C24, C42, C43 |
| `T08-E05-private-items.png` | 로그인 후 내 비공개 항목 3건 | C13, C14 |
| `T08-A01-devtools-webauthn.png` | DevTools WebAuthn 탭의 가상 인증기 2개 + credential 목록 | C42, C44 |
| `T08-A02-network-register-verify.png` | Network 탭 `register/verify` 요청 본문 (attestationObject·clientDataJSON·transports, 개인키 없음) | C23 |
| `T08-A03-upstash-cred.png` | Upstash 데이터 브라우저의 `cred:*` 값 (COSE 공개키, 비밀번호 아님) | C21, C22 |
| `T08-A04-network-authenticate.png` | Network 탭 `authenticate/verify` — signature·authenticatorData | C29 |

## 재현

```bash
npm run dev                                   # 로컬 (인메모리 KV)
node scripts/verify-webauthn.mjs              # → 이 폴더의 md/json 갱신
# 배포본:
APP_URL=https://<프로덕션> WEBAUTHN_RP_ID=<도메인> node --env-file=.env.local scripts/verify-webauthn.mjs
```
