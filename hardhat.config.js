require("@nomicfoundation/hardhat-ethers");

/** Local-only Hardhat configuration for the PoC */
module.exports = {
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};