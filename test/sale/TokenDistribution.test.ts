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

    it("Should be possible to change the distribution startTime to a new one if block.timestamp is before old startTime", async () => {
      await mineDays(1, network);
      const startTimeToSet = (await ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 24;
      await distribution.startDistribution(startTimeToSet);
      const startTimeNew = (await distribution.startTime()).toNumber();
      expect(startTimeNew).to.eq(startTimeToSet);
    });

    it("Should not be possible to change the distribution startTime to a new one if block.timestamp is before old startTime", async () => {
      await mineDays(1, network);
      const startTimeToSet = (await ethers.provider.getBlock("latest")).timestamp;
      await expectToRevert(
        distribution.startDistribution(startTimeToSet),
        "TokenDistribution: The token distribution has already started",
      );
    });
  });

  describe("Claimable Amount", () => {
    describe("Test averageMonths", () => {
      it("Should return the correct vesting length month if invested only in one round", () => {
        expect(avgMonthsVest({ ...zeroInv, seed: 50000, seedPool: 50000 })).to.equal(VESTING_LENGHT_SEED_MONTHS);
        expect(avgMonthsVest({ ...zeroInv, priv: 50000, privPool: 50000 })).to.equal(VESTING_LENGHT_PRIVATE_MONTHS);
        expect(avgMonthsVest({ ...zeroInv, pre: 5000, prePool: 50000 })).to.equal(VESTING_LENGHT_PRESALE_MONTHS);
      });

      it("Should be skewed towards the longer vesting from the cheaper seed round when investments in seed and private are the same", () => {
        const avg = avgMonthsVest({ ...zeroInv, seed: 5000, seedPool: 50000, priv: 5000, privPool: 50000 });
        expect(avg).to.be.greaterThan((VESTING_LENGHT_SEED_MONTHS + VESTING_LENGHT_PRIVATE_MONTHS) / 2);
      });

      it("Should have the same amount of months for private presale and public presale, because it is the same round with the same vesting", () => {
        const avgPri = avgMonthsVest({ ...zeroInv, preDisc: 5000, prePool: 50000 });
        const avgPub = avgMonthsVest({ ...zeroInv, pre: 5000, prePool: 50000 });
        expect(avgPri).to.be.equal(avgPub);
      });
    });

    it("Return 0 if no time has passed", async () => {
      startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
      distribution = await regenerateTokenDistribution(startTime, workToken);
      await setClaimable(accounts[0], 0, "1000", distribution);
      expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
    });

    describe("First step sector [0 - 25,000]", () => {
      let claimable: BigNumber;
      it("Return correct total reported amount based on vesting", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 0, [0, 0, 1000], [0, 0, 6000], startTime);
      });

      it("Revert if minting tokens without having the minter role. No tokens are claimable", async () => {
        await workToken.revokeRole(await workToken.MINTER_ROLE(), distribution.address);
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        const claimableTokensBySenderBefore = await distribution.claimableTokens(accounts[0].address);
        await expectToRevert(
          distribution.claimTokens(),
          `AccessControl: account ${distribution.address.toLowerCase()} is missing role ${await workToken.MINTER_ROLE()}`,
        );
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        const claimableTokensBySenderAfter = await distribution.claimableTokens(accounts[0].address);
        expect(balanceBefore).to.eq(balanceAfter).to.eq(big(0));
        expect(claimableTokensBySenderBefore).to.eq(claimableTokensBySenderAfter);
      });

      it("Mint the correct tokens that are claimable", async () => {
        await workToken.grantRole(await workToken.MINTER_ROLE(), distribution.address);
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await claimTokens(distribution);
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });

      it("Return the correct claimable amount after claiming", async () => {
        await mineDays(10, network);
        const claimed = await distribution.claimedTokens(accounts[0].address);
        const claimableLocal = await distribution.claimableTokens(accounts[0].address);
        const vestedTokens = await distribution.vestedTokens(accounts[0].address);
        expect(vestedTokens.sub(claimed)).to.eq(claimableLocal);
      });

      it("Calculate reported vested amount if over vested 2 years", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 730, [1000, 1000, 1000], [6000, 6000, 6000], startTime);
        expect(await distribution.vestedTokens(accounts[0].address))
          .to.eq(await distribution.claimableTokens(accounts[0].address))
          .to.eq(claimable);
      });

      it("Remain 0 after claiming and time passes", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await distribution.claimTokens();
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);
        await mineDays(99999, network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });
    });

    describe("Second step sector [25,000 - 75,000]", () => {
      let claimable: BigNumber;
      const investment = [30_000, 30_000, 30_000];
      const pools = [30_000, 30_000, 30_000];
      it("Return correct total reported amount based on vesting", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 0, investment, pools, startTime);
      });

      it("Mint the correct tokens that are claimable", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await distribution.claimTokens();
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        const timeElapsed = (await ethers.provider.getBlock("latest")).timestamp - startTime;
        const total = expectedVestedTotal(timeElapsed, investment, pools);
        expect(balanceAfter.sub(balanceBefore)).to.eq(total);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });

      it("Return the correct claimable amount after claiming", async () => {
        await mineDays(10, network);
        const claimed = await distribution.claimedTokens(accounts[0].address);
        const claimableLocal = await distribution.claimableTokens(accounts[0].address);
        const vestedTokens = await distribution.vestedTokens(accounts[0].address);
        expect(vestedTokens.sub(claimed)).to.eq(claimableLocal);
      });

      it("Calculate reported vested amount if over vested time", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 720, investment, pools, startTime);
        expect(await distribution.vestedTokens(accounts[0].address))
          .to.eq(await distribution.claimableTokens(accounts[0].address))
          .to.eq(claimable);
      });

      it("remain 0 after claiming and time passes", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await distribution.claimTokens();
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);

        await mineDays(2, network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });
    });

    describe("Third step sector [75,000 - 150,000]", () => {
      let claimable: BigNumber;
      const days = 10;
      const investment = [25_000, 25_000, 25_000];
      const pools = [80_000, 80_000, 80_000];
      it("return correct total reported amount based on vesting", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], days, investment, pools, startTime);
      });

      it("Mint the correct tokens that are claimable", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await claimTokens(distribution);
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        const timeElapsed = (await ethers.provider.getBlock("latest")).timestamp - startTime;
        const total = expectedVestedTotal(timeElapsed, investment, pools);
        expect(balanceAfter.sub(balanceBefore)).to.eq(total);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });

      it("Return the correct claimable amount after claiming", async () => {
        await mineDays(10, network);
        const claimed = await distribution.claimedTokens(accounts[0].address);
        const claimableLocal = await distribution.claimableTokens(accounts[0].address);
        const vestedTokens = await distribution.vestedTokens(accounts[0].address);
        expect(vestedTokens.sub(claimed)).to.eq(claimableLocal);
      });

      it("Calculate reported vested amount if over vested time", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 720, investment, pools, startTime);
        expect(await distribution.vestedTokens(accounts[0].address))
          .to.eq(await distribution.claimableTokens(accounts[0].address))
          .to.eq(claimable);
      });

      it("Remain 0 after claiming and time passes", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await distribution.claimTokens();
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);

        await mineDays(2, network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });
    });

    describe("Fourth step sector [150,000 - 250,000]", () => {
      let claimable: BigNumber;
      const investment = [10_000, 10_000, 10_000];
      const pools = [190_000, 190_000, 190_000];
      it("Return correct total reported amount based on vesting", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 10, investment, pools, startTime);
      });

      it("Mint the correct tokens that are claimable", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await claimTokens(distribution);
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        const timeElapsed = (await ethers.provider.getBlock("latest")).timestamp - startTime;
        const total = expectedVestedTotal(timeElapsed, investment, pools);
        expect(balanceAfter.sub(balanceBefore)).to.eq(total);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });

      it("Return the correct claimable amount after claiming", async () => {
        await mineDays(10, network);
        const claimed = await distribution.claimedTokens(accounts[0].address);
        const claimableLocal = await distribution.claimableTokens(accounts[0].address);
        const vestedTokens = await distribution.vestedTokens(accounts[0].address);
        expect(vestedTokens.sub(claimed)).to.eq(claimableLocal);
      });

      it("Calculate reported vested amount if over vested time", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 730, investment, pools, startTime);
        expect(await distribution.vestedTokens(accounts[0].address))
          .to.eq(await distribution.claimableTokens(accounts[0].address))
          .to.eq(claimable);
      });

      it("Remain 0 after claiming and time passes", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await distribution.claimTokens();
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);

        await mineDays(2, network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
      });
    });

    describe("Presale: vest 10% at once, then the rest of the month nothing", () => {
      let claimable: BigNumber;

      it("Return correct total reported amount based on vesting", async () => {
        startTime = (await ethers.provider.getBlock("latest")).timestamp + 4;
        claimable = await testInvestAndVest(accounts[0], 0, [0, 0, 10_000], [0, 0, 190_000], startTime);
      });

      it("Claim 10% of the total tokens on the first day", async () => {
        const balanceBefore = await workToken.balanceOf(accounts[0].address);
        await claimTokens(distribution);
        const balanceAfter = await workToken.balanceOf(accounts[0].address);
        const expected = big(workBought(2, 10_000, 190_000, false)).mul(big(10).pow(17));
        expect(balanceAfter.sub(balanceBefore)).to.eq(claimable);
        expect(balanceAfter.sub(balanceBefore)).to.eq(expected);
      });

      it("During the first 10% of the vesting period nothing more can be claimed, when it is over we can claim more", async () => {
        await timeTravel(vestingPeriod3Cliff - daysToSeconds(1), network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.equal(big(0));
        await mineDays(1, network);
        expect(await distribution.claimableTokens(accounts[0].address)).to.not.equal(big(0));
      });
    });
  });

  const testInvestAndVest = async (
    investor: SignerWithAddress,
    vestingTimeDays: number,
    investment: number[],
    poolSizes: number[],
    startTime: number,
  ): Promise<BigNumber> => {
    distribution = await regenerateTokenDistribution(startTime, workToken);
    await setClaimableByInvestment(investor.address, investment, poolSizes, distribution);
    await mineDays(vestingTimeDays, network);
    const timeElapsed = (await ethers.provider.getBlock("latest")).timestamp - startTime;
    const total = expectedVestedTotal(timeElapsed, investment, poolSizes);
    const vestedTokens = await distribution.vestedTokens(accounts[0].address);
    const claimableTokens = await distribution.claimableTokens(accounts[0].address);
    expect(vestedTokens).to.eq(total).to.eq(claimableTokens);
    return claimableTokens;
  };
});
