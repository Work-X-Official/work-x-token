import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

// example: yarn hardhat  sale:distribution:deploy --network sepolia

task("sale:distribution:deploy").setAction(async function (_, hre) {
  // IMPORTANT! Make sure you have previously deployed the WorkToken contract, and added it's address to the constants
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const startTime = (await hre.ethers.provider.getBlock("latest")).timestamp + 80400;
  const tokenDistribution = await (
    await hre.ethers.getContractFactory("TokenDistribution")
  ).deploy(workToken.address, startTime);
  await tokenDistribution.deployed();
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ TokenDistribution deployed to:", tokenDistribution.address);
  console.log("║ On network: ", hre.network.name);
  console.log("║");

  const grantRole = await workToken.grantRole(await workToken.MINTER_ROLE(), tokenDistribution.address);
  const receiptGrantRole = await grantRole.wait(5);
  console.log("║ The tokenDistribution is granted the role to mint the WorkToken");
  console.log("║ Tx: " + receiptGrantRole.transactionHash);
  console.log("║");

  await tokenDistribution.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    contract: "contracts/sale/TokenDistribution.sol:TokenDistribution",
    address: tokenDistribution.address,
    constructorArguments: [workToken.address, startTime],
  });
  console.log("");
  console.log("║ $WORK Distribution contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
