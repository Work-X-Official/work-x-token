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
import { getRewardsTotal, mineStakeMonths, testRewardClaimed } from "../util/rewards.util";

config();

chai.use(solidity);

describe.only("RewardTokensScenarios", () => {
  let nft: GenesisNft;
  let accounts: SignerWithAddress[];

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;

  let amountMint1: number;
  let amountMint2: number;
  let amountMint3: number;

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

  describe("Staking/unstaking testing getRewardNftId, getRewardNftIdMonth", async () => {
    it("Mint nft 1,2,3 and go to startime", async () => {
      amountMint1 = 10000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountMint1, 0, 0, chainId));
      amountMint2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountMint2, 0, 0, chainId));
      amountMint3 = 100;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountMint3, 0, 0, chainId));

      await mineDays(22, network);
    });
    it("In month 0, on day 5 nftId1 stakes 1000", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await testStaked(nftId1, amountStake + amountMint1, amountMint1);
      await testStaked(nftId2, amountMint2, amountMint2);
      await testStaked(nftId3, amountMint3, amountMint3);
      const _totalBalanceExpected = amountMint1 + amountMint2 + amountMint3 + amountStake;
      const _minimumBalanceExpected = amountMint1 + amountMint2 + amountMint3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });
  });

  const testStaked = async (_nftId: number, _stakedAmountExpected: number, _stakedAmountMinimumExpected: number) => {
    const currMonth = await nft.getCurrentMonth();
    const _tokenIdInfoAtMonth = await nft.getStaked(_nftId, currMonth);
    expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(_stakedAmountExpected));
    expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(_stakedAmountMinimumExpected));
  };
  const testTotals = async (_totalBalanceExpected: number, _minimumBalanceExpected: number) => {
    const currMonth = await nft.getCurrentMonth();
    const [, _totalBalance, _minimumBalance] = await nft.getTotals(currMonth);
    expect(_totalBalance).to.be.equal(amount(_totalBalanceExpected));
    expect(_minimumBalance).to.be.equal(amount(_minimumBalanceExpected));
  };
});
