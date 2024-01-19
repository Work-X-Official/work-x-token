import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { WorkToken } from "../../typings";
import { REWARD_SHARES_ADDRESSES, REWARD_TOKENS_ADDRESSES } from "../constants/reward.constants";

// yarn hardhat reward:fund --network sepolia
task("reward:fund").setAction(async (_, hre) => {
  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const rewardTokensAddress: string = REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES];
  const rewardSharesAddress: string = REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES];
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Transfer WORK tokens to the RewardTokens contract....");
  const txTransfer1 = await workToken.transfer(rewardTokensAddress, hre.ethers.utils.parseEther("1400000"));
  const txHash1 = (await txTransfer1.wait()).transactionHash;
  console.log("║ RewardTokens received WORK in Tx: ", txHash1);
  console.log("║ Transfer WORK tokens to the RewardShares contract....");
  const txTransfer2 = await workToken.transfer(rewardSharesAddress, hre.ethers.utils.parseEther("1400000"));
  const txHash2 = (await txTransfer2.wait()).transactionHash;
  console.log("║ RewardShares received WORK in Tx: ", txHash2);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
