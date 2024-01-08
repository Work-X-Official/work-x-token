import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardShares } from "../../typings";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { amount, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getRewardsTotal, mineStakeMonths, testRewardClaimed } from "../util/rewards.util";
import { BASE_STAKE } from "../constants/nft.constants";

config();

chai.use(solidity);

describe.only("RewardSharesScenarios", () => {
  let nft: GenesisNft;
  let accounts: SignerWithAddress[];

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;

  let sharesCurr1: number;
  let sharesCurr2: number;
  let sharesCurr3: number;

  let sharesPrev1: number;
  let sharesPrev2: number;
  let sharesPrev3: number;

  let sharesPrevTotal: number;
  let sharesCurrTotal: number;

  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let reward: RewardShares;

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
      rewardShares: reward,
    } = await regenerateContracts(accounts, accounts[0].address, startTime));

    await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
  });

  describe("Staking/unstaking testing getRewardNftId, getRewardNftIdMonth", async () => {
    before("Mint nft 1,2,3 and go to startime", async () => {
      const amountStaked1 = 10000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountStaked1, 0, 0, chainId));
      sharesCurr1 = BASE_STAKE + 21;
      const amountStaked2 = 50000;
      sharesCurr2 = BASE_STAKE + 104;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountStaked2, 0, 0, chainId));
      const amountStaked3 = 100;
      sharesCurr3 = BASE_STAKE + 1;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountStaked3, 0, 0, chainId));

      await mineDays(22, network);
    });

    it("In month 0, on day 5, nftId1 stakes 1000 and all the shares are correct", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      sharesCurr1 = BASE_STAKE + 23;
      await testShares(nftId1, sharesCurr1);
      await testShares(nftId2, sharesCurr2);
      await testShares(nftId3, sharesCurr3);

      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;
      await testTotalShares(sharesCurrTotal);
    });

    it("In month 0, on day 5, nothing to claim, because the total reward in month 0 is 0", async () => {
      await testGetRewardNftIdMonth(nftId1, 0, 0);
      await testGetRewardNftIdMonth(nftId2, 0, 0);
      await testGetRewardNftIdMonth(nftId3, 0, 0);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;
      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, nftId2 and nftId3 both stake 8000", async () => {
      const amountStake = 8000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      sharesCurr2 = BASE_STAKE + 120;
      sharesCurr3 = BASE_STAKE + 13;

      await testShares(nftId1, sharesCurr1);
      await testShares(nftId2, sharesCurr2);
      await testShares(nftId3, sharesCurr3);

      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;
      await testTotalShares(sharesCurrTotal);
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);

      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;

      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 2, on day 65, nftId3 unstake 100 and nftId1 stakes 5000", async () => {
      const amountUnstake = 100;
      const amountStake = 6000;
      await nft.connect(nftMinter3).unstake(nftId3, amount(amountUnstake));
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      sharesCurr1 = BASE_STAKE + 31;

      await testShares(nftId1, sharesCurr1);
      await testShares(nftId2, sharesCurr2);
      await testShares(nftId3, sharesCurr3);

      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;
      await testTotalShares(sharesCurrTotal);
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);

      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;
      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, nftId2 stakes 1000 and nftId1 unstakes 2000", async () => {
      const amountStake = 1000;
      const amountUnstake = 2000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter1).unstake(nftId1, amount(amountUnstake));

      sharesCurr2 = BASE_STAKE + 120;
      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;

      await testShares(nftId1, sharesCurr1);
      await testShares(nftId2, sharesCurr2);
      await testShares(nftId3, sharesCurr3);

      await testTotalShares(sharesCurrTotal);
    });

    it("In month 4, on day 125, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);
      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;
      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 4, the shares do not change and we go to month 14", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 10, network);
    });

    it("In month 14, on day 425, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 14, on day 425,  nftId 1,2,3 all stake 100.000", async () => {
      const amountStake = 100000;
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stakeAndEvolve(nftId3, amount(amountStake));

      sharesCurr1 = BASE_STAKE + 235;
      sharesCurr2 = BASE_STAKE + 320;
      sharesCurr3 = BASE_STAKE + 222;

      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;

      await testShares(nftId1, sharesCurr1);
    });

    it("In month 15, on day 455, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);

      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;

      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId2, sharesPrev2, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
      await testGetRewardNfts([nftId1, nftId2, nftId3]);
    });

    it("In month 15, on day 455, nftId1 stakes 1000, nftId2 is destroyed", async () => {
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).destroyNft(nftId2);

      sharesCurr1 = BASE_STAKE + 235;
      sharesCurr2 = 0;

      sharesCurrTotal = sharesCurr1 + sharesCurr2 + sharesCurr3;

      await testShares(nftId1, sharesCurr1);
      await expect(testShares(nftId2, sharesCurr2)).to.be.revertedWith("NftNotExists");
      await testShares(nftId3, sharesCurr3);

      await testTotalShares(sharesCurrTotal);
    });

    it("In month 16, on day 485, the GetRewardNftIdMonth and getRewardNftId are correct", async () => {
      await mineDays(30, network);

      sharesPrev1 = sharesCurr1;
      sharesPrev2 = sharesCurr2;
      sharesPrev3 = sharesCurr3;

      sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;

      await testGetRewardNftIdMonth(nftId1, sharesPrev1, sharesPrevTotal);
      await testGetRewardNftIdMonth(nftId3, sharesPrev3, sharesPrevTotal);
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

  const testGetRewardNftIdMonth = async (_nftId: number, _nftShares: number, _totalShares: number) => {
    const currMonth = await nft.getCurrentMonth();
    const rewardTotal = await reward.getRewardTotalMonth(currMonth);
    if (rewardTotal.eq(0)) return;
    const rewardNftIdMonthExpected = rewardTotal.mul(_nftShares).div(_totalShares);
    const rewardNftIdMonth = await reward.getRewardNftIdMonth(_nftId, currMonth);
    expect(rewardNftIdMonth).to.be.equal(rewardNftIdMonthExpected);
  };

  const testShares = async (_nftId: number, _sharesExpected: number) => {
    const currMonth = await nft.getCurrentMonth();
    const _shares = await nft.getShares(_nftId, currMonth);
    expect(_shares).to.be.equal(_sharesExpected);
  };

  const testTotalShares = async (_totalSharesExpected: number) => {
    const currMonth = await nft.getCurrentMonth();
    const [_totalShares, ,] = await nft.getTotals(currMonth);
    expect(_totalShares).to.be.equal(_totalSharesExpected);
  };
});
