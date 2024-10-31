import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
// import { config } from "dotenv";
import { task } from "hardhat/config";
import { GenesisNft } from "../../typings";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { createObjectCsvWriter as createCsvWriter } from "csv-writer";

type NftData = {
  id: number;
  level: number;
  tier: number;
  staked: string;
};

// example: yarn hardhat nft:data:all --network sepolia
task("nft:data:all", "Prints the details of a specific nft").setAction(async ({ _ }, hre) => {
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║  On '" + hre.network.name + "'");
  console.log("║  NFT contract address:", nft.address);
  console.log("║  Retrieving the sum of _level over all nfts...");

  const nftIdCounter = Number(await nft.nftIdCounter());
  const records: NftData[] = [];
  for (let i = 0; i < nftIdCounter; i++) {
    try {
      const nftId = await nft.getNftInfo(i);
      records.push({
        id: i,
        level: Number(nftId._level),
        tier: Number(nftId._tier),
        staked: hre.ethers.utils.formatEther(nftId._staked),
      });
    } catch (error) {
      /* needed for if the nft does not exists has been destroyed. */
      console.log("  i does not exists", i);
    }
  }

  console.log("╚══════════════════════════════════════════════════════════════════════");

  return new Promise(() => {
    const csvWriter = createCsvWriter({
      path: "nftInfo.csv",
      header: [
        {
          id: "id",
          title: "ID",
        },
        {
          id: "level",
          title: "Level",
        },
        {
          id: "tier",
          title: "Tier",
        },
        {
          id: "staked",
          title: "Staked",
        },
      ],
    });

    csvWriter
      .writeRecords(records) // returns a promise
      .then(() => {
        console.log("...Done");
      });
  });
});

// example: yarn hardhat nft:levels --network sepolia
task("nft:levels", "Prints the sum of the level over all nfts").setAction(async ({ _ }, hre) => {
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║  On '" + hre.network.name + "'");
  console.log("║  NFT contract address:", nft.address);
  console.log("║  Retrieving the sum of _level over all nfts...");

  let nftIdLevel = 0;
  let totalLevel = 0;
  const nftIdCounter = Number(await nft.nftIdCounter());
  for (let i = 0; i < nftIdCounter; i++) {
    try {
      process.stdout.write(`║  Retrieving level of NFT: ${i}/${nftIdCounter}\r`);
      nftIdLevel = Number((await nft.getNftInfo(i))._level);
      console.log("🚀 ~ task ~ nftIdLevel:", nftIdLevel);
      totalLevel += Number(nftIdLevel);
    } catch (error) {
      /* needed for if the nft does not exists has been destroyed. */
      console.log("  i does not exists", i);
    }
  }

  console.log("║  Sum of all levels over all NFTs is: ", totalLevel);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
