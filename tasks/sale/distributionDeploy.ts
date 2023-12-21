import "@nomiclabs/hardhat-waffle";

import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { SALE_DISTRIBUTION_ADDRESSES } from "../constants/distribution.constants";
import { TokenDistribution } from "../../typings";

// example: yarn hardhat distribution:deploy --network sepolia

task("distribution:deploy").setAction(async function (_, hre) {
  // IMPORTANT! Make sure you have previously deployed the WorkToken contract, and added it's address to the constants
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const startTime = (await hre.ethers.provider.getBlock("latest")).timestamp + 60 * 60 * 24 * 14;
  // const startTime = 1701770400; //deployed to production with
  const startTimeDate = new Date(startTime * 1000);
  const accounts = await hre.ethers.getSigners();
  const distribution = await (
    await hre.ethers.getContractFactory("TokenDistribution")
  ).deploy(workToken.address, startTime);
  await distribution.deployed();
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ TokenDistribution deployed to:", distribution.address);
  console.log("║ On network: ", hre.network.name);
  console.log("║ The startTime is in seconds:", startTime);
  console.log("║ The startTime in Date:", startTimeDate);

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

task("distribution:verify").setAction(async function (_, hre) {
  const distribution: TokenDistribution = (await hre.ethers.getContractFactory("TokenDistribution")).attach(
    SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES],
  );
  const startTime = 1701770400;
  const workTokenAddress = await distribution.workToken();
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ The Token Distribution is being verified");
  console.log("║ With startTime:", startTime);
  console.log("║ And $WORK Token Address:", workTokenAddress);
  await hre.run("verify:verify", {
    contract: "contracts/sale/TokenDistribution.sol:TokenDistribution",
    address: distribution.address,
    constructorArguments: [workTokenAddress, startTime],
  });
  console.log("");
  console.log("║ $WORK Distribution contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
