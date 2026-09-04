import { randomBytes } from "node:crypto";
import * as challenges from "@/lib/repository/challenge";
import * as users from "@/lib/repository/user";
import * as credentials from "@/lib/repository/credential";
import type { Credential, Transport } from "@/lib/repository/credential";
import {
  buildRegistrationOptions,
  checkRegistration,
  buildAuthenticationOptions,
  checkAuthentication,
  rpID,
} from "@/lib/webauthn";
import { suggestLabel } from "@/lib/domain/rules";
import { publicPasskey, type PublicPasskey } from "@/lib/dto/records";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { randomUUID } from "node:crypto";

const toB64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64url");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

// ---- 등록 ----

export async function registerStart(sessionSpaceId: string | null) {
  let userHandle: Uint8Array;
  let exclude: { credentialId: string; transports: Transport[] }[] = [];

  if (sessionSpaceId) {
    // 2번째 패스키: 기존 자리의 user handle 을 재사용해 같은 자리에 매핑한다.
    const space = await users.find(sessionSpaceId);
    if (!space) throw new Error("자리를 찾지 못했습니다.");
    userHandle = fromB64(space.userHandle);
    exclude = (await credentials.listBySpace(sessionSpaceId)).map((c) => ({
      credentialId: c.credentialId,
      transports: c.transports,
    }));
  } else {
    userHandle = new Uint8Array(randomBytes(16));
  }

  const options = await buildRegistrationOptions({ userHandle, exclude });
  const challengeId = await challenges.create({
    purpose: "register",
    challenge: options.challenge,
    spaceId: sessionSpaceId,
    regUserHandle: sessionSpaceId ? null : toB64(userHandle),
    rpId: rpID(),
  });
  return { options, challengeId };
}

export type RegisterFinishResult = {
  spaceId: string;
  isNewSpace: boolean;
  passkeys: PublicPasskey[];
};

export async function registerFinish(params: {
  challengeId: string;
  response: RegistrationResponseJSON;
  label: string;
}): Promise<RegisterFinishResult | { error: string }> {
  const row = await challenges.consume(params.challengeId, "register");
  if (!row) return { error: "인증 요청이 만료되었거나 이미 처리되었습니다." };

  let verification;
  try {
    verification = await checkRegistration({
      response: params.response,
      expectedChallenge: row.challenge,
    });
  } catch {
    return { error: "패스키 등록을 확인하지 못했습니다." };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { error: "패스키 등록을 확인하지 못했습니다." };
  }

  const info = verification.registrationInfo;
  const transports = (params.response.response.transports ?? []) as Transport[];
  const deviceType = info.credentialDeviceType;

  const spaceId = row.spaceId ?? randomUUID();
  const isNewSpace = !row.spaceId;

  if (isNewSpace) {
    if (!row.regUserHandle) return { error: "등록 상태가 올바르지 않습니다." };
    await users.create(spaceId, row.regUserHandle);
  } else {
    // 같은 인증기 재등록 방지는 options 의 excludeCredentials 가 담당. 여기서는 중복만 막는다.
    const existing = await credentials.findById(info.credential.id);
    if (existing) return { error: "이미 등록된 패스키입니다." };
  }

  const cred: Credential = {
    credentialId: info.credential.id,
    spaceId,
    publicKey: toB64(info.credential.publicKey),
    counter: info.credential.counter,
    deviceType,
    backedUp: info.credentialBackedUp,
    transports,
    aaguid: info.aaguid,
    label: params.label || suggestLabel(deviceType),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await credentials.create(cred);

  const passkeys = (await credentials.listBySpace(spaceId)).map(publicPasskey);
  return { spaceId, isNewSpace, passkeys };
}

// ---- 로그인 ----

export async function authenticateStart() {
  const options = await buildAuthenticationOptions();
  const challengeId = await challenges.create({
    purpose: "authenticate",
    challenge: options.challenge,
    spaceId: null,
    regUserHandle: null,
    rpId: rpID(),
  });
  return { options, challengeId };
}

export async function authenticateFinish(params: {
  challengeId: string;
  response: AuthenticationResponseJSON;
}): Promise<{ spaceId: string } | { error: string; status: number }> {
  const row = await challenges.consume(params.challengeId, "authenticate");
  if (!row) return { error: "인증 요청이 만료되었거나 이미 처리되었습니다.", status: 400 };

  const cred = await credentials.findById(params.response.id);
  if (!cred) return { error: "등록되지 않은 패스키입니다.", status: 400 };

  let verification;
  try {
    verification = await checkAuthentication({
      response: params.response,
      expectedChallenge: row.challenge,
      credential: {
        id: cred.credentialId,
        publicKey: fromB64(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports,
      },
    });
  } catch {
    return { error: "로그인하지 못했습니다.", status: 401 };
  }
  if (!verification.verified) {
    return { error: "로그인하지 못했습니다.", status: 401 };
  }

  // 방어: 응답의 userHandle 이 이 크리덴셜의 자리와 일치하는지 확인.
  const uh = params.response.response.userHandle;
  if (uh) {
    const mappedSpace = await users.findIdByHandle(uh);
    if (mappedSpace && mappedSpace !== cred.spaceId) {
      return { error: "로그인하지 못했습니다.", status: 401 };
    }
  }

  await credentials.save({
    ...cred,
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: new Date().toISOString(),
  });

  return { spaceId: cred.spaceId };
}
