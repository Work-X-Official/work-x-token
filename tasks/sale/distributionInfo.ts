import { TokenDistribution } from "../../typings";
import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { SALE_DISTRIBUTION_ADDRESSES } from "../constants/distribution.constants";

// example: yarn hardhat distribution:info --network sepolia
task("distribution:info", "Gets info about the distribution of an address")
  .addParam("address", "the addres you want to mint tokens to")
  .setAction(async ({ address }, hre) => {
    const distribution: TokenDistribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
      SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES],
    );
    const startTime = Number((await distribution.startTime()).toString());
    const startTimeDate = new Date(startTime * 1000);
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ Distribution on '" + hre.network.name + "' with address: " + distribution.address);
    console.log("║ startTime in seconds:", startTime);
    console.log("║ startTime in Date", startTimeDate);
    console.log("║ address:", address);
    const balance = await distribution.balance(address);
    console.log("║ Total bought:", hre.ethers.utils.formatEther(balance._totalBought));
    console.log("║ Total claimed:", hre.ethers.utils.formatEther(balance._totalClaimed));
    console.log("║ Total vested:", hre.ethers.utils.formatEther(balance._vested));
    console.log("║ Total claimable:", hre.ethers.utils.formatEther(balance._claimable));
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
