import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens } from "../../typings";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { amount, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { mineStakeMonths } from "../util/rewards.util";

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

  let amountStaked1: number;
  let amountStaked2: number;
  let amountStaked3: number;

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
      amountStaked1 = 10000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountStaked1, 0, 0, chainId));
      amountStaked2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountStaked2, 0, 0, chainId));
      amountStaked3 = 100;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountStaked3, 0, 0, chainId));

      await mineDays(22, network);
    });

    it("In month 0, on day 5, nftId1 stakes 1000", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await testStaked(nftId1, amountStake + amountStaked1, amountStaked1);
      await testStaked(nftId2, amountStaked2, amountStaked2);
      await testStaked(nftId3, amountStaked3, amountStaked3);

      const _minimumBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      amountStaked1 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 0, on day 5, nothing to claim, because the total reward in month 0 is 0", async () => {
      await testGetRewardNftIdMonth(nftId1, 0, 0);
      await testGetRewardNftIdMonth(nftId2, 0, 0);
      await testGetRewardNftIdMonth(nftId3, 0, 0);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const minimumBalance = amountStaked1 - 1000 + amountStaked2 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - 1000, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, nftId2 and nftId3 both stake 8000", async () => {
      const amountStake = 8000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      await testStaked(nftId1, amountStaked1, amountStaked1);
      await testStaked(nftId2, amountStaked2 + amountStake, amountStaked2);
      await testStaked(nftId3, amountStaked3 + amountStake, amountStaked3);
      const _minimumBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      amountStaked2 += amountStake;
      amountStaked3 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const minimumBalance = amountStaked1 + amountStaked2 - 8000 + amountStaked3 - 8000;
      await testGetRewardNftIdMonth(nftId1, amountStaked1, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2 - 8000, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3 - 8000, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 2, on day 65, nftId3 unstake 100 and nftId1 stakes 5000", async () => {
      const amountUnstake = 100;
      const amountStake = 6000;
      await nft.connect(nftMinter3).unstake(nftId3, amount(amountUnstake));
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await testStaked(nftId1, amountStaked1 + amountStake, amountStaked1);
      await testStaked(nftId2, amountStaked2, amountStaked2);
      await testStaked(nftId3, amountStaked3 - amountUnstake, amountStaked3 - amountUnstake);
      amountStaked3 -= amountUnstake;
      const _minimumBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      amountStaked1 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      const minimumBalance = amountStaked1 - 6000 + amountStaked2 - 8000 + amountStaked3 - 8000 + 100;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - 6000, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2 - 8000, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3 - 8000 + 100, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const minimumBalance = amountStaked1 - 6000 + amountStaked2 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - 6000, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, nftId2 stakes 1000 and nftId1 unstakes 2000", async () => {
      const amountStake = 1000;
      const amountUnstake = 2000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter1).unstake(nftId1, amount(amountUnstake));
      await testStaked(nftId1, amountStaked1 - amountUnstake, amountStaked1 - amountUnstake);
      await testStaked(nftId2, amountStaked2 + amountStake, amountStaked2);
      await testStaked(nftId3, amountStaked3, amountStaked3);
      amountStaked1 -= amountUnstake;
      const _minimumBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      amountStaked2 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 3, on day 95, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      const minimumBalance = amountStaked1 - 6000 + 2000 + amountStaked2 - 1000 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - 6000 + 2000, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2 - 1000, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 4, on day 125, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const minimumBalance = amountStaked1 + amountStaked2 - 1000 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2 - 1000, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 4, the balances do not change and we go to month 14", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 10, network);
    });

    it("In month 14, on day 425, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      const minimumBalance = amountStaked1 + amountStaked2 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 14, on day 425,  nftId 1,2,3 all stake 100.000", async () => {
      const amountStake = 100000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      await testStaked(nftId1, amountStaked1 + amountStake, amountStaked1);
      await testStaked(nftId2, amountStaked2 + amountStake, amountStaked2);
      await testStaked(nftId3, amountStaked3 + amountStake, amountStaked3);
      const _minimumBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      amountStaked1 += amountStake;
      amountStaked2 += amountStake;
      amountStaked3 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 15, on day 455, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const amountLarge = 100000;
      const minimumBalance = amountStaked1 - amountLarge + amountStaked2 - amountLarge + amountStaked3 - amountLarge;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - amountLarge, minimumBalance);
      await testGetRewardNftIdMonth(nftId2, amountStaked2 - amountLarge, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3 - amountLarge, minimumBalance);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 15, on day 455, nftId1 stakes 1000, nftId2 is destroyed", async () => {
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).destroyNft(nftId2);
      await testStaked(nftId1, amountStaked1 + amountStake, amountStaked1);
      await expect(testStaked(nftId2, 0, 0)).to.be.revertedWith("NftNotExists");
      await testStaked(nftId3, amountStaked3, amountStaked3);
      const _minimumBalanceExpected = amountStaked1 + amountStaked3;
      amountStaked1 += amountStake;
      const _totalBalanceExpected = amountStaked1 + amountStaked3;
      await testTotals(_totalBalanceExpected, _minimumBalanceExpected);
    });

    it("In month 16, on day 485, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      const minimumBalance = amountStaked1 - 1000 + amountStaked3;
      await testGetRewardNftIdMonth(nftId1, amountStaked1 - 1000, minimumBalance);
      await testGetRewardNftIdMonth(nftId3, amountStaked3, minimumBalance);
      await testGetRewardNfts([nftId1, nftId3]);
    });
  });

  const testGetRewardNfts = async (nfts: number[]) => {
    for (const nftId of nfts) {
      await testGetRewardNftId(nftId);
    }
  };

  const testGetRewardNftId = async (_nftId: number) => {
    const currMonth = await nft.getCurrentMonth();
    let rewardNftIdExpected = BigNumber.from(0);
    for (let i = 1; i <= currMonth.toNumber(); i++) {
      rewardNftIdExpected = rewardNftIdExpected.add(await reward.getRewardNftIdMonth(_nftId, i));
    }
    const rewardNftId = await reward.getRewardNftId(_nftId);
    expect(rewardNftId).to.be.equal(rewardNftIdExpected);
  };

  const testGetRewardNftIdMonth = async (_nftId: number, _nftMinimum: number, _totalMininum: number) => {
    const currMonth = await nft.getCurrentMonth();
    const rewardTotal = await reward.getRewardTotalMonth(currMonth);
    if (rewardTotal.eq(0)) return;
    const rewardNftIdMonthExpected = rewardTotal.mul(amount(_nftMinimum)).div(amount(_totalMininum));
    const rewardNftIdMonth = await reward.getRewardNftIdMonth(_nftId, currMonth);
    expect(rewardNftIdMonth).to.be.equal(rewardNftIdMonthExpected);
  };

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
