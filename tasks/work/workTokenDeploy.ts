import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";

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
