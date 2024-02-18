import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import axios from "axios";
import { BigNumber } from "ethers";
import * as fs from "fs";
import { getExplorer } from "../constants/explorers.constants";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { amount, amountFormatted } from "../../test/util/helpers.util";
import {
  bridgeAddresses,
  contractAddresses,
  dwfAddresses,
  gateAddresses,
  genesisNft,
  kucoinAddresses,
  kucoinHotAddresses,
  liquidity,
  mexcAddresses,
  opsAddresses,
  pancakePool,
  rewardShares,
  rewardTokens,
  uniswapPool,
} from "../constants/accounts.constants";

interface Transaction {
  value: number;
  from: string;
  to: string;
  timeStamp: number;
  blockNumber: string;
  network: string;
}

interface Holdings {
  address: string;
  minimum: number;
}

type Balances = Record<string, BigNumber>;

// example: yarn hardhat work:alltx --network sepolia
task("work:alltx", "Get all $WORK transaction on a network").setAction(async (_, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );

  const explorer = getExplorer(hre.network.name);
  if (!explorer.key) {
    throw new Error(`Please set your explorer api key in the env for ${hre.network.name}`);
  } else if (!explorer.url) {
    throw new Error(`Please set explorer api url in the constants function for ${hre.network.name}`);
  }

  const latestBlockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("latestBlockNumber", latestBlockNumber);
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

  const json = JSON.stringify(txAll, null, 2);
  fs.writeFileSync(`./work_tokens/tx_all_${hre.network.name}_${latestBlockNumber}.json`, json);
});

// yarn hardhat work:holdings --startdate 1707688800 --enddate 1708210800 --network sepolia
task("work:holdings", "Prints all work holder address with minimum hold amount at a start vs enddate")
  .addParam("startdate", "the startdate of the holding period")
  .addParam("enddate", "the enddate of the holding period ")
  .setAction(async ({ startdate, enddate }, hre) => {
    const json = fs.readFileSync(`./work_tokens/tx_all_${hre.network.name}.json`, "utf8");
    const txAll = JSON.parse(json) as Transaction[];

    const holdings = getMinimalWorkTokenBalanceInPeriod(txAll, Number(startdate), Number(enddate));
    const qualifyForGuaranteed = holdings.filter(holding => holding.minimum > 10);

    console.log("holdings.length", holdings.length);
    console.log("qualifyForGuaranteed.length", qualifyForGuaranteed.length);
  });

// yarn hardhat work:campaign
task("work:campaign", "Prints all work holder addresses that qualify for the holder campaign").setAction(
  async (_, __) => {
    const startDateSunday = 1707688800;
    const startDateSaturday = 1707602400;
    const startDateFriday = 1707516000;
    const startDateThursday = 1707429600;
    const startDateWednesday = 1707343200;
    const endDate = 1708210800;

    const jsonMainnet = fs.readFileSync(`./work_tokens/tx_all_mainnet.json`, "utf8");
    const jsonBsc = fs.readFileSync(`./work_tokens/tx_all_bsc.json`, "utf8");
    const txMainnet = JSON.parse(jsonMainnet) as Transaction[];
    txMainnet.forEach(tx => (tx.network = "mainnet"));
    const txBsc = JSON.parse(jsonBsc) as Transaction[];
    txBsc.forEach(tx => (tx.network = "bsc"));
    const txAll = txMainnet.concat(txBsc);

    const holdingsFromSunday = getMinimalWorkTokenBalanceInPeriod(txAll, Number(startDateSunday), Number(endDate));
    const holdingsFromSaturday = getMinimalWorkTokenBalanceInPeriod(txAll, Number(startDateSaturday), Number(endDate));
    const holdingsFromFriday = getMinimalWorkTokenBalanceInPeriod(txAll, Number(startDateFriday), Number(endDate));
    const holdingsFromThursday = getMinimalWorkTokenBalanceInPeriod(txAll, Number(startDateThursday), Number(endDate));
    const holdingsFromWednesday = getMinimalWorkTokenBalanceInPeriod(
      txAll,
      Number(startDateWednesday),
      Number(endDate),
    );
    const qualifyForGuaranteed = holdingsFromSunday.filter(holding => holding.minimum > 10);
    const sundayTotal = holdingsFromSunday.map(holding => holding.minimum).reduce((a, b) => a + b, 0);
    const saturdayTotal = holdingsFromSaturday.map(holding => holding.minimum).reduce((a, b) => a + b, 0);
    const fridayTotal = holdingsFromFriday.map(holding => holding.minimum).reduce((a, b) => a + b, 0);
    const thursdayTotal = holdingsFromThursday.map(holding => holding.minimum).reduce((a, b) => a + b, 0);
    const wednesdayTotal = holdingsFromWednesday.map(holding => holding.minimum).reduce((a, b) => a + b, 0);

    console.log("holdingsSunday", holdingsFromSunday.length, sundayTotal);
    console.log("holdingsFromSaturday", holdingsFromSaturday.length, saturdayTotal);
    console.log("holdingsFromFriday", holdingsFromFriday.length, fridayTotal);
    console.log("holdingsFromThursday", holdingsFromThursday.length, thursdayTotal);
    console.log("holdingsFromWednesday", holdingsFromWednesday.length);
    console.log("qualifyForGuaranteed", qualifyForGuaranteed.length, wednesdayTotal);
  },
);

const getMinimalWorkTokenBalanceInPeriod = (txAll: Transaction[], startdate: number, enddate: number): Holdings[] => {
  const txTillStart = txAll.filter(tx => tx.timeStamp < startdate);
  const balancesStart: Balances = {};

  const txDuringHolding = txAll.filter(tx => tx.timeStamp >= startdate && tx.timeStamp < enddate);
  txTillStart.forEach((tx: Transaction) => {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    const value = BigNumber.from(tx.value);

    balancesStart[from] = balancesStart[from] ? balancesStart[from].sub(value) : BigNumber.from(0);
    balancesStart[to] = balancesStart[to] ? balancesStart[to].add(value) : value;
  });

  const balancesEnd: Balances = { ...balancesStart };
  txDuringHolding.forEach((tx: Transaction) => {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    const value = BigNumber.from(tx.value);
    balancesEnd[from] = balancesEnd[from] ? balancesEnd[from].sub(value) : BigNumber.from(0);
    balancesEnd[to] = balancesEnd[to] ? balancesEnd[to].add(value) : value;
  });

  return Object.keys(balancesStart)
    .filter(address => !exclude.includes(address.toLowerCase()))
    .filter(address => balancesEnd[address].gte(minimumReq) && balancesStart[address].gte(minimumReq))
    .map(address => ({
      address,
      minimum: balancesEnd[address].gt(balancesStart[address])
        ? amountFormatted(balancesStart[address])
        : amountFormatted(balancesEnd[address]),
    })) as Holdings[];
};

const minimumReq = amount(1);
const exclude = kucoinHotAddresses
  .concat(kucoinAddresses)
  .concat(mexcAddresses)
  .concat(gateAddresses)
  .concat(contractAddresses)
  .concat(dwfAddresses)
  .concat(bridgeAddresses)
  .concat(opsAddresses)
  .concat(liquidity)
  .concat([uniswapPool, pancakePool, genesisNft, rewardTokens, rewardShares])
  .map(address => address.toLowerCase());
