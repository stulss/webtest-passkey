import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialHint,
} from "@simplewebauthn/server";

// WebAuthn 크립토(COSE/CBOR 파싱, attestation/assertion 검증)는 전부 @simplewebauthn/server 에 위임한다.
// 이 파일은 rpID/origin 설정과 얇은 래퍼만 둔다.

export const RP_NAME = "홍주형 — 비공개 영역";

// 배포 도메인. 스킴·포트·경로 없이. localhost 는 WebAuthn secure-context 예외라 기본값이 그대로 동작.
export const rpID = () => process.env.WEBAUTHN_RP_ID ?? "localhost";
export const expectedOrigin = () =>
  process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

const ALGS = [-7, -257]; // ES256, RS256

// 브라우저/OS 에 어떤 인증기를 먼저 제안할지 순서만 알려준다(제한이 아니다).
// 이게 없으면 Windows 는 allowCredentials 가 빈 usernameless 요청에서 곧장
// "보안 키를 USB 포트에 삽입하십시오" 로 빠진다.
// client-device(윈도우 헬로·구글 비밀번호 관리자) → hybrid(폰 QR) → security-key(USB) 순.
const HINTS: PublicKeyCredentialHint[] = ["client-device", "hybrid", "security-key"];

export type StoredCredentialSummary = {
  credentialId: string; // base64url
  transports: AuthenticatorTransportFuture[];
};

type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export async function buildRegistrationOptions(params: {
  userHandle: Uint8Array;
  exclude: StoredCredentialSummary[];
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: "비공개 자리",
    userID: params.userHandle,
    userDisplayName: "비공개 자리",
    attestationType: "none",
    excludeCredentials: params.exclude.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: ALGS,
  });
  return { ...options, hints: HINTS };
}

export async function checkRegistration(params: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: expectedOrigin(),
    expectedRPID: rpID(),
    requireUserVerification: false,
  });
}

export async function buildAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
    // allowCredentials 생략 → 브라우저가 discoverable 패스키 선택 UI 를 띄운다 (usernameless).
  });
  return { ...options, hints: HINTS };
}

export async function checkAuthentication(params: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  };
}): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: expectedOrigin(),
    expectedRPID: rpID(),
    credential: params.credential,
    requireUserVerification: false,
  });
}

export type { RegistrationResponseJSON, AuthenticationResponseJSON };
