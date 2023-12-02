import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { BigNumber, ethers } from "ethers";
import axios from "axios";
import * as fs from "fs";
import { Parser } from "json2csv";
import { SALE_ADDRESSES } from "../constants/sale.constants";
import { Sale } from "../../typings";

// example: yarn hardhat work:allocations --network [networkname]

const toNum = (bigNum: BigNumber): number => {
  return Number(ethers.utils.formatUnits(bigNum, 36));
};

export const explorerApiUrls = {
  goerli: "",
  sepolia: "https://api-sepolia.etherscan.io/api",
  hardhat: "",
  kovan: "",
  mainnet: "https://api.etherscan.io/api",
  rinkeby: "",
  ropsten: "",
  bsc: "https://api.bscscan.com/api",
  bsctest: "https://api-testnet.bscscan.com/api",
  xinfin: "",
  apothem: "",
  polygon: "",
  mumbai: "",
};

const explorerApiKeys = {
  mainnet: process.env.ETHERSCAN_API_KEY || "",
  rinkeby: process.env.ETHERSCAN_API_KEY || "",
  goerli: process.env.ETHERSCAN_API_KEY || "",
  sepolia: process.env.ETHERSCAN_API_KEY || "",
  bsc: process.env.BSCSCAN_API_KEY || "",
  bscTestnet: process.env.BSCSCAN_API_KEY || "",
  polygon: process.env.POLYSCAN_API_KEY || "",
  polygonMumbai: process.env.POLYSCAN_API_KEY || "",
  avalanche: process.env.SNOWTRACE_API_KEY || "",
  avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
};

const accounts = [
  "0xB212489869EFa26bAb3baC48350c339C17094E33",
  "0x0fc9a11ACde8E0fe19aDc047538C2f4b59582AFF",
  "0xAA1B6596b0c2b3F6457ba4f73B37E06AEE26F96B",
];

// example: yarn hardhat work:allocation  --network sepolia
task("work:allocation", "Gets the allocations for the work pools").setAction(async ({ _ }, hre) => {
  const sale = (await hre.ethers.getContractFactory("Sale")).attach(
    SALE_ADDRESSES[hre.network.name as keyof typeof SALE_ADDRESSES],
  ) as Sale;

  for (let i = 0; i < accounts.length; i++) {
    const total = await sale.getInvestorTotalAllocation(accounts[i]);

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ Account " + accounts[i] + " on '" + hre.network.name + "'");
    console.log("║ Round 1:		Invested $", toNum(total[0][0]), "		Pool $", toNum(total[1][0]));
    console.log("║ Round 2:		Invested $", toNum(total[0][1]), "		Pool $", toNum(total[1][1]));
    console.log("║ Round 3:		Invested $", toNum(total[0][2]), "		Pool $", toNum(total[1][2]));
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  }
});

// example: yarn hardhat work:allocations  --network sepolia
task("work:allocations", "Prints the private pool presale addresses").setAction(async ({ _ }, hre) => {
  const sale = (await hre.ethers.getContractFactory("Sale")).attach(
    SALE_ADDRESSES[hre.network.name as keyof typeof SALE_ADDRESSES],
  ) as Sale;

  const explorerApiUrl = explorerApiUrls[hre.network.name as keyof typeof explorerApiUrls];
  const explorerApiKey = explorerApiKeys[hre.network.name as keyof typeof explorerApiKeys];

  if (!explorerApiKey) {
    throw new Error(`Please set your explorer api key in the env for ${hre.network.name}`);
  } else if (!explorerApiUrl) {
    throw new Error(`Pleaes set explorer api url in the getExplorerApiUrl function for ${hre.network.name}`);
  }

  const latestBlockNumber = await hre.ethers.provider.getBlockNumber();

  const params = {
    module: "account",
    action: "txlist",
    address: sale.address,
    startblock: 0,
    endblock: latestBlockNumber,
    sort: "asc",
    apikey: explorerApiKey,
  };

  let response;

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Fetching Sale transactions", sale.address);
  console.log("║ From block", 0, "to block", latestBlockNumber, "on", hre.network.name);

  try {
    response = await axios.get(explorerApiUrl, {
      params,
    });

    const jsonData = response.data.result;

    // Convert JSON to CSV
    const parser = new Parser();
    const csvData = parser.parse(jsonData);

    // Write data to CSV file
    fs.writeFile(`${hre.network.name}-buyers.csv`, csvData, err => {
      if (err) {
        throw new Error(`Error while writing data to CSV file: ${err}`);
      }
      console.log("Data written to CSV file successfully.");
    });
  } catch (error) {
    throw new Error(`Error while fetching transactions from etherscan with ${error}`);
  }

  console.log("║ Fetching from", explorerApiUrl, "finished, analysing .......");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");

  const allFromAdressesInSale: string[] = response?.data.result.map((result: { from: unknown }) => {
    return result.from;
  });
  if (!allFromAdressesInSale || allFromAdressesInSale.length === 0)
    throw new Error("No addresses have been found that bought $WORK in the sale");
  const addressesUnique = [...new Set(allFromAdressesInSale)] as string[];
  for (let i = 0; i < addressesUnique.length; i++) {
    const buyer = addressesUnique[i];
    const total = await sale.getInvestorTotalAllocation(buyer);
    if (total[0][0].gt(0) || total[0][1].gt(0) || total[0][2].gt(0)) {
      buyers.push({
        address: buyer,
        totalInvested: toNum(total[0][0]) + toNum(total[0][1]) + toNum(total[0][2]),
        seed: toNum(total[0][0]),
        seedPool: toNum(total[1][0]),
        private: toNum(total[0][1]),
        privatePool: toNum(total[1][1]),
        presale: toNum(total[0][2]),
        presalePool: toNum(total[1][2]),
      });
    }
    process.stdout.write(`Investors found ${buyers.length}\r`);
  }

  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║", buyer.address, "		Total", "$" + buyer.totalInvested, "on " + hre.network.name);
    console.log("║ Round 1:		Invested $", buyer.seed, "		Pool $", buyer.seedPool);
    console.log("║ Round 2:		Invested $", buyer.private, "		Pool $", buyer.privatePool);
    console.log("║ Round 3:		Invested $", buyer.presale, "		Pool $", buyer.presalePool);
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  }

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log(
    "║ Summary:	",
    buyers.reduce((sum, buyer) => sum + buyer.totalInvested, 0),
    "from " + buyers.length + " buyers",
  );
  console.log(
    "║ Seed:		",
    buyers.reduce((sum, buyer) => sum + buyer.seed, 0),
  );
  console.log(
    "║ Private:	",
    buyers.reduce((sum, buyer) => sum + buyer.private, 0),
  );
  console.log(
    "║ Presale:	",
    buyers.reduce((sum, buyer) => sum + buyer.presale, 0),
  );
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

interface BuyerInfo {
  address: string;
  totalInvested: number;
  seed: number;
  seedPool: number;
  private: number;
  privatePool: number;
  presale: number;
  presalePool: number;
}

const buyers: BuyerInfo[] = [];
