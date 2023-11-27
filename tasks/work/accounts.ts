import { task } from "hardhat/config";
import { TokenDistribution } from "../../typings";
import { SALE_DISTRIBUTION_ADDRESSES } from "../constants/saleDistribution.constants";

// yarn hardhat account:info --address 0x0 --network sepolia
task("account:info", "Prints the list of accounts")
  .addParam("address", "address of the account")
  .setAction(async ({ address }, hre) => {
    const tokenDistribution: TokenDistribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
      SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES],
    );

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════════");
    const start = await tokenDistribution.startTime();
    console.log("║ Distribution started: " + start.toString() + " | " + new Date(start.toNumber() * 1000));
    const claimable = await tokenDistribution.claimableTokens(address);
    console.log("║ Claimable tokens:", claimable.toString());
    const claimedTokens = await tokenDistribution.claimedTokens(address);
    console.log("║ Claimed tokens:", claimedTokens.toString());
    const vestedTokens = await tokenDistribution.vestedTokens(address);
    console.log("║ Vested tokens:", vestedTokens.toString());
    const boughtTokens = await tokenDistribution.claimedTokens(address);
    console.log("║ Bought tokens:", boughtTokens.toString());
    console.log("╚══════════════════════════════════════════════════════════════════════");
    console.log("");
  });
