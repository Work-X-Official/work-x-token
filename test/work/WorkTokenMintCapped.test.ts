import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { expectToRevert, big, mineDays, timeTravel, daysToSeconds } from "../util/helpers.util";
import { TokenDistribution, WorkToken } from "../../typings";
import { BigNumber } from "ethers";
import {
  avgMonthsVest,
  claimTokens,
  expectedVestedTotal,
  regenerateTokenDistribution,
  setClaimable,
  setClaimableByInvestment,
} from "../util/distribution.util";
import { vestingPeriod3Cliff, workBought, zeroInv } from "../util/sale.util";
import {
  VESTING_LENGHT_PRESALE_MONTHS,
  VESTING_LENGHT_PRIVATE_MONTHS,
  VESTING_LENGHT_SEED_MONTHS,
} from "../../tasks/constants/sale.constants";

describe("TokenDistribution", function () {
  let distribution: TokenDistribution;
  let accounts: SignerWithAddress[];
  let workToken: WorkToken;
  let startTime: number;

  this.beforeAll(async () => {
    accounts = await ethers.getSigners();
    workToken = (await (await ethers.getContractFactory("WorkToken")).deploy()) as WorkToken;
  });

  describe("Distribution Start", () => {
    before(async () => {
      startTime = (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 48;
      distribution = await regenerateTokenDistribution(startTime, workToken);
    });
  });
});
