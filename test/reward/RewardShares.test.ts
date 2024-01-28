import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { RewardShares, RewardWrapper, GenesisNft, WorkToken, TokenDistribution } from "../../typings";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { mineDays, amount, big } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { getLevel, mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LEVEL_SHARES, REWARDS_SHARES, REWARD_LEVEL_MONTH } from "../../tasks/constants/reward.constants";
import {
  mineStakeMonths,
  testSharesGetRewardNftIdMonth,
  sharesClaimAndVerifyClaimed,
  testMonthClaimed,
  testLevelsGetRewardNftIdMonth,
  testCombiGetRewardNftIdMonth,
} from "../util/reward.util";

config();

chai.use(solidity);

describe("RewardShares", () => {
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
  let reward: RewardShares;
  let rewardWrapper: RewardWrapper;

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
    ({
      workToken,
      distribution,
      nft,
      rewardShares: reward,
    } = await regenerateContracts(accounts, accounts[0].address, startTime));

    await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
  });

  describe("Test levelShares", async () => {
    it("Mapping levelShares should be correctly filled by setLevelShares", async () => {
      const levelSharesLength = LEVEL_SHARES.length;
      expect(levelSharesLength).to.equal(81);
      for (let i = 0; i < 81; i++) {
        expect(await reward.levelShares(LEVEL_SHARES[i])).to.equal(i);
      }
    });
  });

  describe("Testing getSharesRewardTotalMonth, total reward function", async () => {
    it("getSharesRewardTotalMonth is correct month 0, 0", async () => {
      expect(await reward.getSharesRewardTotalMonth(0)).to.equal(0);
    });

    it("getSharesRewardTotalMonth is correct for month 1 till 40", async () => {
      for (let i = 1; i <= 40; i++) {
        expect(await reward.getSharesRewardTotalMonth(i)).to.equal(amount(REWARDS_SHARES[i - 1]));
      }
    });

    it("getSharesRewardTotalMonth is correct 0 for month 41, and several months after that", async () => {
      expect(await reward.getSharesRewardTotalMonth(41)).to.equal(0);
      expect(await reward.getSharesRewardTotalMonth(42)).to.equal(0);
      expect(await reward.getSharesRewardTotalMonth(50)).to.equal(0);
      expect(await reward.getSharesRewardTotalMonth(100)).to.equal(0);
      expect(await reward.getSharesRewardTotalMonth(amount(100000000000000))).to.equal(0);
    });
  });

  describe("Testing Reward per nft per month from levels and shares, getRewardNftIdMonth", async () => {
    describe("getRewardNftIdMonth when there are no nfts", async () => {
      it("Before minting, the rewards for month 0 for all nfts are 0", async () => {
        for (let i = 0; i <= 5; i++) {
          expect((await reward.getRewardNftIdMonth(i, 0))._rewardNftIdMonthLevel).to.equal(0);
          expect((await reward.getRewardNftIdMonth(i, 0))._rewardNftIdMonthShares).to.equal(0);
        }
      });

      it("Before minting in month 1 the function reverts when an nft does not exist", async () => {
        for (let i = 0; i <= 5; i++) {
          await expect(reward.getRewardNftIdMonth(i, 1)).to.be.reverted;
        }
      });
    });

    describe("getRewardNftIdMonth with single nft is correctly the sum of getLevelsRewardNftIdMonth and getSharesRewardNftIdMonth", async () => {
      it("Minting an nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));

        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting returns zero in month 0", async () => {
        expect((await reward.getRewardNftIdMonth(nftId1, 0))._rewardNftIdMonthLevel).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId1, 0))._rewardNftIdMonthShares).to.equal(0);
      });

      it("getRewardNftIdMonth._rewardNftIdMonthLevel + ._rewardNftIdMonthShares in all 40 months is the sum of the getLevelsRewardNftIdMonth and getSharesRewardNftIdMonth", async () => {
        for (let i = 1; i <= 40; i++) {
          await testCombiGetRewardNftIdMonth(reward, nft, nftId1, i);
        }
      });

      it("getRewardNftIdMonth shares is 0 at month 41 and level is based on the level", async () => {
        const level = await getLevel(nft, nftId1);
        expect((await reward.getRewardNftIdMonth(nftId1, 41))._rewardNftIdMonthLevel).to.equal(
          level.mul(REWARD_LEVEL_MONTH),
        );
        expect((await reward.getRewardNftIdMonth(nftId1, 41))._rewardNftIdMonthShares).to.equal(0);
      });
    });

    describe("getRewardNftIdMonth with multiple nfts is correctly the sum of getLevelsRewardNftIdMonth and getSharesRewardNftIdMonth", async () => {
      it("Minting another nft nft", async () => {
        const amountMint2 = 50000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);
        const amountMint3 = 150000;
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));
        expect(await nft.ownerOf(nftId3)).to.be.equal(nftMinter3.address);
      });

      it("After minting shares, getRewardNftIdMonth returns zero in month 0 for all nfts", async () => {
        expect((await reward.getRewardNftIdMonth(nftId1, 0))._rewardNftIdMonthLevel).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId1, 0))._rewardNftIdMonthShares).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId2, 0))._rewardNftIdMonthLevel).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId2, 0))._rewardNftIdMonthShares).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId3, 0))._rewardNftIdMonthLevel).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId3, 0))._rewardNftIdMonthShares).to.equal(0);
      });

      it("In months 1-40, getRewardNftIdMonth is sum of getLevelsRewardNftIdMonth and getSharesRewardNftIdMonth", async () => {
        for (let i = 1; i <= 40; i++) {
          await testCombiGetRewardNftIdMonth(reward, nft, nftId1, i);
          await testCombiGetRewardNftIdMonth(reward, nft, nftId2, i);
          await testCombiGetRewardNftIdMonth(reward, nft, nftId3, i);
        }
      });

      it("getRewardersNftIdMonth shares is 0 at month 41 and getRewardersNftIdMonth level it is based on the level ", async () => {
        const levelNft1 = await getLevel(nft, nftId1);
        expect((await reward.getRewardNftIdMonth(nftId1, 41))._rewardNftIdMonthLevel).to.equal(
          levelNft1.mul(REWARD_LEVEL_MONTH),
        );
        const levelNft2 = await getLevel(nft, nftId2);
        expect((await reward.getRewardNftIdMonth(nftId2, 41))._rewardNftIdMonthLevel).to.equal(
          levelNft2.mul(REWARD_LEVEL_MONTH),
        );
        const levelNft3 = await getLevel(nft, nftId3);
        expect((await reward.getRewardNftIdMonth(nftId3, 41))._rewardNftIdMonthLevel).to.equal(
          levelNft3.mul(REWARD_LEVEL_MONTH),
        );

        expect((await reward.getRewardNftIdMonth(nftId1, 41))._rewardNftIdMonthShares).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId2, 41))._rewardNftIdMonthShares).to.equal(0);
        expect((await reward.getRewardNftIdMonth(nftId3, 41))._rewardNftIdMonthShares).to.equal(0);
      });
    });
  });

  describe("Testing Reward per nft per month from Levels, getLevelsRewardNftIdMonth", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));

      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
    });

    describe("getLevelsRewardNftIdMonth when there are no nfts", async () => {
      it("Before minting, the rewards for month 0 for all nfts are 0", async () => {
        for (let i = 0; i <= 5; i++) {
          expect(await reward.getLevelsRewardNftIdMonth(i, 0)).to.equal(0);
        }
      });

      it("Before minting in month 1 the function reverts when an nft does not exist", async () => {
        for (let i = 0; i <= 5; i++) {
          await expect(reward.getLevelsRewardNftIdMonth(i, 1)).to.be.reverted;
        }
      });
    });

    describe("getLevelsRewardNftIdMonth with single nft receives the correct amount based on its level", async () => {
      it("Minting an nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting, it has a level, but getLevelsRewardNftIdMonth returns zero in month 0", async () => {
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 0)).to.equal(0);
      });

      it("getLevelsRewardNftIdMonth is correct in all 40 months, the level times the REWARD_LEVEL_MONTH", async () => {
        const nftIdLevel = (await nft.getNftInfo(nftId1))._level;
        const nftIdMonthReward = nftIdLevel.mul(REWARD_LEVEL_MONTH);
        for (let i = 1; i <= 40; i++) {
          expect(await reward.getLevelsRewardNftIdMonth(nftId1, i)).to.equal(nftIdMonthReward);
        }
      });

      it("getLevelsRewardNftIdMonth is 0 at month 41", async () => {
        const levelNft1 = await getLevel(nft, nftId1);
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 41)).to.equal(levelNft1.mul(REWARD_LEVEL_MONTH));
      });
    });

    describe("getLevelsRewardNftIdMonth with multiple nfts share rewards", async () => {
      let level1: BigNumber;
      let level2: BigNumber;
      let level3: BigNumber;

      it("Minting another nft nft", async () => {
        const amountMint2 = 50000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);
        const amountMint3 = 150000;
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));
        expect(await nft.ownerOf(nftId3)).to.be.equal(nftMinter3.address);

        level1 = (await nft.getNftInfo(nftId1))._level;
        level2 = (await nft.getNftInfo(nftId2))._level;
        level3 = (await nft.getNftInfo(nftId3))._level;
      });

      it("After minting shares, getLevelsRewardNftIdMonth returns zero in month 0 for all nfts", async () => {
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 0)).to.equal(0);
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 0)).to.equal(0);
        expect(await reward.getLevelsRewardNftIdMonth(nftId3, 0)).to.equal(0);
      });

      it("In months 1- 40, all nfts get their rewards based on level and the REWARD_LEVEL_MONTH constant", async () => {
        for (let i = 1; i <= 40; i++) {
          await testLevelsGetRewardNftIdMonth(reward, nft, nftId1, level1, i);
          await testLevelsGetRewardNftIdMonth(reward, nft, nftId2, level2, i);
          await testLevelsGetRewardNftIdMonth(reward, nft, nftId3, level3, i);
        }
      });

      it("getLevelsRewardNftIdMonth is based on level at month 41", async () => {
        const levelNft1 = await getLevel(nft, nftId1);
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 41)).to.equal(levelNft1.mul(REWARD_LEVEL_MONTH));
        const levelNft2 = await getLevel(nft, nftId2);
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 41)).to.equal(levelNft2.mul(REWARD_LEVEL_MONTH));
        const levelNft3 = await getLevel(nft, nftId3);
        expect(await reward.getLevelsRewardNftIdMonth(nftId3, 41)).to.equal(levelNft3.mul(REWARD_LEVEL_MONTH));
      });
    });

    describe("After destroying an nft getLevelsRewardNftIdMonth reverts", async () => {
      it("The nft is eligible for rewards", async () => {
        await mineDays(22, network);
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(1);
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 1)).to.not.be.equal(0);
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 2)).to.not.be.equal(0);
      });

      it("The nft is destroyed now in month 0, so would not get rewards in month 2", async () => {
        await nft.connect(nftMinter1).destroyNft(nftId1);
        await expect(reward.getLevelsRewardNftIdMonth(nftId1, 1)).to.be.reverted;
        await expect(reward.getLevelsRewardNftIdMonth(nftId1, 2)).to.be.reverted;
      });
    });

    describe("getLevelsRewardNftIdMonth, correctly looks at the shares of the previous month", async () => {
      let level1: BigNumber;
      let level2: BigNumber;

      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
        ({
          workToken,
          distribution,
          nft,
          rewardShares: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [0], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [10000], [0], [0], [0]);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
        const amountMint2 = 10000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        level1 = (await nft.getNftInfo(nftId1))._level;
        level2 = (await nft.getNftInfo(nftId2))._level;
      });

      it("Right after mint the rewards in month 1 and 2 are based on the shares in month 0", async () => {
        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 1)).to.equal(level1.mul(REWARD_LEVEL_MONTH));
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 1)).to.equal(level2.mul(REWARD_LEVEL_MONTH));

        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 2)).to.equal(level1.mul(REWARD_LEVEL_MONTH));
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 2)).to.equal(level2.mul(REWARD_LEVEL_MONTH));
      });

      it("Go to month 1 and stake in nftId 1, then the rewardNftIdMonth in month 1 should still be based on the original shares", async () => {
        await mineDays(22, network);
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(1);

        await nft.connect(nftMinter1).stake(nftId1, amount(3000));

        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 1)).to.equal(level1.mul(REWARD_LEVEL_MONTH));
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 1)).to.equal(level2.mul(REWARD_LEVEL_MONTH));
      });

      it("Go to month 2, the rewardNftIdMonth in month 2 should be based on the new shares in month 1, which are more than the old shares", async () => {
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(2);
        const oldLevel1 = level1;
        level1 = (await nft.getNftInfo(nftId1))._level;
        expect(level1).to.be.gt(oldLevel1);
        level2 = (await nft.getNftInfo(nftId2))._level;

        expect(await reward.getLevelsRewardNftIdMonth(nftId1, 2)).to.equal(level1.mul(REWARD_LEVEL_MONTH));
        expect(await reward.getLevelsRewardNftIdMonth(nftId2, 2)).to.equal(level2.mul(REWARD_LEVEL_MONTH));
      });
    });
  });

  describe("Testing Reward per nft per month from Shares, getSharesRewardNftIdMonth", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));

      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
    });

    describe("getSharesRewardNftIdMonth when there are no nfts", async () => {
      it("Before minting, the rewards for month 0 for all nfts are 0", async () => {
        for (let i = 0; i <= 5; i++) {
          expect(await reward.getSharesRewardNftIdMonth(i, 0)).to.equal(0);
        }
      });

      it("Before minting, the rewards are 0 for any nftId", async () => {
        for (let i = 0; i <= 5; i++) {
          await expect(reward.getSharesRewardNftIdMonth(i, 1)).to.be.reverted;
        }
      });
    });

    describe("getSharesRewardNftIdMonth with single nft receives all rewards", async () => {
      it("Minting an nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting there are shares, getSharesRewardNftIdMonth returns zero in month 0", async () => {
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 0)).to.equal(0);
      });

      it("getSharesRewardNftIdMonth is correct all rewards in months 1 - 40 are for nftId1", async () => {
        for (let i = 1; i <= 40; i++) {
          expect(await reward.getSharesRewardNftIdMonth(nftId1, i)).to.equal(amount(REWARDS_SHARES[i - 1]));
        }
      });

      it("getSharesRewardNftIdMonth is 0 at month 41", async () => {
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 41)).to.equal(0);
      });
    });

    describe("getSharesRewardNftIdMonth with multiple nfts share rewards from shares", async () => {
      let shares1: BigNumber;
      let shares2: BigNumber;
      let shares3: BigNumber;
      let totalShares: BigNumber;

      it("Minting another nft nft", async () => {
        const amountMint2 = 50000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);
        const amountMint3 = 150000;
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));
        expect(await nft.ownerOf(nftId3)).to.be.equal(nftMinter3.address);

        shares1 = (await nft.getNftInfo(nftId1))._shares;
        shares2 = (await nft.getNftInfo(nftId2))._shares;
        shares3 = (await nft.getNftInfo(nftId3))._shares;
        totalShares = shares1.add(shares2).add(shares3);
      });

      it("After minting shares, getSharesRewardNftIdMonth returns zero in month 0 for all nfts", async () => {
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 0)).to.equal(0);
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 0)).to.equal(0);
        expect(await reward.getSharesRewardNftIdMonth(nftId3, 0)).to.equal(0);
      });

      it("In months 1 - 4, all nfts get their poolFraction of the rewards", async () => {
        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 1);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 1);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 1);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 2);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 2);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 2);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 3);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 3);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 3);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 4);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 4);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 4);
      });

      it("In month 37-41, all nfts get their poolFraction of the rewards", async () => {
        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 37);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 37);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 37);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 38);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 38);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 38);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 39);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 39);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 39);

        await testSharesGetRewardNftIdMonth(reward, nft, nftId1, shares1, totalShares, 40);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId2, shares2, totalShares, 40);
        await testSharesGetRewardNftIdMonth(reward, nft, nftId3, shares3, totalShares, 40);
      });

      it("getRewardersNftIdMonth is 0 at month 41", async () => {
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 41)).to.equal(0);
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 41)).to.equal(0);
        expect(await reward.getSharesRewardNftIdMonth(nftId3, 41)).to.equal(0);
      });
    });

    describe("After destroying an nft getSharesRewardNftIdMonth reverts", async () => {
      it("The nft is eligible for rewards", async () => {
        await mineDays(22, network);
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(1);
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 1)).to.not.be.equal(0);
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 2)).to.not.be.equal(0);
      });

      it("The nft is destroyed now in month 0, so would not get rewards in month 2", async () => {
        await nft.connect(nftMinter1).destroyNft(nftId1);
        await expect(reward.getSharesRewardNftIdMonth(nftId1, 1)).to.be.reverted;
        await expect(reward.getSharesRewardNftIdMonth(nftId1, 2)).to.be.reverted;
      });
    });

    describe("getSharesRewardNftIdMonth, correctly looks at the shares of the previous month", async () => {
      let shares1: BigNumber;
      let shares2: BigNumber;
      let totalShares: BigNumber;

      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
        ({
          workToken,
          distribution,
          nft,
          rewardShares: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [0], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [10000], [0], [0], [0]);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
        const amountMint2 = 10000;
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
        shares1 = (await nft.getNftInfo(nftId1))._shares;
        shares2 = (await nft.getNftInfo(nftId2))._shares;
        totalShares = shares1.add(shares2);
      });

      it("Right after mint the rewards in month 1 and 2 are based on the shares in month 0", async () => {
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 1)).to.equal(
          amount(REWARDS_SHARES[0]).mul(shares1).div(totalShares),
        );
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 1)).to.equal(
          amount(REWARDS_SHARES[0]).mul(shares2).div(totalShares),
        );
        expect(await reward.getSharesRewardNftIdMonth(nftId1, 2)).to.equal(
          amount(REWARDS_SHARES[1]).mul(shares1).div(totalShares),
        );
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 2)).to.equal(
          amount(REWARDS_SHARES[1]).mul(shares2).div(totalShares),
        );
      });

      it("Go to month 1 and stake in nftId 1, then the rewardSharesNftIdMonth in month 1 should still be based on the original shares", async () => {
        await mineDays(22, network);
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(1);

        await nft.connect(nftMinter1).stake(nftId1, amount(3000));

        expect(await reward.getSharesRewardNftIdMonth(nftId1, 1)).to.equal(
          amount(REWARDS_SHARES[0]).mul(shares1).div(totalShares),
        );
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 1)).to.equal(
          amount(REWARDS_SHARES[0]).mul(shares2).div(totalShares),
        );
      });

      it("Go to month 2, the rewardSharesNftIdMonth in month 2 should be based on the new shares in month 1, which are more than the old shares", async () => {
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(2);
        const oldShares1 = shares1;
        shares1 = (await nft.getNftInfo(nftId1))._shares;
        expect(shares1).to.be.gt(oldShares1);
        shares2 = (await nft.getNftInfo(nftId2))._shares;
        totalShares = shares1.add(shares2);

        expect(await reward.getSharesRewardNftIdMonth(nftId1, 2)).to.equal(
          amount(REWARDS_SHARES[1]).mul(shares1).div(totalShares),
        );
        expect(await reward.getSharesRewardNftIdMonth(nftId2, 2)).to.equal(
          amount(REWARDS_SHARES[1]).mul(shares2).div(totalShares),
        );
      });
    });
  });

  describe("Testing approve function", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
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
    let rewardNftIdMonthSharesSum = big(0);
    let rewardNftIdMonthLevelSum = big(0);

    describe("Simple test getClaimable when there is only 1 nft", async () => {
      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
        ({
          workToken,
          distribution,
          nft,
          rewardShares: reward,
        } = await regenerateContracts(accounts, accounts[0].address, startTime));
        await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      });

      it("Mint nft 1", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      });

      it("getClaimable returns 0 initially", async () => {
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(0);
      });

      it("Go to starttime getRewarNftId, current month is zero so returns 0", async () => {
        await mineDays(22, network);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(0);
      });

      it("Go to month 1, getClaimable returns all rewards", async () => {
        await mineDays(30, network);
        const rewardNftIdMonth = await reward.getRewardNftIdMonth(nftId1, 1);
        rewardNftIdMonthLevelSum = rewardNftIdMonth._rewardNftIdMonthLevel;
        rewardNftIdMonthSharesSum = rewardNftIdMonth._rewardNftIdMonthShares;
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
      });

      it("Go to month 2, getClaimable returns rewards from month 1 and month 2", async () => {
        await mineDays(30, network);
        const rewardNftIdMonth2 = await reward.getRewardNftIdMonth(nftId1, 2);
        const rewardNftIdMonthLevel2 = rewardNftIdMonth2._rewardNftIdMonthLevel;
        const rewardNftIdMonthShares2 = rewardNftIdMonth2._rewardNftIdMonthShares;
        rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel2);
        rewardNftIdMonthSharesSum = rewardNftIdMonthSharesSum.add(rewardNftIdMonthShares2);

        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
      });

      it("Go to month 39, getClaimable returns rewards from month 1 to month 39", async () => {
        await mineDays(30 * 37, network);
        expect(await nft.getCurrentMonth()).to.equal(39);
        for (let i = 3; i <= 39; i++) {
          const rewardNftIdMonth = await reward.getRewardNftIdMonth(nftId1, i);
          const rewardNftIdMonthLevel = rewardNftIdMonth._rewardNftIdMonthLevel;
          const rewardNftIdMonthShares = rewardNftIdMonth._rewardNftIdMonthShares;
          rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel);
          rewardNftIdMonthSharesSum = rewardNftIdMonthSharesSum.add(rewardNftIdMonthShares);
        }
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
      });

      it("Go to month 40, getClaimable returns also the last month rewards", async () => {
        await mineDays(30, network);
        expect(await nft.getCurrentMonth()).to.equal(40);
        const rewardNftIdMonth40 = await reward.getRewardNftIdMonth(nftId1, 40);
        const rewardNftIdMonthLevel40 = rewardNftIdMonth40._rewardNftIdMonthLevel;
        const rewardNftIdMonthShares40 = rewardNftIdMonth40._rewardNftIdMonthShares;
        rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel40);
        rewardNftIdMonthSharesSum = rewardNftIdMonthSharesSum.add(rewardNftIdMonthShares40);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
      });

      it("Later months the reward for shares does not increase, but the reward for levels continues", async () => {
        await mineDays(30, network);
        const rewardNftIdMonth41 = await reward.getRewardNftIdMonth(nftId1, 41);
        const rewardNftIdMonthLevel41 = rewardNftIdMonth41._rewardNftIdMonthLevel;
        rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel41);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
        await mineDays(30, network);
        const rewardNftIdMonth42 = await reward.getRewardNftIdMonth(nftId1, 42);
        const rewardNftIdMonthLevel42 = rewardNftIdMonth42._rewardNftIdMonthLevel;
        rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel42);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
        await mineDays(30, network);
        const rewardNftIdMonth43 = await reward.getRewardNftIdMonth(nftId1, 43);
        const rewardNftIdMonthLevel43 = rewardNftIdMonth43._rewardNftIdMonthLevel;
        rewardNftIdMonthLevelSum = rewardNftIdMonthLevelSum.add(rewardNftIdMonthLevel43);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
        await mineDays(30 * 100, network);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum);
      });
    });

    describe("getClaimable with multiple nfts", async () => {
      let rewardNftIdMonthLevelSum1 = big(0);
      let rewardNftIdMonthLevelSum2 = big(0);
      let rewardNftIdMonthLevelSum3 = big(0);

      let rewardNftIdMonthSharesSum1 = big(0);
      let rewardNftIdMonthSharesSum2 = big(0);
      let rewardNftIdMonthSharesSum3 = big(0);

      before(async () => {
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
        ({
          workToken,
          distribution,
          nft,
          rewardShares: reward,
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
      });

      it("getClaimable returns 0 initially", async () => {
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(0);
        expect((await reward.getClaimable(nftId2))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId2))._claimableShares).to.equal(0);
        expect((await reward.getClaimable(nftId3))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId3))._claimableShares).to.equal(0);
      });

      it("Go to starttime getClaimable, current month is zero so returns 0", async () => {
        await mineDays(22, network);
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(0);
        expect((await reward.getClaimable(nftId2))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId2))._claimableShares).to.equal(0);
        expect((await reward.getClaimable(nftId3))._claimableLevel).to.equal(0);
        expect((await reward.getClaimable(nftId3))._claimableShares).to.equal(0);
      });

      it("Go to month 1, getClaimable returns for each the reward of month 0", async () => {
        await mineDays(30, network);

        const rewardNftIdMonth1 = await reward.getRewardNftIdMonth(nftId1, 1);
        const rewardnftIdMonth2 = await reward.getRewardNftIdMonth(nftId2, 1);
        const rewardNftIdMonth3 = await reward.getRewardNftIdMonth(nftId3, 1);

        rewardNftIdMonthLevelSum1 = rewardNftIdMonth1._rewardNftIdMonthLevel;
        rewardNftIdMonthLevelSum2 = rewardnftIdMonth2._rewardNftIdMonthLevel;
        rewardNftIdMonthLevelSum3 = rewardNftIdMonth3._rewardNftIdMonthLevel;

        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum1);
        expect((await reward.getClaimable(nftId2))._claimableLevel).to.equal(rewardNftIdMonthLevelSum2);
        expect((await reward.getClaimable(nftId3))._claimableLevel).to.equal(rewardNftIdMonthLevelSum3);

        rewardNftIdMonthSharesSum1 = rewardNftIdMonth1._rewardNftIdMonthShares;
        rewardNftIdMonthSharesSum2 = rewardnftIdMonth2._rewardNftIdMonthShares;
        rewardNftIdMonthSharesSum3 = rewardNftIdMonth3._rewardNftIdMonthShares;

        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum1);
        expect((await reward.getClaimable(nftId2))._claimableShares).to.equal(rewardNftIdMonthSharesSum2);
        expect((await reward.getClaimable(nftId3))._claimableShares).to.equal(rewardNftIdMonthSharesSum3);
      });

      it("Go to month 40, getClaimable returns for each the reward of month 0 to month 39", async () => {
        await mineDays(30 * 39, network);
        for (let i = 2; i <= 40; i++) {
          const rewardNftIdMonth1 = await reward.getRewardNftIdMonth(nftId1, i);
          const rewardNftIdMonth2 = await reward.getRewardNftIdMonth(nftId2, i);
          const rewardNftIdMonth3 = await reward.getRewardNftIdMonth(nftId3, i);

          rewardNftIdMonthLevelSum1 = rewardNftIdMonthLevelSum1.add(rewardNftIdMonth1._rewardNftIdMonthLevel);
          rewardNftIdMonthLevelSum2 = rewardNftIdMonthLevelSum2.add(rewardNftIdMonth2._rewardNftIdMonthLevel);
          rewardNftIdMonthLevelSum3 = rewardNftIdMonthLevelSum3.add(rewardNftIdMonth3._rewardNftIdMonthLevel);

          rewardNftIdMonthSharesSum1 = rewardNftIdMonthSharesSum1.add(rewardNftIdMonth1._rewardNftIdMonthShares);
          rewardNftIdMonthSharesSum2 = rewardNftIdMonthSharesSum2.add(rewardNftIdMonth2._rewardNftIdMonthShares);
          rewardNftIdMonthSharesSum3 = rewardNftIdMonthSharesSum3.add(rewardNftIdMonth3._rewardNftIdMonthShares);
        }
        expect((await reward.getClaimable(nftId1))._claimableLevel).to.equal(rewardNftIdMonthLevelSum1);
        expect((await reward.getClaimable(nftId2))._claimableLevel).to.equal(rewardNftIdMonthLevelSum2);
        expect((await reward.getClaimable(nftId3))._claimableLevel).to.equal(rewardNftIdMonthLevelSum3);

        expect((await reward.getClaimable(nftId1))._claimableShares).to.equal(rewardNftIdMonthSharesSum1);
        expect((await reward.getClaimable(nftId2))._claimableShares).to.equal(rewardNftIdMonthSharesSum2);
        expect((await reward.getClaimable(nftId3))._claimableShares).to.equal(rewardNftIdMonthSharesSum3);
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
        rewardShares: reward,
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

  describe("Claim from RewardShares with RewardWrapper", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 41;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
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

    it("Set the RewardShares in the wrapper contract as the only rewardTarget address", async () => {
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

  describe("Test claim function, claimed va claimable", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));
      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
      await reward.approve(nft.address, amount(1400000));
    });

    it("Mint nft 1,2, 3 and go to startime", async () => {
      const amountMint1 = 25000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      const amountMint2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
      expect(await nft.ownerOf(nftId2)).to.be.equal(nftMinter2.address);
      const amountMint3 = 150000;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));
      expect(await nft.ownerOf(nftId3)).to.be.equal(nftMinter3.address);

      await mineDays(22, network);
    });

    it("Go to month 1, claims for each nft the claimable reward", async () => {
      await mineDays(30, network);
      await sharesClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await sharesClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await sharesClaimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });

    it("Go to month 11, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 11, network);
      await sharesClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await sharesClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await sharesClaimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });

    it("Go to month 40, claims for each nft the claimable reward", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 29, network);
      await sharesClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await sharesClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await sharesClaimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });

    it("Go to month 45 and claim", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 5, network);
      await sharesClaimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await sharesClaimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await sharesClaimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });
  });

  describe("Test monthClaimed, it should keep track of the month in which nft last claimed reward", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
      ({
        workToken,
        distribution,
        nft,
        rewardShares: reward,
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
