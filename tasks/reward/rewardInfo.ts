import { amountFormatted } from "./../../test/util/helpers.util";
import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { GenesisNft, RewardShares, RewardTokens, RewardWrapper, WorkToken } from "../../typings";
import {
  REWARD_SHARES_ADDRESSES,
  REWARD_TOKENS_ADDRESSES,
  REWARD_WRAPPER_ADDRESSES,
} from "../constants/reward.constants";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

// yarn hardhat nft:reward:info --network sepolia
task("nft:reward:info", "shows info about the state of the rewards setup").setAction(async (_, hre) => {
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
  );
  const rewardTokens: RewardTokens = (await hre.ethers.getContractFactory("RewardTokens")).attach(
    REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES],
  );
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );

  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );

  const rewardWrapper: RewardWrapper = (await hre.ethers.getContractFactory("RewardWrapper")).attach(
    REWARD_WRAPPER_ADDRESSES[hre.network.name as keyof typeof REWARD_WRAPPER_ADDRESSES],
  );
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Show relevant information about the Reward Contracts Setup");
  console.log("║ Current contracts addresses used are:");
  console.log("║ GenesisNft: ", nft.address);
  console.log("║ RewardTokens: ", rewardTokens.address);
  console.log("║ RewardShares: ", rewardShares.address);
  console.log("║ rewardWrapper: ", rewardWrapper.address);
  console.log("║ WorkToken: ", workToken.address);
  console.log("║ RewardWrapper: ", rewardWrapper.address);
  console.log("║ ");
  console.log("║ Relevant info about the NFT");
  const currentMonth = await nft.getCurrentMonth();
  console.log("║ NFT currentMonth: ", currentMonth.toString());
  const isRewardTokensRewarder = await nft.isRewarder(rewardTokens.address);
  console.log("║ RewardTokens isRewarder on the NFT contract: ", isRewardTokensRewarder);
  const isRewardSharesRewarder = await nft.isRewarder(rewardShares.address);
  console.log("║ RewardShares isRewarder on the NFT contract: ", isRewardSharesRewarder);
  console.log("║ ");
  console.log("║ Relevant info about the RewardTokens");
  const workBalance1 = amountFormatted(await workToken.balanceOf(rewardTokens.address));
  console.log("║ RewardTokens WORK balance: ", workBalance1.toString());
  const workAllowanceNft1 = amountFormatted(await workToken.allowance(rewardTokens.address, nft.address));
  console.log("║ RewardTokens WORK allowance for nft: ", workAllowanceNft1.toString());
  const rewardWrapperUsed1 = await rewardTokens.rewardWrapper();
  console.log("║ RewardTokens rewardWrapper: ", rewardWrapperUsed1);

  console.log("║ ");
  console.log("║ Relevant info about the RewardShares");
  const workBalance2 = amountFormatted(await workToken.balanceOf(rewardShares.address));
  console.log("║ RewardShares WORK balance: ", workBalance2.toString());
  const workAllowanceNft2 = amountFormatted(await workToken.allowance(rewardShares.address, nft.address));
  console.log("║ RewardShares WORK allowance for nft: ", workAllowanceNft2.toString());
  const rewardWrapperUsed2 = await rewardShares.rewardWrapper();
  console.log("║ RewardShares rewardWrapper: ", rewardWrapperUsed2);
  console.log("║ ");

  console.log("║ Relevant info about the RewardWrapper");
  const rewarders = await rewardWrapper.getRewarders();
  console.log("║ RewardWrapper rewarders, so contracts used to claim on: ", rewarders);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
