import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import axios from "axios";
import { BigNumber } from "ethers";

import { getExplorer } from "../constants/explorers.constants";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { amount, amountFormatted } from "../../test/util/helpers.util";

interface Transaction {
  value: number;
  from: string;
  to: string;
  timeStamp: number;
  blockNumber: string;
}

type Balances = Record<string, BigNumber>;

// example: yarn hardhat work:holdings --startdate 1700212400 --enddate 1707727340 --network sepolia
task("work:holdings", "Prints all work holder address with minimum hold amount at a start vs enddate")
  .addParam("startdate", "the startdate of the holding period")
  .addParam("enddate", "the enddate of the holding period ")
  .setAction(async ({ startdate, enddate }, hre) => {
    const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );

    const explorer = getExplorer(hre.network.name);
    if (!explorer.key) {
      throw new Error(`Please set your explorer api key in the env for ${hre.network.name}`);
    } else if (!explorer.url) {
      throw new Error(`Please set explorer api url in the constants function for ${hre.network.name}`);
    }

    console.log(explorer);

    const latestBlockNumber = await hre.ethers.provider.getBlockNumber();

    let txAll: Transaction[] = [];

    let response;
    let countTx: number;
    let lastTx = {} as Transaction;
    do {
      const params = {
        module: "account",
        action: "tokentx",
        contractaddress: workToken.address,
        startblock: lastTx?.blockNumber ? Number(lastTx.blockNumber) + 1 : 0,
        endblock: latestBlockNumber,
        sort: "asc",
        apikey: explorer.key,
      };
      try {
        response = await axios.get(explorer.url, {
          params,
        });
        const result = response.data.result as Transaction[];
        countTx = result.length;
        lastTx = result[countTx - 1];
        txAll = txAll.concat(result);
      } catch (error) {
        throw new Error(`Error while fetching transactions from etherscan with ${error}`);
      }
    } while (countTx === 10000);

    const txTillStart = txAll.filter((tx: Transaction) => tx.timeStamp < startdate);
    const txDuringHolding = response.data.result.filter(
      (tx: Transaction) => tx.timeStamp >= startdate && tx.timeStamp < enddate,
    );

    const balancesStart: Balances = {};
    txTillStart.forEach((tx: Transaction) => {
      const from = tx.from.toLowerCase();
      const to = tx.to.toLowerCase();
      const value = hre.ethers.BigNumber.from(tx.value);

      balancesStart[from] = balancesStart[from] ? balancesStart[from].sub(value) : BigNumber.from(0);
      balancesStart[to] = balancesStart[to] ? balancesStart[to].add(value) : value;
    });

    const balancesEnd: Balances = { ...balancesStart };
    txDuringHolding.forEach((tx: Transaction) => {
      const from = tx.from.toLowerCase();
      const to = tx.to.toLowerCase();
      const value = hre.ethers.BigNumber.from(tx.value);
      balancesEnd[from] = balancesEnd[from] ? balancesEnd[from].sub(value) : BigNumber.from(0);
      balancesEnd[to] = balancesEnd[to] ? balancesEnd[to].add(value) : value;
    });

    const minimumReq = amount(1);

    const holdings = Object.keys(balancesStart)
      .filter(address => balancesEnd[address].gt(minimumReq) && balancesStart[address].gt(minimumReq))
      .map(address => ({
        address,
        minimum: balancesEnd[address].gt(balancesStart[address])
          ? amountFormatted(balancesStart[address])
          : amountFormatted(balancesEnd[address]),
      }));

    console.log("holdings.length", holdings.length);
    console.log("holdings", holdings);

    return;
  });
