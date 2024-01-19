import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens } from "../../typings";
import { ethers, network } from "hardhat";
import { amount, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft, testStaked, testTotals } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  getRewardersTotal,
  mineStakeMonths,
  testGetClaimables,
  testGetRewardNftIdMonth,
  claimAndVerifyClaimed,
} from "../util/reward.util";

config();

chai.use(solidity);

describe("RewardTokensScenarios", () => {
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

  let minimumStaked1: number;
  let minimumStaked2: number;
  let minimumStaked3: number;

  let minimumStakedMonthPrev1: number;
  let minimumStakedMonthPrev2: number;
  let minimumStakedMonthPrev3: number;
  let minimumBalanceMonthPrev: number;

  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let reward: RewardTokens;

  let chainId: number;

  const updateMinima = () => {
    minimumStakedMonthPrev1 = minimumStaked1;
    minimumStakedMonthPrev2 = minimumStaked2;
    minimumStakedMonthPrev3 = minimumStaked3;
    minimumBalanceMonthPrev = minimumStakedMonthPrev1 + minimumStakedMonthPrev2 + minimumStakedMonthPrev3;
    minimumStaked1 = amountStaked1;
    minimumStaked2 = amountStaked2;
    minimumStaked3 = amountStaked3;
  };

  const testStakedCurrent = async () => {
    await testStaked(nft, nftId1, amountStaked1, minimumStaked1);
    await testStaked(nft, nftId2, amountStaked2, minimumStaked2);
    await testStaked(nft, nftId3, amountStaked3, minimumStaked3);
  };

  const testTotalsCurrent = async () => {
    const _minimumBalanceExpected = minimumStaked1 + minimumStaked2 + minimumStaked3;
    const _totalBalanceExpected = amountStaked1 + amountStaked2 + amountStaked3;
    await testTotals(nft, _totalBalanceExpected, _minimumBalanceExpected);
  };

  const testGetRewardNftIdMonthCurrent = async () => {
    await testGetRewardNftIdMonth(reward, nft, nftId1, minimumStakedMonthPrev1, minimumBalanceMonthPrev);
    await testGetRewardNftIdMonth(reward, nft, nftId2, minimumStakedMonthPrev2, minimumBalanceMonthPrev);
    await testGetRewardNftIdMonth(reward, nft, nftId3, minimumStakedMonthPrev3, minimumBalanceMonthPrev);
  };

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 32;
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

  describe("Staking/unstaking testing getClaimable, getRewardNftIdMonth", async () => {
    before("Mint nft 1,2,3 and go to startime", async () => {
      amountStaked1 = 10000;
      minimumStaked1 = 10000;
      minimumStakedMonthPrev1 = 0;
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, amountStaked1, 0, 0, chainId));
      amountStaked2 = 50000;
      minimumStaked2 = 50000;
      minimumStakedMonthPrev2 = 0;
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, amountStaked2, 0, 0, chainId));
      amountStaked3 = 100;
      minimumStaked3 = 100;
      minimumStakedMonthPrev3 = 0;
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, amountStaked3, 0, 0, chainId));
      await mineDays(22, network);
    });

    it("In month 0, on day 5, nftId1 stakes 1000", async () => {
      await mineDays(5, network);
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      amountStaked1 += amountStake;
      await testStakedCurrent();
      await testTotalsCurrent();
    });

    it("In month 0, on day 5, nothing to claim, because the total reward in month 0 is 0", async () => {
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 1, on day 35, nftId2 and nftId3 both stake 8000", async () => {
      const amountStake = 8000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      amountStaked2 += amountStake;
      amountStaked3 += amountStake;
      await testStakedCurrent();
      await testTotalsCurrent();
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 2, on day 65, nftId3 unstake 100 and nftId1 stakes 5000", async () => {
      const amountUnstake = 100;
      const amountStake = 6000;
      amountStaked3 -= amountUnstake;
      minimumStaked3 -= amountUnstake;
      amountStaked1 += amountStake;
      await nft.connect(nftMinter3).unstake(nftId3, amount(amountUnstake));
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await testStakedCurrent();
      await testTotalsCurrent();
    });

    it("In month 2, on day 65, the GetRewardNftIdMonth and getClaimable are correct after staking in month 2", async () => {
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 3, on day 95, nftId2 stakes 1000 and nftId1 unstakes 2000", async () => {
      const amountStake = 1000;
      const amountUnstake = 2000;
      amountStaked1 -= amountUnstake;
      minimumStaked1 -= amountUnstake;
      amountStaked2 += amountStake;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter1).unstake(nftId1, amount(amountUnstake));
      await testStakedCurrent();
      await testGetRewardNftIdMonthCurrent();
    });

    it("In month 3, on day 95, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 4, on day 125, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 4, the balances do not change and we go to month 14", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 10, network);
      updateMinima();
    });

    it("In month 14, on day 425, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 14, on day 425,  nftId 1,2,3 all stake 100.000", async () => {
      const amountStake = 100000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
      await nft.connect(nftMinter3).stake(nftId3, amount(amountStake));
      amountStaked1 += amountStake;
      amountStaked2 += amountStake;
      amountStaked3 += amountStake;
      await testStakedCurrent();
      await testGetRewardNftIdMonthCurrent();
    });

    it("In month 15, on day 455, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonthCurrent();
      await testGetClaimables(reward, nft, [nftId1, nftId2, nftId3]);
    });

    it("In month 15, on day 455, nftId1 stakes 1000, nftId2 is destroyed", async () => {
      const amountStake = 1000;
      await nft.connect(nftMinter1).stake(nftId1, amount(amountStake));
      await nft.connect(nftMinter2).destroyNft(nftId2);
      amountStaked1 += amountStake;
      amountStaked2 = 0;
      minimumStaked2 = 0;
      await testStaked(nft, nftId1, amountStaked1, minimumStaked1);
      await expect(testStaked(nft, nftId2, amountStaked2, minimumStaked2)).to.be.revertedWith("NftNotExists");
      await testStaked(nft, nftId3, amountStaked3, amountStaked3);
      await testTotalsCurrent();
    });

    it("In month 16, on day 485, the GetRewardNftIdMonth and getClaimable are correct", async () => {
      await mineDays(30, network);
      updateMinima();
      await testGetRewardNftIdMonth(reward, nft, nftId1, minimumStakedMonthPrev1, minimumBalanceMonthPrev);
      await testGetRewardNftIdMonth(reward, nft, nftId3, minimumStakedMonthPrev3, minimumBalanceMonthPrev);
      await testGetClaimables(reward, nft, [nftId1, nftId3]);
    });
  });

  describe("Test Claim, claimed vs getClaimable with stake/unstake.", async () => {
    before("Generate contracts and mint nft 1,2,3 and go to startime", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 32;
      ({
        workToken,
        distribution,
        nft,
        rewardTokens: reward,
      } = await regenerateContracts(accounts, accounts[0].address, startTime));

      await distribution.setWalletClaimable([nftMinter1.address], [25000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [150000], [0], [0], [0]);

      await reward.approve(nft.address, amount(1400000));

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

    it("In month 6, nftId 2,3 stake 1000 and then 1,2 claim", async () => {
      await mineStakeMonths(nftMinter1, nft, nftId1, 2, network);
      const amountStake = 1000;
      await nft.connect(nftMinter2).stake(nftId2, amount(amountStake));
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

    it("Go to month 41, the remaining nft claim", async () => {
      await mineStakeMonths(nftMinter2, nft, nftId2, 11, network);
      await claimAndVerifyClaimed(reward, nftId2, nftMinter2);
      await claimAndVerifyClaimed(reward, nftId3, nftMinter3);
    });

    it("Total claimed is equal to the total rewards, each claim in each month are rounded down so they are roughly equal", async () => {
      const claimed1 = await reward.connect(nftMinter1).claimed(nftId1);
      const claimed2 = await reward.connect(nftMinter2).claimed(nftId2);
      const claimed3 = await reward.connect(nftMinter3).claimed(nftId3);
      const claimedTotal = claimed1.add(claimed2).add(claimed3);
      const rewardsTotal = getRewardersTotal();
      expect(claimedTotal).to.closeTo(amount(rewardsTotal), amount(1));
    });
  });
});
