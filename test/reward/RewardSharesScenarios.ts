import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardShares } from "../../typings";
import { ethers, network } from "hardhat";
import { amount, big, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft, testShares, testTotalShares } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  mineStakeMonths,
  claimAndVerifyClaimed,
  testGetClaimables,
  testSharesGetRewardNftIdMonth,
  testLevelsGetRewardNftIdMonth,
  testCombiGetRewardNftIdMonth,
} from "../util/reward.util";
import { BASE_STAKE } from "../../tasks/constants/nft.constants";
import { BigNumber } from "ethers";

config();

chai.use(solidity);

describe("RewardSharesScenarios", () => {
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

  let levelCurr1: BigNumber;
  let levelCurr2: BigNumber;
  let levelCurr3: BigNumber;

  let levelPrev1: BigNumber;
  let levelPrev2: BigNumber;
  let levelPrev3: BigNumber;

  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let reward: RewardShares;

  let chainId: number;

  const updateShares = () => {
    sharesPrev1 = sharesCurr1;
    sharesPrev2 = sharesCurr2;
    sharesPrev3 = sharesCurr3;
    sharesPrevTotal = sharesPrev1 + sharesPrev2 + sharesPrev3;
  };

  const updateLevels = () => {
    levelPrev1 = levelCurr1;
    levelPrev2 = levelCurr2;
    levelPrev3 = levelCurr3;
  };

  const testSharesCurrent = async () => {
    await testShares(nft, nftId1, sharesCurr1);
    await testShares(nft, nftId2, sharesCurr2);
    await testShares(nft, nftId3, sharesCurr3);
  };

  const testTotalSharesCurrent = async () => {
    const _sharesExpected = sharesCurr1 + sharesCurr2 + sharesCurr3;
    await testTotalShares(nft, _sharesExpected);
  };

  const testSharesGetRewardNftIdMonthCurrent = async () => {
    await testSharesGetRewardNftIdMonth(reward, nft, nftId1, sharesPrev1, sharesPrevTotal);
    await testSharesGetRewardNftIdMonth(reward, nft, nftId2, sharesPrev2, sharesPrevTotal);
    await testSharesGetRewardNftIdMonth(reward, nft, nftId3, sharesPrev3, sharesPrevTotal);
  };

  const testLevelsGetRewardNftIdMonthCurrent = async () => {
    await testLevelsGetRewardNftIdMonth(reward, nft, nftId1, levelPrev1);
    await testLevelsGetRewardNftIdMonth(reward, nft, nftId2, levelPrev2);
    await testLevelsGetRewardNftIdMonth(reward, nft, nftId3, levelPrev3);
  };

  const testCombiGetRewardNftIdMonthCurrent = async () => {
    await testCombiGetRewardNftIdMonth(reward, nft, nftId1);
    await testCombiGetRewardNftIdMonth(reward, nft, nftId2);
    await testCombiGetRewardNftIdMonth(reward, nft, nftId3);
  };

  const getLevel = async (nftId: number): Promise<BigNumber> => {
    const info = await nft.getNftInfo(nftId);
    return info._level;
  };

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
      rewardShares: reward,
    } = await regenerateContracts(accounts, accounts[0].address, startTime));

    await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);
  });

  describe("Staking/unstaking testing getClaimable, getSharesRewardNftIdMonth, getLevelsRewardNftIdMonth, getCombiRewardNftIdMonth", async () => {
    before("Mint nft 1,2,3 and go to startime", async () => {
      const amountStaked1 = 10000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountStaked1, 0, 0, chainId));
      sharesCurr1 = BASE_STAKE + 21;
      levelCurr1 = await getLevel(nftId1);
      const amountStaked2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountStaked2, 0, 0, chainId));
      sharesCurr2 = BASE_STAKE + 104;
      levelCurr2 = await getLevel(nftId2);
      const amountStaked3 = 100;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountStaked3, 0, 0, chainId));
      sharesCurr3 = BASE_STAKE + 1;
      levelCurr3 = await getLevel(nftId3);
      await mineDays(22, network);
    });

    it("In month 0, on day 5, nftId1 stakes 1000 and all the shares are correct", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      sharesCurr1 = BASE_STAKE + 23;
      levelCurr1 = await getLevel(nftId1);
      await testSharesCurrent();
      await testTotalSharesCurrent();
    });

    it("In month 0, on day 5, nothing to claim, because the total reward in month 0 is 0", async () => {
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35 also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 1, on day 35, nftId2 and nftId3 both stake 8000", async () => {
      const amountStake = 8000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      sharesCurr2 = BASE_STAKE + 120;
      sharesCurr3 = BASE_STAKE + 13;
      levelCurr2 = await getLevel(nftId2);
      levelCurr3 = await getLevel(nftId3);
      await testSharesCurrent();
      await testTotalSharesCurrent();
    });

    it("In month 2, on day 65, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 2, on day 65, the GetLevelsRewardNftIdMonth and getRewardNftIdMonth are correct", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 2, on day 65, nftId3 unstake 100 and nftId1 stakes 5000", async () => {
      const amountUnstake = 100;
      const amountStake = 6000;
      await nft.connect(nftMinter3).unstake(nftId3, amount(amountUnstake));
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      sharesCurr1 = BASE_STAKE + 31;
      levelCurr1 = await getLevel(nftId1);
      await testSharesCurrent();
      await testTotalSharesCurrent();
    });

    it("In month 2, on day 65, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 2, on day 65, also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 3, on day 95, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();

      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 3, on day 95, nftId2 stakes 1000 and nftId1 unstakes 2000", async () => {
      const amountStake = 1000;
      const amountUnstake = 2000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter1).unstake(nftId1, amount(amountUnstake));
      sharesCurr2 = BASE_STAKE + 120;
      levelCurr2 = await getLevel(nftId2);
      await testSharesCurrent();
      await testTotalSharesCurrent();
    });

    it("In month 4, on day 125, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 4, on day 125, also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 4, the shares do not change and we go to month 14", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 10, network);
    });

    it("In month 14, on day 425, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      updateShares();
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 14, on day 425, also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 14, on day 425,  nftId 1,2,3 all stake 100.000", async () => {
      const amountStake = 100000;
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stakeAndEvolve(nftId3, amount(amountStake));
      sharesCurr1 = BASE_STAKE + 235;
      sharesCurr2 = BASE_STAKE + 320;
      sharesCurr3 = BASE_STAKE + 222;
      levelCurr1 = await getLevel(nftId1);
      levelCurr2 = await getLevel(nftId2);
      levelCurr3 = await getLevel(nftId3);
      await testSharesCurrent();
      await testTotalSharesCurrent();
    });

    it("In month 15, on day 455, the GetSharesRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();
      await testSharesGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 15, on day 455,  also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonthCurrent();
      await testCombiGetRewardNftIdMonthCurrent();
    });

    it("In month 15, on day 455, nftId1 stakes 1000, nftId2 is destroyed", async () => {
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).destroyNft(nftId2);
      sharesCurr1 = BASE_STAKE + 235;
      sharesCurr2 = 0;
      levelCurr1 = await getLevel(nftId1);
      levelCurr2 = big(0);
      await testShares(nft, nftId1, sharesCurr1);
      await expect(testShares(nft, nftId2, sharesCurr2)).to.be.revertedWith("NftNotExists");
      await testShares(nft, nftId3, sharesCurr3);
      await testTotalSharesCurrent();
    });

    it("In month 16, on day 485, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateShares();
      await testSharesGetRewardNftIdMonth(reward, nft, nftId1, sharesPrev1, sharesPrevTotal);
      await testSharesGetRewardNftIdMonth(reward, nft, nftId3, sharesPrev3, sharesPrevTotal);
      await testGetClaimables(reward, nft, [nftId1, nftId3]);
    });

    it("In month 16, on day 485, also test GetLevelsRewardNftIdMonth and getRewardNftIdMonth", async () => {
      updateLevels();
      await testLevelsGetRewardNftIdMonth(reward, nft, nftId1, levelPrev1);
      await testLevelsGetRewardNftIdMonth(reward, nft, nftId3, levelPrev3);
      await testCombiGetRewardNftIdMonth(reward, nft, nftId1);
      await testCombiGetRewardNftIdMonth(reward, nft, nftId3);
    });
  });

  describe("Test Claim, claimed vs getClaimable with stake/unstake.", async () => {
    before("Generate contracts and mint nft 1,2,3 and go to startime", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 34;
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

      const amountStaked1 = 10000;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountStaked1, 0, 0, chainId));
      const amountStaked2 = 50000;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountStaked2, 0, 0, chainId));
      const amountStaked3 = 100;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountStaked3, 0, 0, chainId));

      await mineDays(22, network);
    });

    it("In month 0, on day 5, nftId1 stakes 1000", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
    });

    it("In month 1, on day 35, nftId2 stakes 3000, and then claims", async () => {
      await mineDays(30, network);
      const amountStake = 3000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("In month 2, on day 65, nftId1 claims, and then unstakes 1000", async () => {
      await mineDays(30, network);
      await claimAndVerifyClaimed(reward, nftId1, nftMinter1);
      const amountUnstake = 1000;
      await nft.connect(nftMinter1).unstake(nftId1, amount(amountUnstake));
    });

    it("In month 3, nftId3 claims and then stakes 1000", async () => {
      await mineDays(30, network);
      await claimAndVerifyClaimed(reward, nftId3, nftMinter3);
      const amountStake = 1000;
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
    });

    it("In month 4, nftId 1,2 claim", async () => {
      await mineDays(30, network);
      await claimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("In month 6, nftId 3 stake 1000 and then 1,2 claim", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 2, network);
      const amountStake = 1000;
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      await claimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
    });

    it("In month 16, nftId 3 claims, and nftId1 stakes", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 10, network);
      await claimAndVerifyClaimed(reward, nftId3, nftMinter3);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
    });

    it("Go to month 30, all nfts claim everything, nftId 1 destroys", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 14, network);
      await claimAndVerifyClaimed(reward, nftId1, nftMinter1);
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await claimAndVerifyClaimed(reward, nftId3, nftMinter3);
      await nft.connect(nftMinter1).destroyNft(nftId1);
    });

    it("Go to month 41, the remaining nfts claim", async () => {
      await mineStakeMonths(nftMinter2, nft, nftId2, 11, network);
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await claimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });
  });
});
