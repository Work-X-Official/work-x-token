import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { GenesisNft, RewardShares, RewardTokens, RewardWrapper } from "../../typings";
import {
  REWARD_SHARES_ADDRESSES,
  REWARD_TOKENS_ADDRESSES,
  REWARD_WRAPPER_ADDRESSES,
} from "../constants/reward.constants";

// yarn hardhat nft:rewarder:set --network sepolia
task("nft:rewarder:set").setAction(async (_, hre) => {
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
  );
  const rewardTokens: RewardTokens = (await hre.ethers.getContractFactory("RewardTokens")).attach(
    REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES],
  );
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ On the nft contract, make RewardTokens rewarder....");
  const txSetRewarderTokens = await nft.setRewarder(rewardTokens.address, true);
  const txHash1 = (await txSetRewarderTokens.wait()).transactionHash;
  console.log("║ RewaredTokens is set as rewarder in Tx: ", txHash1);
  console.log("║ On the nft contract, make RewardShares rewarder....");
  const txSetRewarderShares = await nft.setRewarder(rewardShares.address, true);
  const txHash2 = (await txSetRewarderShares.wait()).transactionHash;
  console.log("║ RewaredShares is set as rewarder in Tx: ", txHash2);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

// yarn hardhat reward:wrapper:set --network sepolia
task("reward:wrapper:set").setAction(async (_, hre) => {
  const rewardTokens: RewardTokens = (await hre.ethers.getContractFactory("RewardTokens")).attach(
    REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES],
  );
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );
  const rewardWrapper: RewardWrapper = (await hre.ethers.getContractFactory("RewardWrapper")).attach(
    REWARD_WRAPPER_ADDRESSES[hre.network.name as keyof typeof REWARD_WRAPPER_ADDRESSES],
  );

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ setRewardWrapper on RewardTokens....");
  const txSetRewardWrapperTokens = await rewardTokens.setRewardWrapper(rewardWrapper.address);
  const txHash1 = (await txSetRewardWrapperTokens.wait()).transactionHash;
  console.log("║ RewardWrapper is set in RewardTokens in Tx: ", txHash1);
  console.log("║ setRewardWrapper on RewardShares....");
  const txSetRewardWrapperShares = await rewardShares.setRewardWrapper(rewardWrapper.address);
  const txHash2 = (await txSetRewardWrapperShares.wait()).transactionHash;
  console.log("║ RewardWrapper is set as rewarder in Tx: ", txHash2);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

// yarn hardhat wrapper:rewarder:set --network sepolia
task("wrapper:rewarder:set").setAction(async (_, hre) => {
  const rewardTokens: RewardTokens = (await hre.ethers.getContractFactory("RewardTokens")).attach(
    REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES],
  );
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );
  const rewardWrapper: RewardWrapper = (await hre.ethers.getContractFactory("RewardWrapper")).attach(
    REWARD_WRAPPER_ADDRESSES[hre.network.name as keyof typeof REWARD_WRAPPER_ADDRESSES],
  );

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ setRewarders on RewardWrapper....");
  const txSetRewarders = await rewardWrapper.setRewarders([rewardTokens.address, rewardShares.address]);
  const txHash = (await txSetRewarders.wait()).transactionHash;
  console.log("║ RewardTokens and RewardShares are set as rewarders in Tx: ", txHash);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
