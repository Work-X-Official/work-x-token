import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

// Example: yarn hardhat work:role:minter --to 0x0 --network sepolia
task("work:role:minter")
  .addParam("address", "the addres you want to grant the MINTER_ROLE to")
  .setAction(async ({ address }, hre) => {
    const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ WorkToken contract:", workToken.address);
    console.log("║ Account that will receive the MINTER_ROLE: ", address);
    const currentBalance = await workToken.balanceOf(address);
    console.log("║ Previous $WORK balance of the account:", hre.ethers.utils.formatEther(currentBalance));
    const grantRole = await workToken.grantRole(await workToken.MINTER_ROLE(), address);
    await grantRole.wait();
    console.log("║ The MINTER_ROLE has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });

// Example: yarn hardhat work:role:defaultadmin --address 0x0 --network sepolia
task("work:role:defaultadmin")
  .addParam("address", "the addres you want to grant the DEFAULT_ADMIN_ROLE to")
  .setAction(async ({ address }, hre) => {
    const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ WorkToken contract:", workToken.address);
    console.log("║ Account that will receive the DEFAULT_ADMIN_ROLE: ", address);
    const currentBalance = await workToken.balanceOf(address);
    console.log("║ Previous $WORK balance of the account:", hre.ethers.utils.formatEther(currentBalance));
    const grantRole = await workToken.grantRole(await workToken.DEFAULT_ADMIN_ROLE(), address);
    await grantRole.wait();
    console.log("║ The DEFAULT_ADMIN_ROLE has been assigned to the the account");
    console.log("║ Waiting for confirmation...");
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
