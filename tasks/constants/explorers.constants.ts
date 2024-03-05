import { config as dotEnvConfig } from "dotenv";
import { resolve } from "path";

const pathName = resolve("./.env");
dotEnvConfig({ path: pathName });

interface Explorer {
  key: string;
  url: string;
}

export const EXPLORER_API_URLS: { [key: string]: string } = {
  mainnet: "https://api.etherscan.io/api",
  sepolia: "https://api-sepolia.etherscan.io/api",
  bsc: "https://api.bscscan.com/api",
  bsctest: "https://api-testnet.bscscan.com/api",
};

export const getExplorerApiUrl = (networkName: string): string => {
  return EXPLORER_API_URLS[networkName];
};

export const EXPLORER_API_KEYS: { [key: string]: string } = {
  goerli: process.env.ETHERSCAN_API_KEY || "",
  sepolia: process.env.ETHERSCAN_API_KEY || "",
  mainnet: process.env.ETHERSCAN_API_KEY || "",
  rinkeby: process.env.ETHERSCAN_API_KEY || "",
  bsc: process.env.BSCSCAN_API_KEY || "",
  bsctest: process.env.BSCSCAN_API_KEY || "",
  polygon: process.env.POLYSCAN_API_KEY || "",
  mumbai: process.env.POLYSCAN_API_KEY || "",
  avalanche: process.env.SNOWTRACE_API_KEY || "",
  fuji: process.env.SNOWTRACE_API_KEY || "",
};

export const getExplorerApiKey = (networkName: string): string => {
  return EXPLORER_API_KEYS[networkName];
};

export const getExplorer = (networkName: string): Explorer => {
  return {
    key: EXPLORER_API_KEYS[networkName],
    url: EXPLORER_API_URLS[networkName],
  };
};
