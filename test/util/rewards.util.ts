import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GenesisNft, RewardShares, WorkToken } from "../../typings";
import { ethers } from "hardhat";
import { REWARDS } from "../constants/rewards.constants";

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

export const getRewardsTotal = (): number => {
  let rewardsTotal = 0;
  for (const value of REWARDS) {
    rewardsTotal += value;
  }
  return rewardsTotal;
};
