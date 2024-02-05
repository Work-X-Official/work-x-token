import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens, RewardWrapper } from "../../typings";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { amount, amountFormatted, big, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { REWARDS_TOKENS } from "../../tasks/constants/reward.constants";
import {
  getRewardsTokensTotal,
  mineStakeMonths,
  testTokensGetRewardNftIdMonth,
  tokensClaimAndVerifyClaimed,
  testMonthClaimed,
} from "../util/reward.util";

config();

chai.use(solidity);

describe("RewardTokens", () => {
  let nft: GenesisNft;
  let accounts: SignerWithAddress[];

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;

  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let reward: RewardTokens;
  let rewardWrapper: RewardWrapper;

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
    ({
      workToken,
      distribution,
      nft,
      rewardTokens: reward,
    } = await regenerateContracts(accounts, accounts[0].address, startTime));

    await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
  });

  describe("Testing getRewardTotalMonth, total reward function on RewardTokens", async () => {
    it("getRewardTotalMonth is correct month 0, 0", async () => {
      expect(await reward.getRewardTotalMonth(0)).to.equal(0);
    });

    it("getRewardersTotal is correct for month 1 till 40", async () => {
      for (let i = 1; i <= 40; i++) {
        expect(await reward.getRewardTotalMonth(i)).to.equal(amount(REWARDS_TOKENS[i - 1]));
      }
    });

    it("getRewardTotalMonth is correct 0 for month 41, and several months after that", async () => {
      expect(await reward.getRewardTotalMonth(41)).to.equal(0);
      expect(await reward.getRewardTotalMonth(42)).to.equal(0);
      expect(await reward.getRewardTotalMonth(50)).to.equal(0);
      expect(await reward.getRewardTotalMonth(100)).to.equal(0);
      expect(await reward.getRewardTotalMonth(amount(100000000000000))).to.equal(0);
    });
  });

  describe("Testing reward per nft per month from tokens, getRewardNftIdMonth", async () => {
    describe("getRewardNftIdMonth when there are no nfts", async () => {
      it("Before minting, the rewards are 0 for any month", async () => {
        for (let i = 0; i <= 5; i++) {
          expect(await reward.getRewardNftIdMonth(0, i)).to.equal(0);
        }
      });

      it("Before minting, the rewards are 0 for any nftId", async () => {
        for (let i = 0; i <= 5; i++) {
          expect(await reward.getRewardNftIdMonth(i, 1)).to.equal(0);
        }
      });
    });

    describe("getRewardNftIdMonth with single nft receives all rewards", async () => {
      it("Minting a nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting there are tokens, getRewardNftIdMonth returns zero in month 0", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 0)).to.equal(0);
      });

      it("getRewardNftIdMonth is correct all rewards in months 1 - 40 are for nftId1", async () => {
        for (let i = 1; i <= 40; i++) {
          expect(await reward.getRewardNftIdMonth(nftId1, i)).to.equal(amount(REWARDS_TOKENS[i - 1]));
        }
      });

      it("getRewardNftIdMonth is 0 at month 41", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 41)).to.equal(0);
      });
    });

    describe("getRewardNftIdMonth with multiple nfts sharing the rewards from tokens", async () => {
      let minimum1: BigNumber;
      let minimum2: BigNumber;
      let minimum3: BigNumber;
      let totalMinimum: BigNumber;

      it("Minting another nft nft", async () => {
        const amountMint2 = 50000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);
        const amountMint3 = 150000;
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));
        expect(await nft.ownerOf(nftId3)).to.be.equal(nftMinter3.address);

        minimum1 = (await nft.getStaked(nftId1, 0)).stakedAmountMinimum;
        minimum2 = (await nft.getStaked(nftId2, 0)).stakedAmountMinimum;
        minimum3 = (await nft.getStaked(nftId3, 0)).stakedAmountMinimum;
        totalMinimum = minimum1.add(minimum2).add(minimum3);
      });

      it("After minting tokens, getRewardNftIdMonth returns zero in month 0 for all nfts", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 0)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId2, 0)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId3, 0)).to.equal(0);
      });

      it("In all months, all nfts get their poolFraction of the rewards from tokens", async () => {
        for (let i = 0; i <= 40; i++) {
          await testTokensGetRewardNftIdMonth(reward, nft, nftId1, minimum1, totalMinimum, i);
          await testTokensGetRewardNftIdMonth(reward, nft, nftId2, minimum2, totalMinimum, i);
          await testTokensGetRewardNftIdMonth(reward, nft, nftId3, minimum3, totalMinimum, i);
        }
      });

      it("getRewardNftIdMonth is 0 at month 41", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 41)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId2, 41)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId3, 41)).to.equal(0);
      });
    });

    describe("After destroying a nft getRewardNftIdMonth reverts", async () => {
      it("The nft is eligible for rewards", async () => {
        await mineDays(22, network);
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(1);
        expect(await reward.getRewardNftIdMonth(nftId1, 1)).to.not.be.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId1, 2)).to.not.be.equal(0);
      });

      it("The nft is destroyed now in month 0, so would not get rewards in month 2", async () => {
        await nft.connect(nftMinter1).destroyNft(nftId1);
        await expect(reward.getRewardNftIdMonth(nftId1, 1)).to.be.reverted;
        await expect(reward.getRewardNftIdMonth(nftId1, 2)).to.be.reverted;
      });
    });
  });

  describe("Testing approve function", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      await mineDays(22, network);
      await mineDays(30, network);
    });

    it("Should revert when claim when nft has not enough allowance", async () => {
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should Revert when not owner tries to approve", async () => {
      await expect(reward.connect(nftMinter2).approve(nft.address, amount(1000000))).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Allowance is set correctly with approve", async () => {
      await reward.approve(nft.address, amount(1000000));
      const allowance = await workToken.allowance(reward.address, nft.address);
      expect(allowance).to.equal(amount(1000000));
    });
  });

  describe("Testing getClaimable", async () => {
    describe("Simple test getClaimable when there is only 1 nft", async () => {
      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
        ({
          workToken,
          distribution,
          nft,
          rewardTokens: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      });

      it("Mint nft 1", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      });

      it("getClaimable returns 0 initially", async () => {
        expect(await reward.getClaimable(nftId1)).to.equal(0);
      });

      it("Go to starttime getClaimable, current month is zero so returns 0", async () => {
        await mineDays(22, network);
        expect(await reward.getClaimable(nftId1)).to.equal(0);
      });

      it("Go to month 1, getClaimable returns all rewards", async () => {
        await mineDays(30, network);
        expect(await reward.getClaimable(nftId1)).to.equal(amount(REWARDS_TOKENS[0]));
      });

      it("Go to month 2, getClaimable returns rewards from month 1 and month 2", async () => {
        await mineDays(30, network);
        expect(await reward.getClaimable(nftId1)).to.equal(amount(REWARDS_TOKENS[0]).add(amount(REWARDS_TOKENS[1])));
      });

      it("Go to month 39, getClaimable returns rewards from month 1 to month 39", async () => {
        await mineDays(30 * 37, network);
        expect(await nft.getCurrentMonth()).to.equal(39);
        const rewardsTotal = getRewardsTokensTotal();
        expect(await reward.getClaimable(nftId1)).to.equal(amount(rewardsTotal - REWARDS_TOKENS[39]));
      });

      it("Go to month 40, getClaimable returns also the last month rewards", async () => {
        await mineDays(30, network);
        const rewardsTotal = getRewardsTokensTotal();
        expect(await reward.getClaimable(nftId1)).to.equal(amount(rewardsTotal));
      });

      it("Later months the reward does not increase", async () => {
        await mineDays(30, network);
        const rewardsTotal = getRewardsTokensTotal();
        expect(await reward.getClaimable(nftId1)).to.equal(amount(rewardsTotal));
        await mineDays(30, network);
        expect(await reward.getClaimable(nftId1)).to.equal(amount(rewardsTotal));
        await mineDays(30, network);
        expect(await reward.getClaimable(nftId1)).to.equal(amount(rewardsTotal));
        await mineDays(30 * 1000, network);
      });
    });

    describe("getClaimable with multiple nfts", async () => {
      let minimum1: BigNumber;
      let minimum2: BigNumber;
      let minimum3: BigNumber;
      let totalMinimum: BigNumber;

      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
        ({
          workToken,
          distribution,
          nft,
          rewardTokens: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
      });

      it("Mint nft 1,2 and 3", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        const amountMint2 = 50000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        const amountMint3 = 150000;
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));

        minimum1 = (await nft.getStaked(nftId1, 0)).stakedAmountMinimum;
        minimum2 = (await nft.getStaked(nftId2, 0)).stakedAmountMinimum;
        minimum3 = (await nft.getStaked(nftId3, 0)).stakedAmountMinimum;
        totalMinimum = minimum1.add(minimum2).add(minimum3);
      });

      it("getClaimable returns 0 initially", async () => {
        expect(await reward.getClaimable(nftId1)).to.equal(0);
        expect(await reward.getClaimable(nftId2)).to.equal(0);
        expect(await reward.getClaimable(nftId3)).to.equal(0);
      });

      it("Go to starttime getClaimable, current month is zero so returns 0", async () => {
        await mineDays(22, network);
        expect(await reward.getClaimable(nftId1)).to.equal(0);
        expect(await reward.getClaimable(nftId2)).to.equal(0);
        expect(await reward.getClaimable(nftId3)).to.equal(0);
      });

      it("Go to month 1, getClaimable returns for each the reward of month 0", async () => {
        await mineDays(30, network);
        expect(await reward.getClaimable(nftId1)).to.equal(amount(REWARDS_TOKENS[0]).mul(minimum1).div(totalMinimum));
        expect(await reward.getClaimable(nftId2)).to.equal(amount(REWARDS_TOKENS[0]).mul(minimum2).div(totalMinimum));
        expect(await reward.getClaimable(nftId3)).to.equal(amount(REWARDS_TOKENS[0]).mul(minimum3).div(totalMinimum));
      });

      it("Go to month 40, getClaimable returns for each the reward of month 0 to month 39", async () => {
        await mineStakeMonths(nftMinter1, nft, nftId1, 39, network);
        let sumRewards1: BigNumber = big(0);
        let sumRewards2: BigNumber = big(0);
        let sumRewards3: BigNumber = big(0);
        for (const value of REWARDS_TOKENS) {
          sumRewards1 = sumRewards1.add(amount(value).mul(minimum1).div(totalMinimum));
          sumRewards2 = sumRewards2.add(amount(value).mul(minimum2).div(totalMinimum));
          sumRewards3 = sumRewards3.add(amount(value).mul(minimum3).div(totalMinimum));
        }
        expect(await reward.getClaimable(nftId1)).to.equal(sumRewards1);
        expect(await reward.getClaimable(nftId2)).to.equal(sumRewards2);
        expect(await reward.getClaimable(nftId3)).to.equal(sumRewards3);
      });
    });
  });

  describe("Simple claim, error and events", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 41;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await reward.approve(nft.address, amount(1000000));
    });

    it("Cannot claim when the token does not exists", async () => {
      await expect(reward.connect(nftMinter1).claim("0")).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Mint nft 1 and go to startime", async () => {
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);

      await mineDays(22, network);
    });

    it("Should revert when you are not the owner", async () => {
      await expect(reward.connect(nftMinter2).claim(nftId1)).to.be.revertedWith("ClaimNotAllowed");
    });

    it("Right after mint you cannot claim yet, so nothing is transfered", async () => {
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(nft, "Transfer");
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(reward, "Claimed");
    });

    it("During first month (on day 20), nothing to claim", async () => {
      await mineDays(20, network);
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(nft, "Transfer");
    });

    it("On day 30, after 1 month, the getCurrentMonth correctly returns 1", async () => {
      await mineDays(10, network);
      const currentMonth = await nft.getCurrentMonth();
      expect(currentMonth).to.equal(1);
    });

    it("Claim emits a Claimed event and increases the staked of the nft", async () => {
      const stakedBeforeNft1 = Number(ethers.utils.formatEther((await nft.getStaked(nftId1, 1))[0]));
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.emit(reward, "Claimed");
      const stakedAfterNft1 = Number(ethers.utils.formatEther((await nft.getStaked(nftId1, 1))[0]));
      expect(stakedAfterNft1).to.be.gt(stakedBeforeNft1);
    });
  });

  describe("Claim from RewardTokens with RewardWrapper", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 41;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
        rewardWrapper: rewardWrapper,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await reward.approve(nft.address, amount(1000000));
    });

    it("Mint nft 1 and go to startime", async () => {
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);

      await mineDays(22, network);
    });

    it("Set the RewardTokens in the wrapper contract as the only rewardTarget address", async () => {
      await rewardWrapper.setRewarders([reward.address]);
    });

    it("Should revert when using rewardWrapper that has not been set", async () => {
      expect(await reward.rewardWrapper()).to.equal(ethers.constants.AddressZero);
      await expect(rewardWrapper.connect(nftMinter1).claim(nftId1)).to.be.revertedWith("ClaimNotAllowed");
    });

    it("Setting the rewardWrapper works", async () => {
      expect(await reward.rewardWrapper()).to.equal(ethers.constants.AddressZero);
      await reward.setRewardWrapper(rewardWrapper.address);
      expect(await reward.rewardWrapper()).to.equal(rewardWrapper.address);
    });

    it("The rewardWrapper can call claim", async () => {
      await mineDays(30, network);
      await expect(rewardWrapper.connect(nftMinter1).claim(nftId1)).to.emit(reward, "Claimed");
    });

    it("Should revert when you are not the owner of the nft and try to claim through the rewardWrapper", async () => {
      await expect(rewardWrapper.connect(nftMinter2).claim(nftId1)).to.be.revertedWith("NftNotOwned");
    });
  });

  describe("Test claim function, claimed vs getClaimable, two nfts", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await reward.approve(nft.address, amount(1400000));
    });

    it("Mint nft 1,2 and go to startime", async () => {
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      const amountMint2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
      expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);

      await mineDays(22, network);
    });

    it("Go to month 1, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 1, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Go to month 2, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 1, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Go to month 3, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 1, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Go to month 11, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 8, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Go to month 40, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 29, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Go to month 45, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 5, network);
      await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("Total claimed is equal to the total rewards, each claim in each month are rounded down so they are roughly equal", async () => {
      const claimed1 = await reward.connect(nftMinter1).claimed(nftId1);
      const claimed2 = await reward.connect(nftMinter2).claimed(nftId2);
      const claimedTotal = claimed1.add(claimed2);
      const rewardsTotal = getRewardsTokensTotal();
      expect(claimedTotal).to.closeTo(amount(rewardsTotal), amount(1));
    });
  });

  describe("Test correct minimum is used when nothing happens in a month.", async () => {
    describe("Testing correct minimum, with 1 nft, minimum and minimum total should always be equal", async () => {
      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 41;
        ({
          workToken,
          distribution,
          nft,
          rewardTokens: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
        await reward.approve(nft.address, amount(1000000));

        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);

        await mineDays(22, network);
      });

      it("After 1 month, getRewardNftIdMonth, return total rewards in month 1 to nftId 1", async () => {
        await mineDays(30, network);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 1);
      });

      it("Claim and go to month 3 (skip month 2 without doing anything", async () => {
        await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 1);
        await mineDays(30 * 2, network);
      });

      it("In month 3,4,5, getRewardNftIdMonth, return total rewards to nftId 1", async () => {
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 3);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 4);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 5);
      });

      it("Go to month 6, claim and check for later months", async () => {
        await mineDays(30 * 3, network);
        await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 6);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 7);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 8);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 1, 1, 9);
      });
    });

    describe("Testing use of correct minimum with 2 nfts", async () => {
      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 41;
        ({
          workToken,
          distribution,
          nft,
          rewardTokens: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [25000], [0], [0], [0]);
        await reward.approve(nft.address, amount(1000000));

        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
        const amountMint2 = 25000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);

        await mineDays(22, network);
      });

      it("After 1 month, getRewardNftIdMonth, return half the total rewards in month 1 to both nfts", async () => {
        await mineDays(30, network);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 25000, 50000, 1);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 50000, 1);
      });

      it("Claim into nftId 1 and go to month 3 (skip month 2 without doing anything", async () => {
        await tokensClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 25000, 50000, 1);
        await mineDays(30 * 2, network);
      });

      it("In month 3,4,5, getRewardNftIdMonth, nftId 1 received 50000 reward so will get 75/100 share of the reward in later months", async () => {
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000, 3);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000, 4);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000, 5);

        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 100000, 3);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 100000, 4);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 100000, 5);
      });

      it("Go to month 6, claim and check reward and test that rewards are still based on previous months values", async () => {
        await mineDays(30 * 3, network);
        await tokensClaimAndVerifyClaimed(reward, nftId2, nftMinter2);

        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000, 6);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 100000, 6);
      });

      it("Go to month 7, in month 7 rewards based on minimum of month 6 so fractions did not change with claim in month 6", async () => {
        await mineDays(30, network);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000, 7);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000, 100000, 7);
      });

      it("In later months, the claim in month 6 matters and changes the minimum of nftId 2 and minimum total", async () => {
        const claimedNftId2 = amountFormatted(await reward.claimed(nftId2));

        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000 + claimedNftId2, 8);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000 + claimedNftId2, 9);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000 + claimedNftId2, 10);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId1, 75000, 100000 + claimedNftId2, 11);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000 + claimedNftId2, 100000 + claimedNftId2, 8);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000 + claimedNftId2, 100000 + claimedNftId2, 9);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000 + claimedNftId2, 100000 + claimedNftId2, 10);
        await testTokensGetRewardNftIdMonth(reward, nft, nftId2, 25000 + claimedNftId2, 100000 + claimedNftId2, 11);
      });
    });
  });

  describe("Test monthClaimed, it should keep track of the month in which nft last claimed reward", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await reward.approve(nft.address, amount(1400000));
    });

    it("Mint nft 1,2 and go to startime", async () => {
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      const amountMint2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
      expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);

      await mineDays(22, network);
    });

    it("At the start monthClaimed is 0 for both nfts", async () => {
      await testMonthClaimed(reward, [nftId1, nftId2], [0, 0]);
    });

    it("When a nft claims in month 0, month claimed still stays 0", async () => {
      await reward.connect(nftMinter1).claim(nftId1);
      await testMonthClaimed(reward, [nftId1, nftId2], [0, 0]);
    });

    it("In month 1, when you nftId1 claims it updates month last claimed to 1", async () => {
      await mineDays(30, network);
      await reward.connect(nftMinter1).claim(nftId1);
      await testMonthClaimed(reward, [nftId1, nftId2], [1, 0]);
    });

    it("In month 1, 5 days later it when nft Id 1 claims again it stays at id 1", async () => {
      await mineDays(5, network);
      await reward.connect(nftMinter1).claim(nftId1);
      await testMonthClaimed(reward, [nftId1, nftId2], [1, 0]);
    });

    it("In month 2, nft Id 2 claims and monthClaimed for nft Id 2 becomes 2", async () => {
      await mineDays(30, network);
      await reward.connect(nftMinter2).claim(nftId2);
      await testMonthClaimed(reward, [nftId1, nftId2], [1, 2]);
    });

    it("In month 3, nft Id 1 and 2 claim again and monthClaimed for both become 3", async () => {
      await mineDays(30, network);
      await reward.connect(nftMinter1).claim(nftId1);
      await reward.connect(nftMinter2).claim(nftId2);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
    });

    it("Going to later months does not change anything", async () => {
      await mineDays(30, network);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
      await mineDays(30, network);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
      await mineDays(30, network);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
      await mineDays(30, network);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
      await mineDays(30, network);
      await testMonthClaimed(reward, [nftId1, nftId2], [3, 3]);
    });
  });
});
