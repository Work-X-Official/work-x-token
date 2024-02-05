import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";

//yarn hardhat nft:role:rewarder --address 0x0 --network sepolia
task("nft:role:rewarder")
  .addParam("address", "the address you want to grant the REWARDER role to")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Address that will become a REWARDER: ", address);
    const grantRole = await nft.setRewarder(address, true);
    console.log("║ Waiting for confirmation...");
    await grantRole.wait();
    console.log("║ The REWARDER role has been assigned to the the account");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

//yarn hardhat nft:role:isrewarder --address 0x0 --network sepolia
task("nft:role:isrewarder")
  .addParam("address", "the address you want to check the REWARDER role to")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Address checked for being a REWARDER: ", address);
    const isAddressRewarder = await nft.isRewarder(address);
    if (isAddressRewarder) {
      console.log("║ This address does have the REWARDER role");
    } else {
      console.log("║ This address does not have the REWARDER role");
    }
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

//yarn hardhat nft:role:rewarder:remove --address 0x0 --network sepolia
task("nft:role:rewarder:remove")
  .addParam("address", "the address you want to remove the REWARDER role from")
  .setAction(async ({ address }, hre) => {
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
      GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ NFT contract:", nft.address);
    console.log("║ Address that will stop being a REWARDER:", address);
    const grantRole = await nft.setRewarder(address, false);
    console.log("║ Waiting for confirmation...");
    await grantRole.wait();
    console.log("║ The REWARDER role has been removed from the address");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
