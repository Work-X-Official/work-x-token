import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
// import "solidity-coverage";
import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

import "./tasks/work";
import "./tasks/sale";
import "./tasks/nft";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const chainIds = {
  goerli: 5,
  sepolia: 11155111,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  bsc: 56,
  bsctest: 97,
  xinfin: 50,
  apothem: 51,
  polygon: 137,
  mumbai: 80001,
  scrollSepolia: 534351,
};

const chainUrls = {
  goerli: "https://goerli.infura.io/v3/" + infuraApiKey,
  sepolia: "https://sepolia.infura.io/v3/" + infuraApiKey,
  hardhat: "localhost",
  kovan: "https://kovan.infura.io/v3/" + infuraApiKey,
  mainnet: "https://mainnet.infura.io/v3/" + infuraApiKey,
  rinkeby: "https://rinkeby.infura.io/v3/" + infuraApiKey,
  ropsten: "https://ropsten.infura.io/v3/" + infuraApiKey,
  bsc: "https://bsc-dataseed.binance.org",
  bsctest: "https://data-seed-prebsc-1-s1.binance.org:8545",
  xinfin: "https://erpc.xinfin.network",
  apothem: "https://rpc.apothem.network",
  polygon: "https://polygon-rpc.com/",
  mumbai: "https://rpc-mumbai.maticvigil.com/",
  scrollSepolia: "https://sepolia-rpc.scroll.io/",
};

function getChainConfig(network: keyof typeof chainIds): NetworkUserConfig {
  return {
    accounts: {
      count: 10,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url: chainUrls[network],
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.8.22",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  typechain: {
    outDir: "typings",
    target: "ethers-v5",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 80,
    enabled: !!process.env.REPORT_GAS,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      // gas: 20000000,
      accounts: {
        count: 1000,
        mnemonic: mnemonic,
        accountsBalance: "100000000000000000000000000",
      },
      chainId: chainIds.hardhat,
      // forking: process.env.FORK
      //   ? {
      //       url: process.env.FORK,
      //     }
      //   : undefined,
    },
    mainnet: getChainConfig("mainnet"),
    goerli: getChainConfig("goerli"),
    sepolia: getChainConfig("sepolia"),
    kovan: getChainConfig("kovan"),
    ropsten: getChainConfig("ropsten"),
    bsc: getChainConfig("bsc"),
    bsctest: getChainConfig("bsctest"),
    rinkeby: getChainConfig("rinkeby"),
    xinfin: getChainConfig("xinfin"),
    apothem: getChainConfig("apothem"),
    polygon: getChainConfig("polygon"),
    mumbai: getChainConfig("mumbai"),
    scrollSepolia: getChainConfig("scrollSepolia"),
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      rinkeby: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTest: process.env.BSCSCAN_API_KEY || "",
      polygon: process.env.POLYSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYSCAN_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
      scrollSepolia: process.env.SCROLLSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "scrollSepolia",
        chainId: 534351,
        urls: {
          apiURL: "https://sepolia-blockscout.scroll.io/api",
          browserURL: "https://sepolia-blockscout.scroll.io/",
        },
      },
    ],
  },
};

export default config;
