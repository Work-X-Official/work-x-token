export const EXPLORER_API_URLS: { [key: string]: string } = {
  mainnet: "https://api.etherscan.io/api",
  sepolia: "https://api-sepolia.etherscan.io/api",
  bsc: "https://api.bscscan.com/api",
  bsctest: "https://api-testnet.bscscan.com/api",
};

export const getExplorerApiUrl = (networkName: string): string => {
  return EXPLORER_API_URLS[networkName];
};
