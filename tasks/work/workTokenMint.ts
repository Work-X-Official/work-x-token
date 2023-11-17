import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

// Example: yarn hardhat work:mint --to 0x0 --amount 100 --network sepolia
task("work:mint")
  .addParam("to", "the addres you want to mint tokens to")
  .addParam("amount", "the amount you want to mint")
  .setAction(async ({ to, amount }, hre) => {
    const [minter] = await hre.ethers.getSigners();
    const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );
    const currentBalance = await workToken.balanceOf(to);

    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ On '" + hre.network.name + "'");
    console.log("║ WorkToken contract:", workToken.address);
    console.log("║ Account that will receive tokens: ", minter.address);
    console.log("║ Previous $WORK balance of the account:", hre.ethers.utils.formatEther(currentBalance));
    console.log("║ The minter is minting " + amount + " tokens to " + to);
    console.log("║ minting...");
    console.log("║ waiting for confirmation...");

    try {
      const mintTx = await workToken.mint(to, hre.ethers.utils.parseEther(amount));
      const receiptMint = await mintTx.wait();
      console.log("║ Tx: " + receiptMint.transactionHash);
    } catch (error) {
      throw new Error("error: " + error);
    }

    const newBalance = await workToken.balanceOf(to);
    console.log("║ New balance of work token from the account is:", newBalance.toString());
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
