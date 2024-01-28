import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { mintNft } from "../util/nft.mint.util";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { WorkToken } from "../../typings";
// example:
// yarn hardhat nft:mint --network sepolia

task("nft:mint").setAction(async (_, hre) => {
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);
  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const [deployer] = await hre.ethers.getSigners();

  const stakingAmount = 0;
  const lockPeriod = 0;
  const type = 0;
  const net = await hre.ethers.provider.getNetwork();
  const chainId = net.chainId;

  const nftIds = await mintNft(net, nft, workToken, deployer, stakingAmount, lockPeriod, type, chainId);
  console.log("");
  console.log("╔═════�");
  console.log("║" + " Minting to address" + deployer.address);
  console.log("║" + " On chain id" + chainId);
  console.log("║" + " Minted nft with token id" + nftIds.nftId);
  console.log("║" + " Minted from voucher id" + nftIds.voucherId);
  console.log(
    `║  The nft will be visible on Opensea in a few mintues: https://testnets.opensea.io/assets/${hre.network.name}/${nft.address}/`,
  );
  console.log("╚═════�");
});

// yarn hardhat nft:minttreasury --network sepolia
task("nft:minttreasury").setAction(async (_, hre) => {
  const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
  );

  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  const chainId = net.chainId;

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║" + " Minting remaining NFTs to treasury " + deployer.address);
  console.log("║" + " On chain id " + chainId);
  await nft.mintRemainingToTreasury();
  console.log("║" + " Done");
  console.log("╚══════════════════════════════════════════════════════════════════════");
});
