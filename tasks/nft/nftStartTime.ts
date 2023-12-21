import { GenesisNft } from "../../typings";
import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENISIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { big } from "../../test/util/helpers.util";

// example: yarn hardhat nft:getstarttime --network sepolia
task("nft:getstarttime", "Prints the startdate").setAction(async ({ _ }, hre) => {
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENISIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENISIS_NFT_ADDRESSES],
  );
  const startTime = Number((await nft.startTime()).toString());
  const startTimeDate = new Date(startTime * 1000);
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const block = await hre.ethers.provider.getBlock(blockNumber);
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║  on '" + hre.network.name + "'");
  console.log("║ NFT startTime in Unix:", startTime);
  console.log("║ NFT startTime in Date", startTimeDate);
  console.log("║ current time in seconds:", block.timestamp);
  console.log("║ current Date", new Date(block.timestamp * 1000));
  if (startTime > block.timestamp) {
    console.log("║ ETA (s):", startTime - block.timestamp);
  }
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

// example yarn hardhat nft:starttime --time 1701615500 --network sepolia
task("nft:starttime", "Sets the StartTime")
  .addParam("time", "StarTime in Unix format")
  .setAction(async ({ time }, hre) => {
    const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENISIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENISIS_NFT_ADDRESSES],
    );

    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(blockNumber);
    const currentTimestamp = block.timestamp;

    const transaction = await nft.setStartTime(big(time));

    // convert unix seconds to date.
    const startTimeDate = new Date(time * 1000);

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ Set the TokenDistribution.startTime on " + hre.network.name);
    console.log("║ " + "current block time", currentTimestamp);
    console.log("║ startTime in Unix:", time);
    console.log("║ startTime in Date", startTimeDate);
    console.log("║ Awaiting 5 confirmations ");
    const receipt = await transaction.wait();
    console.log("║ Tx: " + receipt.transactionHash);
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
