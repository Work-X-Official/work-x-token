import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { GenesisNft, RewardShares, RewardTokens } from "../../typings";
import { REWARD_SHARES_ADDRESSES, REWARD_TOKENS_ADDRESSES } from "../constants/reward.constants";

// yarn hardhat reward:approve --network sepolia
task("reward:approve").setAction(async (_, hre) => {
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
  console.log("║ RewardShares, Approve the nft contract to spend WORK tokens ....");
  const txApproveShares = await rewardShares.approve(nft.address, hre.ethers.utils.parseEther("1400000"));
  const txHashShares = (await txApproveShares.wait()).transactionHash;
  console.log("║ RewardShares approved nft to spend  WORK in Tx: ", txHashShares);
  console.log("║ RewardTokens, Approve the nft contract to spend WORK tokens ....");
  const txApproveTokens = await rewardTokens.approve(nft.address, hre.ethers.utils.parseEther("1400000"));
  const txHashTokens = (await txApproveTokens.wait()).transactionHash;
  console.log("║ RewardTokens approved nft to spend  WORK in Tx: ", txHashTokens);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
