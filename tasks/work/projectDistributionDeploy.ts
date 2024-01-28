import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import {
  PROJECT_DISTRIBUTION_ADDRESSES,
  PROJECT_DISTRIBUTION_SAFE_ADDRESSES,
  WORK_TOKEN_ADDRESSES,
} from "../constants/workToken.constants";

// yarn hardhat projectdistribution:deploy --network sepolia
task("projectdistribution:deploy").setAction(async ({ _ }, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const safes =
    PROJECT_DISTRIBUTION_SAFE_ADDRESSES[hre.network.name as keyof typeof PROJECT_DISTRIBUTION_SAFE_ADDRESSES];
  const projectDistribution = await (
    await hre.ethers.getContractFactory("ProjectDistribution")
  ).deploy(workToken.address, safes);
  await projectDistribution.deployed();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ ProjectDistribution contract deployed to:", projectDistribution.address);
  console.log("║ On network:", hre.network.name);
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

// yarn hardhat projectdistribution:verify --network sepolia
task("projectdistribution:verify").setAction(async ({ _ }, hre) => {
  const projectDistribution = (await hre.ethers.getContractFactory("ProjectDistribution")).attach(
    PROJECT_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof PROJECT_DISTRIBUTION_ADDRESSES],
  );
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const safes =
    PROJECT_DISTRIBUTION_SAFE_ADDRESSES[hre.network.name as keyof typeof PROJECT_DISTRIBUTION_SAFE_ADDRESSES];
  await hre.run("verify:verify", {
    contract: "contracts/work/ProjectDistribution.sol:ProjectDistribution",
    address: projectDistribution.address,
    arguments: [workToken, safes],
  });
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ ProjectDistribution contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
