// Decentralized identity: key generation, DID creation, and Verifiable
// Credential issuance/verification. A VC here is a signed JWT (the W3C
// "VC-JWT" representation), signed by the issuer's private key.
const { generateKeyPair, exportJWK, SignJWT, jwtVerify, importJWK } = require("jose");
const crypto = require("crypto");

// Create an issuer (the authority that vouches for identities).
async function createIssuer() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const pubJwk = await exportJWK(publicKey);
  const did = didFromJwk(pubJwk);
  return { did, publicKey, privateKey, pubJwk };
}

// Create a subject identity (a user or service) with its own DID.
async function createIdentity(name) {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const pubJwk = await exportJWK(publicKey);
  const did = didFromJwk(pubJwk);
  return { name, did, publicKey, privateKey, pubJwk };
}

// Derive a did:key-style identifier from the public key.
function didFromJwk(jwk) {
  const thumb = crypto
    .createHash("sha256")
    .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
    .digest("hex")
    .slice(0, 32);
  return "did:key:" + thumb;
}

// Issuer signs a Verifiable Credential stating the subject's role.
async function issueCredential(issuer, subjectDid, role) {
  const vc = await new SignJWT({
    vc: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "AccessCredential"],
      credentialSubject: { id: subjectDid, role },
    },
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(issuer.did)
    .setSubject(subjectDid)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(issuer.privateKey);
  return vc;
}

// A cloud verifies the credential's signature using the issuer's public key.
async function verifyCredential(vcJwt, issuerPublicKey) {
  const { payload } = await jwtVerify(vcJwt, issuerPublicKey, { algorithms: ["EdDSA"] });
  return {
    subjectDid: payload.sub,
    role: payload.vc.credentialSubject.role,
    issuer: payload.iss,
  };
}

module.exports = { createIssuer, createIdentity, issueCredential, verifyCredential };