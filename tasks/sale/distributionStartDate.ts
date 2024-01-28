import { TokenDistribution } from "../../typings";
import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { SALE_DISTRIBUTION_ADDRESSES } from "../constants/distribution.constants";

// example: yarn hardhat distribution:getstartdate --network sepolia
task("distribution:getstartdate", "Prints the startdate").setAction(async ({ _ }, hre) => {
  const tokenDistribution: TokenDistribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
    SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES],
  );
  const startTime = Number((await tokenDistribution.startTime()).toString());
  const startTimeDate = new Date(startTime * 1000);
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const block = await hre.ethers.provider.getBlock(blockNumber);
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║  on '" + hre.network.name + "'");
  console.log("║ startTime in Unix:", startTime);
  console.log("║ startTime in Date", startTimeDate);
  console.log("║ current time in seconds:", block.timestamp);
  console.log("║ current Date", new Date(block.timestamp * 1000));
  if (startTime > block.timestamp) {
    console.log("║ ETA (s):", startTime - block.timestamp);
  }
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

// example yarn hardhat distribution:startdate --starttime 1701615500 --network sepolia
task("distribution:startdate", "Sets the StartDate")
  .addParam("starttime", "Startime in Unix format")
  .setAction(async ({ starttime }, hre) => {
    const tokenDistribution: TokenDistribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
      SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES],
    );

    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(blockNumber);
    const currentTimestamp = block.timestamp;

    const transaction = await tokenDistribution.startDistribution(starttime);

    // convert unix seconds to date.
    const startTimeDate = new Date(starttime * 1000);

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ Set the TokenDistribution.startTime on " + hre.network.name);
    console.log("║ " + "current block time", currentTimestamp);
    console.log("║ startTime in Unix:", starttime);
    console.log("║ startTime in Date", startTimeDate);
    console.log("║ Awaiting 5 confirmations ");
    const receipt = await transaction.wait();
    console.log("║ Tx: " + receipt.transactionHash);
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
