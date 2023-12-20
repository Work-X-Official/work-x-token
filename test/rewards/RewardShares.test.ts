import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { RewardShares, GenesisNft, WorkToken, TokenDistribution } from "../../typings";

import { ethers, network } from "hardhat";

import { mineDays, amount } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";

import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { REWARDS } from "../constants/rewards.constants";

config();

chai.use(solidity);

describe("RewardShares", () => {
  let nft: GenesisNft;
  let signer: SignerWithAddress;
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

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();

    signer = accounts[0];

    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 28;
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

  describe("Startime Testing", async () => {
    it("The nft and reward startTime are initially the same", async () => {
      const nftStartTime = await reward.startTime();
      const rewardStartTime = await reward.startTime();
      expect(nftStartTime).to.not.equal(0);
      expect(nftStartTime).to.equal(rewardStartTime);
    });
    it("The nft starttime can be changed then the reward starttime is different", async () => {
      const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      const dayAheadTimeStamp = currentBlockTimestamp + 86400;
      await nft.setStartTime(dayAheadTimeStamp);
      const nftStartTime = await nft.startTime();
      const rewardStartTime = await reward.startTime();
      expect(nftStartTime).to.not.equal(rewardStartTime);
      expect(nftStartTime).to.equal(dayAheadTimeStamp);
    });

    it("The reward starttime can become synced again, but calling the sync function", async () => {
      const nftStartTime = await nft.startTime();
      await reward.syncStartTime();
      const rewardStartTime = await reward.startTime();
      expect(nftStartTime).to.equal(rewardStartTime);
    });
  });

  describe("Testing the Total Reward from Shares", async () => {
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

  describe("getRewardNftIdMonth", async () => {
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

    describe("getRewardNftIdMonth with different amounts with a single nft so receives all rewards", async () => {
      it("Minting an nft", async () => {
        const amountMint1 = 25000;
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
        expect(await nft.ownerOf(nftId1)).to.be.equal(nftMinter1.address);
      });

      it("After minting there are shares, getRewardNftIdMonth returns zero in month 0", async () => {
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
  });

  describe("Mint and Simple Claim", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 29;
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

    it("Cannot claim when the token does not exists", async () => {
      await expect(reward.connect(nftMinter1).claim("0")).to.be.revertedWith("ERC721: invalid token ID");
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

    it("Right after mint you cannot claim yet, so nothing is transfered", async () => {
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(nft, "Transfer");
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(reward, "Claimed");
      await expect(reward.connect(nftMinter2).claim(nftId2)).to.not.emit(nft, "Transfer");
      await expect(reward.connect(nftMinter2).claim(nftId2)).to.not.emit(reward, "Claimed");
      await expect(reward.connect(nftMinter3).claim(nftId3)).to.not.emit(nft, "Transfer");
      await expect(reward.connect(nftMinter3).claim(nftId3)).to.not.emit(reward, "Claimed");
    });

    it("During first month (on day 20), nothing to claim.", async () => {
      await mineDays(20, network);
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.not.emit(nft, "Transfer");
    });

    it("On day 30, after 1 month, the getCurrentMonth correctly returns 1", async () => {
      await mineDays(10, network);
      const currentMonth = await reward.getCurrentMonth();
      expect(currentMonth).to.equal(1);
    });

    it("The levels and shares the nfts are correct", async () => {
      const nftInfo1 = await nft.getNftInfo(nftId1);
      expect(nftInfo1._level).to.equal(29);
      expect(nftInfo1._shares).to.equal(50 + 52);

      const nftInfo2 = await nft.getNftInfo(nftId2);
      expect(nftInfo2._level).to.equal(44);
      expect(nftInfo2._shares).to.equal(50 + 104);

      const nftInfo3 = await nft.getNftInfo(nftId3);
      expect(nftInfo3._shares).to.equal(50 + 307);
      expect(nftInfo3._level).to.equal(79);
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

    it("Claim emits a Claimed event and increases the staked of the nft", async () => {
      const stakedBeforeNft1 = Number(ethers.utils.formatEther((await nft.getStaked(nftId1, 1))[0]));
      await expect(reward.connect(nftMinter1).claim(nftId1)).to.emit(reward, "Claimed");
      const stakedAfterNft1 = Number(ethers.utils.formatEther((await nft.getStaked(nftId1, 1))[0]));
      expect(stakedAfterNft1).to.be.gt(stakedBeforeNft1);
    });
  });
});
