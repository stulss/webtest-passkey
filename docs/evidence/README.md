# evidence — 증거 색인 (과제 8)

> **비공개 항목은 전부 지어낸 내용이다.** `T08-A05-DB저장내용.png` 와 `T08-E05-private-items.png` 에
> 보이는 항목(차량·기기 등)은 실제 소유물이나 개인정보가 아니라 과제용으로 만들어 넣은 것이다.
> 화면에도 같은 고지가 있다 — 공개 페이지 하단 안내문, 비공개 항목 패널의 설명줄. (C12)

이 폴더는 두 스크립트가 자동으로 채운다. 어디에도 세션 원문·접속 문자열·개인키·user handle 원문을 남기지 않는다.

```bash
APP_URL=https://webtest-passkey.vercel.app WEBAUTHN_RP_ID=webtest-passkey.vercel.app   node scripts/verify-webauthn.mjs          # 요청·응답 기록 (*.md, *.json)
APP_URL=https://webtest-passkey.vercel.app   node scripts/capture-evidence.mjs         # 실제 화면 (*.png) — Chrome + CDP 가상 인증기
node --env-file=.env.local scripts/show-stored-credential.mjs > docs/evidence/T08-A03-저장된_공개키.txt
node --env-file=.env.local scripts/render-evidence-views.mjs   # DB·요청응답 표 (*.png)
```

`capture-evidence.mjs` 는 촬영용으로 만든 비공개 자리를 끝에 스스로 삭제한다.

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

| `등록_로그인_요청본문.md` | 등록·로그인 요청 본문 원문 (개인키 없음, 서명만) | C23, C29 |
| `T08-A03-저장된_공개키.txt` | 서버 저장값 + COSE 해석(kty/alg/crv/x/y) + 비밀번호성 키 0개 | C21, C22 |
| `T08-E02-미로그인_페이지소스_확인.txt` | `/private`→`/login` 리다이렉트, `/api/items` 401, 소스에 항목 텍스트 0 | C15–C18 |

## 자동 촬영 화면 (`capture-evidence.mjs`)

| 파일 | 무엇을 담나 | 연결 기준 |
|---|---|---|
| `T08-E01-public-incognito.png` / `-b.png` | 세션 없이 연 공개 소개 + "지어낸 내용" 고지 | C10, C11, C12 |
| `T08-E02-private-redirect.png` | 로그인 없이 `/private` → 로그인 화면 (비공개 내용 0) | C15, C18 |
| `T08-E03b-login-screen.png` | 로그인/등록 화면 — 비밀번호 입력칸 없음 | C35 |
| `T08-E05-private-items.png` | 로그인 후 비공개 항목 3건 + 공개/비공개 경계 | C13, C14 |
| `T08-E04-passkey-list.png` | 패스키 2개 — 이름·등록 날짜·저장 위치 문구 | C24, C42, C43 |
| `T08-A01a-패스키_삭제직후.png` | 하나 삭제 후 1개 남음 | C44 |
| `T08-A01b-남은패스키로_로그인성공.png` | 삭제한 기기 없이 남은 패스키로 로그인 성공 | C44 |
| `T08-A01c-마지막패스키_삭제거절.png` | 마지막 패스키 삭제 시도 → 409 안내 | C46 |
| `T08-C16-미로그인_API_401.png` | 쿠키 없이 `/api/items` → **HTTP 401** + 본문 | C16, C17 |
| `T08-C45-등록안된패스키_로그인실패.png` | 서버에 없는 패스키로 로그인 시도 → 실패 안내 | C45 |
| `T08-C36-두번째자리_다른내용.png` | 두 번째 비공개 자리 — **내용이 다르고 남의 항목은 안 보임** | C13, C36, C40 |
| `T08-A05-DB저장내용.png` | **서버(Redis)에 저장된 것 전부** — 키 목록·TTL, 패스키 레코드, COSE 해석(kty/alg/crv/x/y), 개인키 `d` 없음, 비밀번호성 키 0개 | C19, C21, C22 |
| `T08-A06-요청응답기록.png` | **실제 요청·응답** — 미로그인 401/307, challenge 3건 전부 다름, 이미 쓴 challenge 재사용 400 | C16, C17, C20, C27, C28, C31, C33 |
| `T08-C37-자리간_접근시도.txt` | 자리 B 세션으로 A 의 항목 삭제 시도 → **404**, 스푸핑 쿼리에도 자기 3건만 | C37–C40 |

## 사람이 직접 찍어야 하는 것 (1장)

| 파일명 | 무엇을 담나 | 연결 기준 |
|---|---|---|
| `T08-E03-register-prompt.png` | **휴대폰**에서 구글 비밀번호 관리자 / iCloud 키체인 패스키 생성 프롬프트 | C25, C26 |

가상 인증기는 OS 프롬프트를 띄우지 않으므로 이 한 장만 실기기 촬영이 필요하다.
단계는 저장소 최상단 [`스크린샷_촬영순서.md`](../../스크린샷_촬영순서.md) 2단계.

## 재현

```bash
npm run dev                                   # 로컬 (인메모리 KV)
node scripts/verify-webauthn.mjs              # → 이 폴더의 md/json 갱신
# 배포본:
APP_URL=https://webtest-passkey.vercel.app WEBAUTHN_RP_ID=webtest-passkey.vercel.app node --env-file=.env.local scripts/verify-webauthn.mjs
```
