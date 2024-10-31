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
  console.log("║  Retrieving the _level, _tier, _stakedAmount over all nfts...");

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
      console.log("Nft with id:", i, " does not exists");
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
