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
  const accounts = await hre.ethers.getSigners();
  const distribution = await (
    await hre.ethers.getContractFactory("TokenDistribution")
  ).deploy(workToken.address, startTime);
  await distribution.deployed();
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ TokenDistribution deployed to:", distribution.address);
  console.log("║ On network: ", hre.network.name);
  console.log("║");

  const initRole = await distribution.grantRole(await distribution.INIT_ROLE(), accounts[0].address);
  const initGrantRole = await initRole.wait();
  console.log("║ The deployer is granted the INIT_ROLE");
  console.log("║ Tx: " + initGrantRole.transactionHash);
  console.log("║");

  const grantRole = await workToken.grantRole(await workToken.MINTER_ROLE(), distribution.address);
  const receiptGrantRole = await grantRole.wait();
  console.log("║ The tokenDistribution is granted the role to mint the WorkToken");
  console.log("║ Tx: " + receiptGrantRole.transactionHash);
  console.log("║");

  await distribution.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    contract: "contracts/sale/TokenDistribution.sol:TokenDistribution",
    address: distribution.address,
    constructorArguments: [workToken.address, startTime],
  });
  console.log("");
  console.log("║ $WORK Distribution contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
