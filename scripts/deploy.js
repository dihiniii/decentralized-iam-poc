// Deploys IAMRegistry to the local blockchain and saves its address.
const fs = require("fs");
const { ethers } = require("ethers");
const { wallet, artifact, deploymentPath } = require("../src/chain");

async function main() {
  const w = wallet();
  const { abi, bytecode } = artifact();
  console.log("Deploying IAMRegistry from account:", w.address);

  const factory = new ethers.ContractFactory(abi, bytecode, w);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  fs.writeFileSync(deploymentPath(), JSON.stringify({ address }, null, 2));
  console.log("IAMRegistry deployed at:", address);
  console.log("Saved address to deployment.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});