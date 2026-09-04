// Edge 런타임(middleware.ts)에서도 import 되므로 node:crypto·KV 같은 무거운 의존을 두지 않는다.
// 상수만 둔다.

export const SESSION_COOKIE = "to8_session";
export const SESSION_DAYS = 7;
export const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

// 진행 중인 등록/로그인 ceremony 의 challenge 행 id 를 잠깐 담는 익명 쿠키.
export const WEBAUTHN_COOKIE = "to8_webauthn";
export const CHALLENGE_MINUTES = 5;
export const CHALLENGE_SECONDS = CHALLENGE_MINUTES * 60;
