import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens } from "../../typings";
import { ethers, network } from "hardhat";
import { amount, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { testMonthClaimed } from "../util/reward.util";
import { REWARDS } from "../../tasks/constants/reward.constants";

config();

chai.use(solidity);

describe("RewardBase", () => {
  let nft: GenesisNft;
  let accounts: SignerWithAddress[];

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;

  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let reward: RewardTokens;

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 32;
    ({
      workToken,
      distribution,
      nft,
      rewardTokens: reward,
    } = await regenerateContracts(accounts, accounts[0].address, startTime));
  });

  describe("Testing getRewardTotalMonth, total reward function on RewardBase", async () => {
    it("getRewardTotalMonth is correct month 0, 0", async () => {
      expect(await reward.getRewardTotalMonth(0)).to.equal(0);
    });

    it("getRewardersTotal is correct for month 1 till 40", async () => {
      for (let i = 1; i <= 40; i++) {
        expect(await reward.getRewardTotalMonth(i)).to.equal(amount(REWARDS[i - 1]));
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

  describe("Testing approve function", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 32;
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

  describe("Simple claim, error and events", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 40;
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

  describe("Test monthClaimed, it should keep track of the month in which nft last claimed reward", async () => {
    before(async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 32;
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
