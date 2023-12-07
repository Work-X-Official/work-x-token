import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TokenDistribution, WorkToken } from "../../typings";
import { Investment, vestingPeriod3Cliff, vestingPeriods } from "./sale.util";
import { BigNumber } from "ethers";
import { amount, big } from "./helpers.util";
import {
  VESTING_LENGHT_PRESALE_MONTHS,
  VESTING_LENGHT_PRIVATE_MONTHS,
  VESTING_LENGHT_SEED_MONTHS,
} from "../../tasks/constants/sale.constants";
import { ethers } from "hardhat";
import { workBought } from "../../tasks/util/utils";

export const regenerateTokenDistribution = async (
  _startTime: number,
  workToken: WorkToken,
  deployer: SignerWithAddress,
): Promise<TokenDistribution> => {
  if (_startTime == null) {
    _startTime = (await ethers.provider.getBlock("latest")).timestamp;
  }
  const distribution = (await (
    await ethers.getContractFactory("TokenDistribution")
  ).deploy(workToken.address, _startTime)) as TokenDistribution;
  await workToken.grantRole(await workToken.MINTER_ROLE(), distribution.address);
  await distribution.grantRole(await distribution.INIT_ROLE(), deployer.address);
  return distribution;
};

export const startLater = async (blocks: number, distribution: TokenDistribution) => {
  await distribution.startDistribution((await distribution.startTime()).toNumber() + blocks + 1);
};

export const claimTokens = async (distribution: TokenDistribution) => {
  await distribution.claimTokens();
};

export const setClaimable = async (
  account: SignerWithAddress,
  round: number,
  amount: string,
  distribution: TokenDistribution,
) => {
  const amount1 = round == 0 ? amount : "0";
  const amount2 = round == 1 ? amount : "0";
  const amount3 = round == 2 ? amount : "0";
  await distribution.setWalletClaimable([account.address], [amount1], [amount2], [amount3], [0]);
};

export const setClaimableByInvestment = async (
  wallet: string,
  invests: number[],
  poolSizes: number[],
  distribution: TokenDistribution,
  preClaimed: number = 0,
) => {
  // await startLater(1, distribution);
  await distribution.setWalletClaimable(
    [wallet],
    [invests[0] > 0 ? workBought(0, invests[0], poolSizes[0], false) : 0],
    [invests[1] > 0 ? workBought(1, invests[1], poolSizes[1], false) : 0],
    [invests[2] > 0 ? workBought(2, invests[2], poolSizes[2], false) : 0],
    [preClaimed],
  );
};

export function maxLockLength(averageMonths: number): number {
  return averageMonths - (averageMonths * 1) / 3;
}

export function avgMonthsVest(investment: Investment): number {
  const { seed, seedPool, priv, privPool, pre, preDisc, prePool, buyMore } = investment;
  if (seed === 0 && priv === 0 && pre === 0 && preDisc === 0 && buyMore === 0) {
    throw new Error("No Investment");
  }

  let tokenBalanceSeed = 0;
  let tokenBalancePrivate = 0;
  let tokenBalancePresale = 0;
  if (seed > 0 && seedPool > 0) tokenBalanceSeed = workBought(0, seed, seedPool, false);
  if (priv > 0 && privPool > 0) tokenBalancePrivate = workBought(1, priv, privPool, false);
  if (prePool > 0) {
    if (preDisc > 0) {
      tokenBalancePresale = workBought(2, preDisc, prePool, true);
    } else if (pre > 0) {
      tokenBalancePresale = workBought(2, pre, prePool, false);
    }
  }

  if (tokenBalanceSeed + tokenBalancePrivate + tokenBalancePresale > 0) {
    const averageMonths =
      (tokenBalanceSeed * VESTING_LENGHT_SEED_MONTHS +
        tokenBalancePrivate * VESTING_LENGHT_PRIVATE_MONTHS +
        tokenBalancePresale * VESTING_LENGHT_PRESALE_MONTHS) /
      (tokenBalancePresale + tokenBalancePrivate + tokenBalanceSeed);
    return averageMonths;
  } else {
    return 0;
  }
}

export const expectedVestedTotal = (timeElapsed: number, invests: number[], poolSizes: number[]): BigNumber => {
  const expected: BigNumber[] = [];
  for (let index = 0; index < invests.length; index++) {
    if (invests[index] > 0) {
      const boughtInRound = workBought(index, invests[index], poolSizes[index], false);
      if (timeElapsed > vestingPeriods[index]) {
        expected.push(amount(boughtInRound));
      } else {
        if (index === 2 && timeElapsed < vestingPeriod3Cliff) {
          expected.push(amount(boughtInRound).div(10));
        } else {
          expected.push(amount(boughtInRound).mul(timeElapsed).div(vestingPeriods[index]));
        }
      }
    } else {
      expected.push(big(0));
    }
  }
  return expected.map(value => value).reduce((acc: BigNumber, value) => acc.add(value), big(0));
};
