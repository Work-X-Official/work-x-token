import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens } from "../../typings";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { amount, big, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { REWARDS } from "../constants/rewards.constants";
import { getRewardsTotal } from "../util/rewards.util";

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

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 31;
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

  describe("Testing the total reward from tokens, getRewardTotalMonth", async () => {
    it("getRewardTotalMonth is correct month 0, 0", async () => {
      expect(await reward.getRewardTotalMonth(0)).to.equal(0);
    });

    it("getRewardsTotal is correct for month 1 till 40", async () => {
      expect(await reward.getRewardTotalMonth(1)).to.equal(amount(REWARDS[0]));
      expect(await reward.getRewardTotalMonth(2)).to.equal(amount(REWARDS[1]));
      expect(await reward.getRewardTotalMonth(3)).to.equal(amount(REWARDS[2]));
      expect(await reward.getRewardTotalMonth(4)).to.equal(amount(REWARDS[3]));
      expect(await reward.getRewardTotalMonth(5)).to.equal(amount(REWARDS[4]));
      expect(await reward.getRewardTotalMonth(6)).to.equal(amount(REWARDS[5]));
      expect(await reward.getRewardTotalMonth(7)).to.equal(amount(REWARDS[6]));
      expect(await reward.getRewardTotalMonth(8)).to.equal(amount(REWARDS[7]));
      expect(await reward.getRewardTotalMonth(9)).to.equal(amount(REWARDS[8]));
      expect(await reward.getRewardTotalMonth(10)).to.equal(amount(REWARDS[9]));
      expect(await reward.getRewardTotalMonth(11)).to.equal(amount(REWARDS[10]));
      expect(await reward.getRewardTotalMonth(12)).to.equal(amount(REWARDS[11]));
      expect(await reward.getRewardTotalMonth(13)).to.equal(amount(REWARDS[12]));
      expect(await reward.getRewardTotalMonth(14)).to.equal(amount(REWARDS[13]));
      expect(await reward.getRewardTotalMonth(15)).to.equal(amount(REWARDS[14]));
      expect(await reward.getRewardTotalMonth(16)).to.equal(amount(REWARDS[15]));
      expect(await reward.getRewardTotalMonth(17)).to.equal(amount(REWARDS[16]));
      expect(await reward.getRewardTotalMonth(18)).to.equal(amount(REWARDS[17]));
      expect(await reward.getRewardTotalMonth(19)).to.equal(amount(REWARDS[18]));
      expect(await reward.getRewardTotalMonth(20)).to.equal(amount(REWARDS[19]));
      expect(await reward.getRewardTotalMonth(21)).to.equal(amount(REWARDS[20]));
      expect(await reward.getRewardTotalMonth(22)).to.equal(amount(REWARDS[21]));
      expect(await reward.getRewardTotalMonth(23)).to.equal(amount(REWARDS[22]));
      expect(await reward.getRewardTotalMonth(24)).to.equal(amount(REWARDS[23]));
      expect(await reward.getRewardTotalMonth(25)).to.equal(amount(REWARDS[24]));
      expect(await reward.getRewardTotalMonth(26)).to.equal(amount(REWARDS[25]));
      expect(await reward.getRewardTotalMonth(27)).to.equal(amount(REWARDS[26]));
      expect(await reward.getRewardTotalMonth(28)).to.equal(amount(REWARDS[27]));
      expect(await reward.getRewardTotalMonth(29)).to.equal(amount(REWARDS[28]));
      expect(await reward.getRewardTotalMonth(30)).to.equal(amount(REWARDS[29]));
      expect(await reward.getRewardTotalMonth(31)).to.equal(amount(REWARDS[30]));
      expect(await reward.getRewardTotalMonth(32)).to.equal(amount(REWARDS[31]));
      expect(await reward.getRewardTotalMonth(33)).to.equal(amount(REWARDS[32]));
      expect(await reward.getRewardTotalMonth(34)).to.equal(amount(REWARDS[33]));
      expect(await reward.getRewardTotalMonth(35)).to.equal(amount(REWARDS[34]));
      expect(await reward.getRewardTotalMonth(36)).to.equal(amount(REWARDS[35]));
      expect(await reward.getRewardTotalMonth(37)).to.equal(amount(REWARDS[36]));
      expect(await reward.getRewardTotalMonth(38)).to.equal(amount(REWARDS[37]));
      expect(await reward.getRewardTotalMonth(39)).to.equal(amount(REWARDS[38]));
      expect(await reward.getRewardTotalMonth(40)).to.equal(amount(REWARDS[39]));
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
        expect(await reward.getRewardNftIdMonth(0, 0)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(0, 1)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(0, 2)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(0, 3)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(0, 4)).to.equal(0);
      });

      it("Before minting, the rewards are 0 for any nftId", async () => {
        expect(await reward.getRewardNftIdMonth(0, 1)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(1, 1)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(2, 1)).to.equal(0);
      });
    });

    describe("getRewardNftIdMonth with single nft receives all rewards", async () => {
      it("Minting an nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting there are tokens, getRewardNftIdMonth returns zero in month 0", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 0)).to.equal(0);
      });

      it("getRewardNftIdMonth is correct all rewards in months 1 - 15  and 35-40 are for nftId1", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 1)).to.equal(amount(REWARDS[0]));
        expect(await reward.getRewardNftIdMonth(nftId1, 2)).to.equal(amount(REWARDS[1]));
        expect(await reward.getRewardNftIdMonth(nftId1, 3)).to.equal(amount(REWARDS[2]));
        expect(await reward.getRewardNftIdMonth(nftId1, 4)).to.equal(amount(REWARDS[3]));
        expect(await reward.getRewardNftIdMonth(nftId1, 5)).to.equal(amount(REWARDS[4]));
        expect(await reward.getRewardNftIdMonth(nftId1, 6)).to.equal(amount(REWARDS[5]));
        expect(await reward.getRewardNftIdMonth(nftId1, 7)).to.equal(amount(REWARDS[6]));
        expect(await reward.getRewardNftIdMonth(nftId1, 8)).to.equal(amount(REWARDS[7]));
        expect(await reward.getRewardNftIdMonth(nftId1, 9)).to.equal(amount(REWARDS[8]));
        expect(await reward.getRewardNftIdMonth(nftId1, 10)).to.equal(amount(REWARDS[9]));
        expect(await reward.getRewardNftIdMonth(nftId1, 11)).to.equal(amount(REWARDS[10]));
        expect(await reward.getRewardNftIdMonth(nftId1, 12)).to.equal(amount(REWARDS[11]));
        expect(await reward.getRewardNftIdMonth(nftId1, 13)).to.equal(amount(REWARDS[12]));
        expect(await reward.getRewardNftIdMonth(nftId1, 14)).to.equal(amount(REWARDS[13]));
        expect(await reward.getRewardNftIdMonth(nftId1, 15)).to.equal(amount(REWARDS[14]));

        expect(await reward.getRewardNftIdMonth(nftId1, 36)).to.equal(amount(REWARDS[35]));
        expect(await reward.getRewardNftIdMonth(nftId1, 37)).to.equal(amount(REWARDS[36]));
        expect(await reward.getRewardNftIdMonth(nftId1, 38)).to.equal(amount(REWARDS[37]));
        expect(await reward.getRewardNftIdMonth(nftId1, 39)).to.equal(amount(REWARDS[38]));
        expect(await reward.getRewardNftIdMonth(nftId1, 40)).to.equal(amount(REWARDS[39]));
      });

      it("getRewardsNftIdMonth is 0 at month 41", async () => {
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

      it("After minting shares, getRewardNftIdMonth returns zero in month 0 for all nfts", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 0)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId2, 0)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId3, 0)).to.equal(0);
      });

      it("In months 1- 4, all nfts get their poolFraction of the rewards", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 1)).to.equal(
          amount(REWARDS[0]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 1)).to.equal(
          amount(REWARDS[0]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 1)).to.equal(
          amount(REWARDS[0]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 2)).to.equal(
          amount(REWARDS[1]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 2)).to.equal(
          amount(REWARDS[1]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 2)).to.equal(
          amount(REWARDS[1]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 3)).to.equal(
          amount(REWARDS[2]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 3)).to.equal(
          amount(REWARDS[2]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 3)).to.equal(
          amount(REWARDS[2]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 4)).to.equal(
          amount(REWARDS[3]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 4)).to.equal(
          amount(REWARDS[3]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 4)).to.equal(
          amount(REWARDS[3]).mul(minimum3).div(totalMinimum),
        );
      });

      it("In month 37-41, all nfts get their poolFraction of the rewards", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 37)).to.equal(
          amount(REWARDS[36]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 37)).to.equal(
          amount(REWARDS[36]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 37)).to.equal(
          amount(REWARDS[36]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 38)).to.equal(
          amount(REWARDS[37]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 38)).to.equal(
          amount(REWARDS[37]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 38)).to.equal(
          amount(REWARDS[37]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 39)).to.equal(
          amount(REWARDS[38]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 39)).to.equal(
          amount(REWARDS[38]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 39)).to.equal(
          amount(REWARDS[38]).mul(minimum3).div(totalMinimum),
        );

        expect(await reward.getRewardNftIdMonth(nftId1, 40)).to.equal(
          amount(REWARDS[39]).mul(minimum1).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId2, 40)).to.equal(
          amount(REWARDS[39]).mul(minimum2).div(totalMinimum),
        );
        expect(await reward.getRewardNftIdMonth(nftId3, 40)).to.equal(
          amount(REWARDS[39]).mul(minimum3).div(totalMinimum),
        );
      });

      it("getRewardsNftIdMonth is 0 at month 41", async () => {
        expect(await reward.getRewardNftIdMonth(nftId1, 41)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId2, 41)).to.equal(0);
        expect(await reward.getRewardNftIdMonth(nftId3, 41)).to.equal(0);
      });
    });

    describe("After destroying an nft getRewardNftIdMonth reverts", async () => {
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
});
