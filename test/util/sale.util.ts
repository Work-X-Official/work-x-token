import { ethers } from "hardhat";
import { BUY_MORE_PRICE } from "../../tasks/constants/sale.constants";
import { BuyMore } from "../../typings";
import { CONSTANTS } from "../constants";
import { daysToSeconds } from "./helpers.util";
import { BigNumber } from "ethers";

export const vestingPeriods = [daysToSeconds(547.5), daysToSeconds(365), daysToSeconds(273.75)];
export const vestingPeriod3Cliff = daysToSeconds(27.375);

export type Investment = {
  seed: number;
  seedPool: number;
  priv: number;
  privPool: number;
  pre: number;
  preDisc: number;
  prePool: number;
  buyMore: number;
};

const zero = {
  seed: 0,
  seedPool: 0,
  priv: 0,
  privPool: 0,
  pre: 0,
  preDisc: 0,
  prePool: 0,
  buyMore: 0,
};

export const zeroInv: Investment = {
  ...zero,
};

export const seed1kInv: Investment = {
  ...zero,
  seed: 1000,
  seedPool: 1000,
};

export const seed251Inv: Investment = {
  ...zero,
  seed: 24,
  seedPool: 24,
};

export const seedPriv2kInv: Investment = {
  ...zero,
  seed: 2000,
  seedPool: 2000,
  priv: 2000,
  privPool: 2000,
};

export const seed8kInv: Investment = {
  ...zero,
  seed: 8000,
  seedPool: 8000,
};

export const seed10kInv: Investment = {
  ...zero,
  seed: 10000,
  seedPool: 10000,
};

export const seed32kInv: Investment = {
  ...zero,
  seed: 32000,
  seedPool: 32000,
};

export const seed140kInv: Investment = {
  ...zero,
  seed: 140000,
  seedPool: 140000,
};

export const workBought = (
  round: number,
  amount: string | number,
  poolSize: string | number,
  presalePrivate: boolean,
) => {
  if (amount === "0" || poolSize === "0") {
    return 0;
  }

  const startPrices = [0.08, 0.14, 0.16];
  const startPrice = startPrices[round] - (round === 2 && presalePrivate ? 0.01 : 0);
  const priceChangePerStep = 0.004;
  const poolStepsArr = [0, 25_000, 75_000, 150_000, 250_000];
  const poolStepDifferences = [25_000, 50_000, 75_000, 100_000];
  const poolStep = poolStepsArr.findIndex(step => step >= Number(poolSize)) - 1;
  const highestPrice = startPrice + priceChangePerStep * 4;
  const currStartPrice = highestPrice - priceChangePerStep * poolStep;
  const poolSizeAlong = Number(poolSize) - poolStepsArr[poolStep];
  const fullStep = poolStepDifferences[poolStep];
  const fractionAlong = Math.floor((Number(poolSizeAlong) * 10000) / fullStep) / 10000;
  const buyPrice = currStartPrice - priceChangePerStep * fractionAlong;
  const calculatedAmount = Number(amount) / buyPrice;

  return Math.ceil(calculatedAmount);
};

export const calculateBuyMoreTokenBalance = (boughtMore: number): number => {
  return Math.ceil(boughtMore / BUY_MORE_PRICE);
};

export const calculateAmountBoughtTotal = (investment: Investment) => {
  const { seed, seedPool, priv, privPool, pre, preDisc, prePool, buyMore } = investment;

  let totalTokensBought = 0;
  if (seed > 0 && seedPool > 0) {
    totalTokensBought += workBought(0, seed, seedPool, false);
  }
  if (priv > 0 && privPool > 0) {
    totalTokensBought += workBought(1, priv, privPool, false);
  }
  if (prePool > 0) {
    if (preDisc > 0) {
      totalTokensBought += workBought(2, preDisc, prePool, true);
    } else if (pre > 0) {
      totalTokensBought += workBought(2, pre, prePool, false);
    }
  }
  if (buyMore > 0) {
    totalTokensBought += calculateBuyMoreTokenBalance(buyMore);
  }
  return totalTokensBought;
};

export const regenerateBuyMore = async (
  wallet = "0xaaaaD8F4c7c14eC33E5a7ec605D4608b5bB410fD",
  tokenNames = ["BUSD"],
  tokenAddresses = [CONSTANTS.BUSD],
): Promise<BuyMore> => {
  const factory = await ethers.getContractFactory("BuyMore");

  const buyMore = (await factory.deploy(wallet, tokenNames, tokenAddresses)) as BuyMore;
  await buyMore.deployed();
  return buyMore;
};

export const targetDecimals: BigNumber = BigNumber.from(36);

export const deNormalizeAmount = (
  amount: BigNumber,
  sourceDecimals: BigNumber = BigNumber.from(CONSTANTS.BUSD_DECIMALS),
): BigNumber => {
  return amount.div(BigNumber.from(10).pow(targetDecimals.sub(sourceDecimals)));
};
