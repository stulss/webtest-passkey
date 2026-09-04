// 검증용 소프트웨어 인증기 (P-256 / ES256, attestation "none", resident key).
//
// 실제 보안 경계가 아니다. "저장된 공개키로 서명을 검증한 뒤에만 통과한다"(C29) 와
// 계정 간 격리(C36–C40), 패스키 삭제 후 로그인(C44/C45) 을 자동으로 재현하기 위한 도구다.
// 실기기 스크린샷(Chrome DevTools WebAuthn 탭)으로 보완한다.
//
// @simplewebauthn/server 가 기대하는 구조만 정확히 만든다:
//  - 등록: attestationObject(CBOR) = { fmt:"none", attStmt:{}, authData }
//  - authData = rpIdHash(32) | flags(1) | signCount(4) | attestedCredentialData
//  - attestedCredentialData = aaguid(16) | credIdLen(2) | credId | cosePublicKey(CBOR)
//  - 로그인: authenticatorData | clientDataJSON | signature(DER)

import {
  createHash,
  generateKeyPairSync,
  createSign,
  randomBytes,
} from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sha256 = (buf) => createHash("sha256").update(buf).digest();

// ---- 최소 CBOR 인코더 (필요한 모양만) ----
function cborUint(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) return Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
  throw new Error("cbor uint too large");
}
function cborBytes(buf) {
  return Buffer.concat([cborUint(2, buf.length), Buffer.from(buf)]);
}
function cborText(str) {
  const b = Buffer.from(str, "utf8");
  return Buffer.concat([cborUint(3, b.length), b]);
}
function cborNegInt(n) {
  // n 은 음수. CBOR major 1, value = -1 - n
  return cborUint(1, -1 - n);
}
function cborMap(pairs) {
  return Buffer.concat([cborUint(5, pairs.length), ...pairs.flat()]);
}

// COSE_Key: {1:2(kty EC2), 3:-7(alg ES256), -1:1(crv P-256), -2:x, -3:y}
function coseKey(x, y) {
  return cborMap([
    [cborUint(0, 1), cborUint(0, 2)],
    [cborUint(0, 3), cborNegInt(-7)],
    [cborNegInt(-1), cborUint(0, 1)],
    [cborNegInt(-2), cborBytes(x)],
    [cborNegInt(-3), cborBytes(y)],
  ]);
}

function attestationObject(authData) {
  return cborMap([
    [cborText("fmt"), cborText("none")],
    [cborText("attStmt"), cborMap([])],
    [cborText("authData"), cborBytes(authData)],
  ]);
}

// raw P-256 public key (0x04 | x | y) → x, y
function xyFromDer(publicKeyDer) {
  // SPKI DER: 마지막 65바이트가 0x04||x||y
  const raw = publicKeyDer.subarray(publicKeyDer.length - 65);
  if (raw[0] !== 0x04) throw new Error("unexpected EC point format");
  return { x: raw.subarray(1, 33), y: raw.subarray(33, 65) };
}

export function createAuthenticator({ rpId = "localhost", label = "sw-authenticator" } = {}) {
  const credentials = new Map(); // credentialId(b64url) -> { privateKey, publicKeyDer, counter }
  let removed = new Set();

  function makeAuthData(credId, coseKeyBuf, flagsExtra = 0) {
    const rpIdHash = sha256(Buffer.from(rpId));
    const flags = Buffer.from([0x45 | flagsExtra]); // UP(0x01) | UV(0x04) | AT(0x40)
    const signCount = Buffer.from([0, 0, 0, 0]);
    const aaguid = Buffer.alloc(16, 0);
    const credIdLen = Buffer.from([credId.length >> 8, credId.length & 0xff]);
    return Buffer.concat([rpIdHash, flags, signCount, aaguid, credIdLen, credId, coseKeyBuf]);
  }

  return {
    label,

    // startRegistration 대응
    register(optionsJSON) {
      const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
      const { x, y } = xyFromDer(publicKeyDer);
      const credId = randomBytes(20);
      const credIdB64 = b64url(credId);

      // resident key: 서버가 options.user.id 로 준 user handle 을 크리덴셜과 함께 저장한다.
      credentials.set(credIdB64, {
        privateKey,
        counter: 0,
        userHandle: optionsJSON.user?.id ?? null,
      });

      const clientData = {
        type: "webauthn.create",
        challenge: optionsJSON.challenge,
        origin: originFor(rpId),
        crossOrigin: false,
      };
      const clientDataJSON = Buffer.from(JSON.stringify(clientData));
      const authData = makeAuthData(credId, coseKey(x, y));

      return {
        id: credIdB64,
        rawId: credIdB64,
        type: "public-key",
        response: {
          clientDataJSON: b64url(clientDataJSON),
          attestationObject: b64url(attestationObject(authData)),
          transports: ["internal", "hybrid"],
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },

    // startAuthentication 대응. usernameless: 인증기가 resident key 에서 credential 과 userHandle 을 고른다.
    // credentialIdB64 를 생략하면 이 인증기의 첫 유효 크리덴셜을 쓴다.
    authenticate(optionsJSON, credentialIdB64) {
      credentialIdB64 ??= this.knownCredentialIds()[0];
      if (removed.has(credentialIdB64)) {
        const err = new Error("이 인증기에서 삭제된 패스키입니다.");
        err.name = "NotAllowedError";
        throw err;
      }
      const cred = credentials.get(credentialIdB64);
      if (!cred) {
        const err = new Error("이 인증기에 없는 패스키입니다.");
        err.name = "NotAllowedError";
        throw err;
      }

      const clientData = {
        type: "webauthn.get",
        challenge: optionsJSON.challenge,
        origin: originFor(rpId),
        crossOrigin: false,
      };
      const clientDataJSON = Buffer.from(JSON.stringify(clientData));
      const clientDataHash = sha256(clientDataJSON);

      const rpIdHash = sha256(Buffer.from(rpId));
      const flags = Buffer.from([0x05]); // UP | UV, AT 없음
      cred.counter += 1;
      const signCount = Buffer.alloc(4);
      signCount.writeUInt32BE(cred.counter);
      const authenticatorData = Buffer.concat([rpIdHash, flags, signCount]);

      const signature = createSign("SHA256")
        .update(Buffer.concat([authenticatorData, clientDataHash]))
        .sign(cred.privateKey); // DER

      return {
        id: credentialIdB64,
        rawId: credentialIdB64,
        type: "public-key",
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(authenticatorData),
          signature: b64url(signature),
          userHandle: cred.userHandle ?? null,
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },

    // 손상된 서명으로 실패 대조를 만든다 (C30/C31).
    authenticateWithBadSignature(optionsJSON, credentialIdB64) {
      const good = this.authenticate(optionsJSON, credentialIdB64);
      const sig = Buffer.from(good.response.signature, "base64url");
      sig[sig.length - 1] ^= 0xff;
      good.response.signature = b64url(sig);
      return good;
    },

    forget(credentialIdB64) {
      removed.add(credentialIdB64);
    },

    knownCredentialIds() {
      return [...credentials.keys()].filter((id) => !removed.has(id));
    },
  };
}

function originFor(rpId) {
  return rpId === "localhost" ? "http://localhost:3000" : `https://${rpId}`;
}
