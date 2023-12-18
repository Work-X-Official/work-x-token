import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { DISTRIBUTION_ADDRESSES } from "../constants/distribution.constants";

// example: yarn hardhat distribution:role:nft --address 0x0 --network sepolia
task("distribution:role:nft")
  .addParam("address", "the addres you want to grant the NFT_ROLE to")
  .setAction(async ({ address }, hre) => {
    const distribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
      DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof DISTRIBUTION_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ Distribution contract:", distribution.address);
    console.log("║ Account that will receive the NFT_ROLE: ", address);
    const grantRole = await distribution.grantRole(await distribution.NFT_ROLE(), address);
    await grantRole.wait();
    console.log("║ The NFT_ROLE has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

// example: yarn hardhat distribution:role:defaultadmin --address 0x0 --network sepolia
task("distribution:role:defaultadmin")
  .addParam("address", "the addres you want to grant the DEFAULT_ADMIN_ROLE to")
  .setAction(async ({ address }, hre) => {
    const distribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
      DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof DISTRIBUTION_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ Distribution contract:", distribution.address);
    console.log("║ Account that will receive the DEFAULT_ADMIN_ROLE: ", address);
    const grantRole = await distribution.grantRole(await distribution.DEFAULT_ADMIN_ROLE(), address);
    await grantRole.wait();
    console.log("║ The DEFAULT_ADMIN_ROLE has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
