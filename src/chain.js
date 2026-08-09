// Shared helpers for talking to the local blockchain and the IAMRegistry contract.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8545";
// Hardhat's first built-in test account (publicly known, local use only).
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function artifact() {
  const p = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "IAMRegistry.sol",
    "IAMRegistry.json"
  );
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function provider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

function wallet() {
  return new ethers.Wallet(DEPLOYER_KEY, provider());
}

function deploymentPath() {
  return path.join(__dirname, "..", "deployment.json");
}

function getContract() {
  const { address } = JSON.parse(fs.readFileSync(deploymentPath(), "utf8"));
  const { abi } = artifact();
  return new ethers.Contract(address, abi, wallet());
}

// keccak256(DID string) computed the same way Solidity does for a string.
function didHash(did) {
  return ethers.id(did); // keccak256 of the UTF-8 string
}

module.exports = { provider, wallet, artifact, getContract, didHash, deploymentPath, RPC_URL };