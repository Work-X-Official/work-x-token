import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
// import { config } from "dotenv";
import { task } from "hardhat/config";
import { GenesisNft } from "../../typings";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";

// example yarn hardhat nft:details --id 10 --network sepolia
task("nft:details", "Prints the details of a specific nft")
  .addParam("id", "id of the nft")
  .setAction(async ({ id }, hre) => {
    const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
    const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║  NFT info on '" + hre.network.name + "' for NFT with id " + id);
    console.log("║  NFT contract address:", nft.address);

    try {
      const owner = await nft.ownerOf(id);
      console.log("║  Owner:", owner);
      const _nft = await nft.getNftInfo(id);
      console.log("║  Level:", _nft[3].toNumber());
      console.log("║  Tier:", _nft[4].toNumber());
      const staked = hre.ethers.utils.formatEther(_nft[0]);
      console.log("║  Staked:", staked);
      const stakingAllowance = hre.ethers.utils.formatEther(_nft[1]);
      console.log("║  Staking allowance:", stakingAllowance);
      const shares = _nft[2].toNumber() / 10;
      console.log("║  Shares:", shares);
      console.log("║  Lock period:", _nft[5].toNumber() + " seconds.");
      console.log("╚══════════════════════════════════════════════════════════════════════");
    } catch (error) {
      throw new Error(`Retrieving information went wrong ${error}`);
    }
  });

// example: yarn hardhat nft:info --network sepolia
task("nft:info", "Prints the global information of the nft contract").setAction(async ({ _ }, hre) => {
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║  NFT details on '" + hre.network.name + "'");
  console.log("║  NFT contract address:", nft.address);
  console.log("║  retrieving information about nfts...");
  try {
    const ownerOfContract = await nft.owner();
    console.log("║  owner of the contract:", ownerOfContract);
    const amountNftsMinted = await nft.nftIdCounter();
    console.log("║  amount of nfts minted:", amountNftsMinted);
    const currentMonth = await nft.getCurrentMonth();
    console.log("║  the current month:", currentMonth);
    const _totals = await nft.getTotals(currentMonth);
    const totalShares = _totals._totalShares;
    console.log("║  the total shares of all nfts in the current month:", totalShares.toString());
    const totalStaked = hre.ethers.utils.formatEther(_totals._totalBalance);
    console.log("║  the total staked amount of all nfts in the current month:", totalStaked);
    const totalMinimumBalance = hre.ethers.utils.formatEther(_totals._minimumBalance);
    console.log("║  the total minimum balance of all nfts in the current month:", totalMinimumBalance);
    console.log("╚══════════════════════════════════════════════════════════════════════");
  } catch (error) {
    console.log("retrieving information went wrong", error);
  }
});
