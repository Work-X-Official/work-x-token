import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { RewardShares } from "../../typings";
import { LEVEL_SHARES, REWARD_SHARES_ADDRESSES } from "../constants/reward.constants";

// yarn hardhat reward:levelshares --network sepolia
task("reward:levelshares").setAction(async (_, hre) => {
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ On network:", hre.network.name);
  console.log("║ RewardShares, Set the mapping levelShares with all the (shares -> levels) ...");
  const txSetLevelShares = await rewardShares.setLevelShares(LEVEL_SHARES);
  const txHash = (await txSetLevelShares.wait()).transactionHash;
  console.log("║ The mapping levelShares has been set in Tx: ", txHash);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
