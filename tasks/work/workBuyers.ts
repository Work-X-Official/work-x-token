import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { BigNumber, ethers } from "ethers";
import axios from "axios";
import * as fs from "fs";
import { Parser } from "json2csv";
import csv from "csv-parser";
import { SALE_ADDRESSES } from "../constants/sale.constants";
import { Sale } from "../../typings";
import { workBought } from "../util/utils";
import { isPrivatePool } from "../constants/pools.constants";

// example: yarn hardhat work:allocation  --network sepolia
task("work:allocation", "Gets the allocations for the work pools").setAction(async ({ _ }, hre) => {
  const sale = (await hre.ethers.getContractFactory("Sale")).attach(
    SALE_ADDRESSES[hre.network.name as keyof typeof SALE_ADDRESSES],
  ) as Sale;
  const froms = (await loadAccounts(hre.network.name)).map(account => account.from);
  const accounts = [...new Set(froms)] as string[];
  const buyers = await getBuyersInfo(accounts, sale);

  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ User " + buyer.address + "   Total Spent: $" + buyer.totalInvested);
    console.log("║ Pool " + buyer.pool + "   Total $WORK:" + (buyer.seedWork + buyer.privateWork + buyer.presaleWork));
    console.log("║ Round 1: Invested: $", buyer.seed);
    console.log("║          Pool:     $", buyer.seedPool);
    console.log("║          $WORK:     ", buyer.seedWork);
    console.log("║ Round 2: Invested: $", buyer.private);
    console.log("║          Pool:     $", buyer.privatePool);
    console.log("║          $WORK:     ", buyer.privateWork);
    console.log("║ Round 3: Invested: $", buyer.presale);
    console.log("║          Pool:     $", buyer.presalePool);
    console.log("║          $WORK:     ", buyer.presaleWork);
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
    "║ Seed $WORK:	",
    buyers.reduce((sum, buyer) => sum + buyer.seedWork, 0),
  );
  console.log(
    "║ Private:	",
    buyers.reduce((sum, buyer) => sum + buyer.private, 0),
  );
  console.log(
    "║ Private $WORK:",
    buyers.reduce((sum, buyer) => sum + buyer.privateWork, 0),
  );
  console.log(
    "║ Presale:	",
    buyers.reduce((sum, buyer) => sum + buyer.presale, 0),
  );
  console.log(
    "║ Presale $WORK:",
    buyers.reduce((sum, buyer) => sum + buyer.presaleWork, 0),
  );
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

// example: yarn hardhat work:saletransactions  --network sepolia
task("work:saletransactions", "Gets the transactions from the Sale contract and dumps them in a file").setAction(
  async ({ _ }, hre) => {
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
      throw new Error(`Error while fetching transactions from scanner with ${error}`);
    }

    console.log(`║ Fetching from ${explorerApiUrl} finished and saved to file ${hre.network.name}-buyers.csv`);
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  },
);

interface BuyerInfo {
  address: string;
  pool: string;
  totalInvested: number;
  seed: number;
  seedPool: number;
  seedWork: number;
  private: number;
  privatePool: number;
  privateWork: number;
  presale: number;
  presalePool: number;
  presaleWork: number;
}

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

async function loadAccounts(networkName: string): Promise<SaleTransaction[]> {
  const accounts: string[] = [];
  const filePath = `${networkName}-buyers.csv`;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", data => accounts.push(data))
      .on("end", () => resolve(accounts as unknown as SaleTransaction[]))
      .on("error", error => reject(error));
  });
}

interface SaleTransaction {
  from: string;
}

async function getBuyersInfo(accounts: string[], sale: Sale): Promise<BuyerInfo[]> {
  const buyers: BuyerInfo[] = [];
  console.log("Searching unique buyers in " + accounts.length + " transactions...");
  for (let i = 0; i < accounts.length; i++) {
    const total = await sale.getInvestorTotalAllocation(accounts[i]);
    if (total[0][0].gt(0) || total[0][1].gt(0) || total[0][2].gt(0)) {
      const pool = await sale.walletToPool(accounts[i]);
      let seedWork = 0;
      let privateWork = 0;
      let presaleWork = 0;
      if (total[0][0].gt(0)) {
        seedWork = workBought(0, toNum(total[0][0]), toNum(total[1][0]), isPrivatePool(pool));
      }
      if (total[0][1].gt(0)) {
        privateWork = workBought(1, toNum(total[0][1]), toNum(total[1][1]), isPrivatePool(pool));
      }
      if (total[0][2].gt(0)) {
        presaleWork = workBought(2, toNum(total[0][2]), toNum(total[1][2]), isPrivatePool(pool));
      }
      buyers.push({
        address: accounts[i],
        pool: pool,
        totalInvested: toNum(total[0][0]) + toNum(total[0][1]) + toNum(total[0][2]),
        seed: toNum(total[0][0]),
        seedPool: toNum(total[1][0]),
        seedWork: seedWork,
        private: toNum(total[0][1]),
        privatePool: toNum(total[1][1]),
        privateWork: privateWork,
        presale: toNum(total[0][2]),
        presalePool: toNum(total[1][2]),
        presaleWork: presaleWork,
      });
      process.stdout.write(`Buyers found: ${buyers.length}\r`);
    }
  }
  return buyers;
}

task("work:allocation:out", "Gets the allocations for the work pools").setAction(async ({ _ }, hre) => {
  const sale = (await hre.ethers.getContractFactory("Sale")).attach(
    SALE_ADDRESSES[hre.network.name as keyof typeof SALE_ADDRESSES],
  ) as Sale;
  const froms = (await loadAccounts(hre.network.name)).map(account => account.from);
  const accounts = [...new Set(froms)] as string[];
  const buyers = await getBuyersInfo(accounts, sale);

  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    const output = [
      "╔══════════════════════════════════════════════════════════════════════",
      "║ User " + buyer.address + "   Total Spent: $" + buyer.totalInvested,
      "║ Pool " + buyer.pool + "   Total $WORK:" + (buyer.seedWork + buyer.privateWork + buyer.presaleWork),
      "║ Round 1: Invested: $" + buyer.seed,
      "║          Pool:     $" + buyer.seedPool,
      "║          $WORK:     " + buyer.seedWork,
      "║ Round 2: Invested: $" + buyer.private,
      "║          Pool:     $" + buyer.privatePool,
      "║          $WORK:     " + buyer.privateWork,
      "║ Round 3: Invested: $" + buyer.presale,
      "║          Pool:     $" + buyer.presalePool,
      "║          $WORK:     " + buyer.presaleWork,
      "╚══════════════════════════════════════════════════════════════════════",
      "",
    ].join("\n");

    fs.appendFileSync(`${hre.network.name}-buyers.txt`, output + "\n");
  }
});

task("work:allocation:csv", "Gets the allocations for the work pools").setAction(async ({ _ }, hre) => {
  const sale = (await hre.ethers.getContractFactory("Sale")).attach(
    SALE_ADDRESSES[hre.network.name as keyof typeof SALE_ADDRESSES],
  ) as Sale;
  const froms = (await loadAccounts(hre.network.name)).map(account => account.from);
  const accounts = [...new Set(froms)] as string[];
  const buyers = await getBuyersInfo(accounts, sale);
  const parser = new Parser();
  const csvData = parser.parse(buyers.map(buyer => JSON.stringify(buyer)));
  fs.writeFile(`${hre.network.name}-buyers-info.csv`, csvData, err => {
    if (err) {
      throw new Error(`Error while writing data to CSV file: ${err}`);
    }
    console.log("Data written to CSV file successfully.");
  });
});
