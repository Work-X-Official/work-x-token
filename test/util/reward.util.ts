import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GenesisNft, RewardLevels, RewardShares, RewardTokens, RewardWrapper, WorkToken } from "../../typings";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Signer } from "ethers";
import {
  LEVEL_SHARES,
  REWARDS_SHARES,
  REWARDS_TOKENS,
  REWARD_LEVEL_MONTH,
} from "../../tasks/constants/reward.constants";
import { expect } from "chai";
import { Network } from "hardhat/types/runtime";
import { amount, mineDays } from "./helpers.util";
import { approveWorkToken } from "./worktoken.util";

export const regenerateRewardShares = async (
  ownerRewards: SignerWithAddress,
  workToken: WorkToken,
  nft: GenesisNft,
): Promise<RewardShares> => {
  const rewardShares = await (
    await ethers.getContractFactory("RewardShares", ownerRewards)
  ).deploy(nft.address, workToken.address);
  await rewardShares.deployed();

  await workToken.connect(ownerRewards).transfer(rewardShares.address, ethers.utils.parseEther("700000"));
  await nft.setRewarder(rewardShares.address, true);
  return rewardShares;
};

export const regenerateRewardTokens = async (
  ownerRewards: SignerWithAddress,
  workToken: WorkToken,
  nft: GenesisNft,
): Promise<RewardTokens> => {
  const rewardTokens = await (
    await ethers.getContractFactory("RewardTokens", ownerRewards)
  ).deploy(nft.address, workToken.address);
  await rewardTokens.deployed();

  await workToken.connect(ownerRewards).transfer(rewardTokens.address, ethers.utils.parseEther("1400000"));
  await nft.setRewarder(rewardTokens.address, true);
  return rewardTokens;
};

export const regenerateRewardLevels = async (
  ownerRewards: SignerWithAddress,
  workToken: WorkToken,
  nft: GenesisNft,
): Promise<RewardLevels> => {
  const rewardLevels = await (
    await ethers.getContractFactory("RewardLevels", ownerRewards)
  ).deploy(nft.address, workToken.address);
  await rewardLevels.deployed();

  await workToken.connect(ownerRewards).transfer(rewardLevels.address, ethers.utils.parseEther("700000"));
  await nft.setRewarder(rewardLevels.address, true);

  await rewardLevels.setLevelShares(LEVEL_SHARES);

  return rewardLevels;
};

export const regenerateRewardWrapper = async (
  ownerRewards: SignerWithAddress,
  nft: GenesisNft,
  rewards: (RewardShares | RewardTokens)[],
): Promise<RewardWrapper> => {
  const rewardWrapper = await (
    await ethers.getContractFactory("RewardWrapper", ownerRewards)
  ).deploy(
    nft.address,
    rewards.map(r => r.address),
  );

  await rewardWrapper.deployed();
  return rewardWrapper;
};

export const claimAndVerifyClaimed = async (
  reward: RewardShares | RewardTokens | RewardLevels,
  nftId: number,
  account: SignerWithAddress,
) => {
  const claimable = await reward.connect(account).getClaimable(nftId);
  const claimedBefore = await reward.claimed(nftId);
  await reward.connect(account).claim(nftId);
  const claimedExpected = claimable.add(claimedBefore);
  const claimedAfter = await reward.claimed(nftId);
  expect(claimedExpected).to.equal(claimedAfter);
};

export const claimAndVerifyStaked = async (
  rewardWrapper: RewardWrapper,
  nft: GenesisNft,
  nftId: number,
  nftMinter: SignerWithAddress,
  nftStakedExpected: BigNumber,
) => {
  await rewardWrapper.connect(nftMinter).claim(nftId);

  const nftInfo = await nft.getNftInfo(nftId);
  const nftStaked = nftInfo[0];

  expect(nftStaked).to.eq(nftStakedExpected);
};

export const getClaimable = async (
  rewardTokens: RewardTokens,
  rewardShares: RewardShares,
  rewardLevels: RewardLevels,
  nftId: number,
) => {
  const rewardSharesClaimable = await rewardShares.getClaimable(nftId);
  const rewardTokensClaimable = await rewardTokens.getClaimable(nftId);
  const rewardLevelsClaimable = await rewardLevels.getClaimable(nftId);

  return { rewardSharesClaimable, rewardTokensClaimable, rewardLevelsClaimable };
};

export const testMonthClaimed = async (
  reward: RewardTokens | RewardShares | RewardLevels,
  nftIds: number[],
  monthClaimedExpected: number[],
) => {
  for (let i = 0; i < nftIds.length; i++) {
    const monthClaimed = await reward.monthClaimed(nftIds[i]);
    expect(monthClaimed).to.be.equal(monthClaimedExpected[i]);
  }
};

export const testGetClaimables = async (reward: RewardTokens | RewardShares, nft: GenesisNft, nftIds: number[]) => {
  for (const nftId of nftIds) {
    await testGetClaimable(reward, nft, nftId);
  }
};

export const testGetClaimable = async (reward: RewardTokens | RewardShares, nft: GenesisNft, nftId: number) => {
  const currMonth = await nft.getCurrentMonth();
  let rewardNftIdExpected = ethers.BigNumber.from(0);
  for (let i = 1; i <= currMonth.toNumber(); i++) {
    rewardNftIdExpected = rewardNftIdExpected.add(await reward.getRewardNftIdMonth(nftId, i));
  }
  const claimable = await reward.getClaimable(nftId);
  const claimed = await reward.claimed(nftId);

  expect(claimable.add(claimed)).to.be.equal(rewardNftIdExpected);
};

export const testFractionGetRewardNftIdMonth = async (
  reward: RewardTokens | RewardShares,
  nft: GenesisNft,
  nftId: number,
  nftAmount: BigNumberish,
  totalAmount: BigNumberish,
  month?: BigNumberish,
) => {
  month = month || (await nft.getCurrentMonth());
  const rewardTotal = await reward.getRewardTotalMonth(month);
  if (rewardTotal.eq(0)) return;
  const rewardNftIdMonthExpected = rewardTotal.mul(amount(nftAmount as number)).div(amount(totalAmount as number));
  const rewardNftIdMonth = await reward.getRewardNftIdMonth(nftId, month);
  expect(rewardNftIdMonth).to.be.equal(rewardNftIdMonthExpected);
};

export const testLevelsGetRewardNftIdMonth = async (
  reward: RewardLevels,
  nft: GenesisNft,
  nftId: number,
  nftLevel: BigNumber,
  month?: BigNumberish,
) => {
  month = month || (await nft.getCurrentMonth());
  const rewardNftIdMonth = await reward.getRewardNftIdMonth(nftId, month);

  const rewardNftIdMonthExpected = nftLevel.mul(REWARD_LEVEL_MONTH);

  expect(rewardNftIdMonth).to.be.equal(rewardNftIdMonthExpected);
};

export const getRewardsTokensTotal = (): number => {
  let rewardsTotal = 0;
  for (const value of REWARDS_TOKENS) {
    rewardsTotal += value;
  }
  return rewardsTotal;
};

export const getRewardsSharesTotal = (): number => {
  let rewardsTotal = 0;
  for (const value of REWARDS_SHARES) {
    rewardsTotal += value;
  }
  return rewardsTotal;
};

export const mineStakeMonths = async (
  account: Signer,
  nft: GenesisNft,
  nftId: number,
  months: number,
  network: Network,
) => {
  for (let i = 0; i < months; i++) {
    await nft.connect(account).stake(nftId, 0);
    await mineDays(30, network);
  }
};

export const mintRemainingNftsAndStake = async (
  account: SignerWithAddress,
  nft: GenesisNft,
  workToken: WorkToken,
  network: Network,
) => {
  const nftIdCounter = await nft.nftIdCounter();
  const remainingNfts = 999 - nftIdCounter;

  const stakeAmountSingle = 500;
  const stakeAmountAll = stakeAmountSingle * remainingNfts;
  await workToken.connect(account).mint(account.address, amount(stakeAmountAll));

  await approveWorkToken(network, workToken, account, nft.address);

  await nft.mintRemainingToTreasury();

  await mineDays(22, network);
  await mineDays(1, network);

  for (let i = nftIdCounter; i < 999; i++) {
    await nft.connect(account).stake(i, amount(stakeAmountSingle));
  }
};
