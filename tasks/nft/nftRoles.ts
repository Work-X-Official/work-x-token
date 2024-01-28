import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";

//yarn hardhat nft:role:rewarder --address 0x0 --network sepolia
task("nft:role:rewarder")
  .addParam("address", "the addres you want to grant the NFT_ROLE to")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Account that will become a REWARDER: ", address);
    const grantRole = await nft.setRewarder(address, true);
    await grantRole.wait();
    console.log("║ The REWARDER role has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

//yarn hardhat nft:role:isrewarder --address 0x0 --network sepolia
task("nft:role:isrewarder")
  .addParam("address", "the addres you want to check the NFT_ROLE to")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Account that will become a REWARDER: ", address);
    const grantRole = await nft.setRewarder(address, true);
    await grantRole.wait();
    console.log("║ The REWARDER role has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

//yarn hardhat nft:role:rewarder:remove --address 0x0 --network sepolia
task("nft:role:rewarder:remove")
  .addParam("address", "the addres you want to remove the NFT_ROLE from")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Account that will stop being a REWARDER:", address);
    const grantRole = await nft.setRewarder(address, false);
    await grantRole.wait();
    console.log("║ The REWARDER role has been removed from the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
