import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";

import { SWAP_V2, WORK_TOKEN_ADDRESSES, WORK_TOKEN_ADDRESSES_V2 } from "../constants/workToken.constants";

// yarn hardhat swapv2:deploy --network sepolia
task("swapv2:deploy").setAction(async ({ _ }, hre) => {
  const workTokenOld = WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES];
  const workTokenNew = WORK_TOKEN_ADDRESSES_V2[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES_V2];
  const swapV2 = await (await hre.ethers.getContractFactory("SwapV2")).deploy(workTokenOld, workTokenNew);
  await swapV2.deployed();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Swap V2 contract deployed to:", swapV2.address);
  console.log("║ On network:", hre.network.name);
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");

  await swapV2.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    contract: "contracts/work/SwapV2.sol:SwapV2",
    address: swapV2.address,
    constructorArguments: [workTokenOld, workTokenNew],
  });
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Swap V2 contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

task("swapv2:verify").setAction(async ({ _ }, hre) => {
  const workTokenOld = WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES];
  const workTokenNew = WORK_TOKEN_ADDRESSES_V2[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES_V2];
  const swapV2 = (await hre.ethers.getContractFactory("SwapV2")).attach(
    SWAP_V2[hre.network.name as keyof typeof SWAP_V2],
  );
  console.log(workTokenOld, workTokenNew, swapV2.address);
  await hre.run("verify:verify", {
    contract: "contracts/work/SwapV2.sol:SwapV2",
    address: swapV2.address,
    constructorArguments: [workTokenOld, workTokenNew],
  });
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Swap V2 contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
