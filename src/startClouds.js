// Starts the two simulated clouds (AWS on :4001, Azure on :4002).
// They share the blockchain, but each enforces its own policy.
const { buildCloud } = require("./cloud");

// The clouds need the issuer's public key to check credential signatures.
// It is passed in by whoever starts them (demo / experiments).
function startClouds(issuerPublicKey) {
  return new Promise((resolve) => {
    const aws = buildCloud("aws", issuerPublicKey).listen(4001, "127.0.0.1", () => {});
    const azure = buildCloud("azure", issuerPublicKey).listen(4002, "127.0.0.1", () => {});
    // Give the servers a moment to bind.
    setTimeout(() => resolve({ aws, azure }), 300);
  });
}

module.exports = { startClouds };