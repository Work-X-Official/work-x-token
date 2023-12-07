import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

// example command: yarn hardhat work:deploy --network sepolia
task("work:deploy").setAction(async ({ _ }, hre) => {
  const workToken = await (await hre.ethers.getContractFactory("WorkToken")).deploy();
  await workToken.deployed();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ $WORK Token deployed to:", workToken.address);
  console.log("║ On network:", hre.network.name);
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");

  await workToken.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    contract: "contracts/work/WorkToken.sol:WorkToken",
    address: workToken.address,
  });
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ $WORK Token contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

task("work:verify").setAction(async ({ _ }, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  await hre.run("verify:verify", {
    contract: "contracts/work/WorkToken.sol:WorkToken",
    address: workToken.address,
    arguments: [],
  });
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ $WORK Token contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
