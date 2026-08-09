// End-to-end demonstration:
//  1. create an issuer and a user identity
//  2. register the user's DID on the blockchain
//  3. issue a Verifiable Credential to the user
//  4. send access requests to BOTH simulated clouds
//  5. revoke the user and show access is then denied everywhere
const { createIssuer, createIdentity, issueCredential } = require("./identity");
const { getContract, didHash } = require("./chain");
const { startClouds } = require("./startClouds");

async function ask(port, credential, action) {
  const r = await fetch(`http://127.0.0.1:${port}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, action }),
  });
  return r.json();
}

async function main() {
  const contract = getContract();

  console.log("Creating identities...");
  const issuer = await createIssuer();
  const alice = await createIdentity("alice");

  console.log("Registering Alice's DID on the blockchain...");
  await (await contract.registerDID(didHash(alice.did))).wait();

  console.log("Issuing a Verifiable Credential (role: user)...");
  const vc = await issueCredential(issuer, alice.did, "user");

  console.log("Starting simulated clouds (AWS :4001, Azure :4002)...\n");
  await startClouds(issuer.publicKey);

  console.log("--- Access requests with a VALID credential ---");
  console.log("AWS   read :", await ask(4001, vc, "read"));
  console.log("AWS   write:", await ask(4001, vc, "write"));
  console.log("Azure read :", await ask(4002, vc, "read"));
  console.log("Azure write:", await ask(4002, vc, "write"), "(Azure policy is stricter)\n");

  console.log("--- Revoking Alice's DID on the blockchain ---");
  await (await contract.revokeDID(didHash(alice.did))).wait();
  console.log("AWS   read :", await ask(4001, vc, "read"), "(now denied everywhere)\n");

  const count = await contract.auditCount();
  console.log(`Total tamper-evident audit records on-chain: ${count}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });