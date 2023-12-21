import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GenesisNft, RewardShares, RewardTokens, WorkToken } from "../../typings";
import { ethers } from "hardhat";
import { REWARDS } from "../constants/rewards.constants";
import { expect } from "chai";

export const regenerateRewardShares = async (
  ownerRewards: SignerWithAddress,
  workToken: WorkToken,
  nft: GenesisNft,
): Promise<RewardShares> => {
  const rewardShares = await (
    await ethers.getContractFactory("RewardShares", ownerRewards)
  ).deploy(nft.address, workToken.address);
  await rewardShares.deployed();

  await workToken.connect(ownerRewards).transfer(rewardShares.address, ethers.utils.parseEther("1500000"));
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

  await workToken.connect(ownerRewards).transfer(rewardTokens.address, ethers.utils.parseEther("1500000"));
  await nft.setRewarder(rewardTokens.address, true);
  return rewardTokens;
};

export const testRewardClaimed = async (
  reward: RewardShares | RewardTokens,
  nftId: number,
  account: SignerWithAddress,
) => {
  const rewardNftId = await reward.connect(account).getRewardNftId(nftId);
  await reward.connect(account).claim(nftId);
  const claimed = await reward.connect(account).claimed(nftId);
  expect(rewardNftId).to.equal(claimed);
};

export const getRewardsTotal = (): number => {
  let rewardsTotal = 0;
  for (const value of REWARDS) {
    rewardsTotal += value;
  }
  return rewardsTotal;
};
