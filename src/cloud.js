// A simulated cloud provider (used for both AWS and Azure). Each cloud runs
// its own verifier / Policy Enforcement Point as a small HTTP service, but
// they all share the same decentralized control plane (the blockchain).
const express = require("express");
const { verifyCredential } = require("./identity");
const { isAllowed } = require("./policy");
const { getContract, didHash } = require("./chain");

// Build (but do not start) a cloud service for a given name, e.g. "aws".
// `issuerPublicKey` is how this cloud checks credential signatures.
function buildCloud(cloudName, issuerPublicKey) {
  const app = express();
  app.use(express.json());

  // Access request: { credential: <VC JWT>, action: "read"|"write"|"delete" }
  app.post("/access", async (req, res) => {
    const { credential, action } = req.body;
    let granted = false;
    let reason = "";
    let subjectDid = null;
    let role = null;

    try {
      // 1. Verify the credential signature.
      const claims = await verifyCredential(credential, issuerPublicKey);
      subjectDid = claims.subjectDid;
      role = claims.role;

      // 2. Check the identity is still valid on the shared registry.
      const contract = getContract();
      const valid = await contract.isValid(didHash(subjectDid));

      if (!valid) {
        reason = "DID unknown or revoked";
      } else if (!isAllowed(cloudName, role, action)) {
        reason = `role '${role}' may not '${action}' on ${cloudName}`;
      } else {
        granted = true;
        reason = "allowed by policy";
      }

      // 3. Write a tamper-evident record to the shared audit log.
      const tx = await contract.logAccess(didHash(subjectDid), cloudName, action, granted);
      await tx.wait();
    } catch (err) {
      reason = "invalid credential: " + err.message;
    }

    res.json({ cloud: cloudName, subjectDid, role, action, granted, reason });
  });

  return app;
}

module.exports = { buildCloud };