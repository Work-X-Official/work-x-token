import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { GenesisNft, RewardShares, RewardTokens, RewardWrapper, WorkToken } from "../../typings";
import {
  REWARD_SHARES_ADDRESSES,
  REWARD_TOKENS_ADDRESSES,
  REWARD_WRAPPER_ADDRESSES,
} from "../constants/reward.constants";

/****
 **** DEPLOY
 ****/

// yarn hardhat rewardtokens:deploy --network sepolia
task("rewardtokens:deploy").setAction(async (_, hre) => {
  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
  );
  const [deployer] = await hre.ethers.getSigners();
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Contract deployment with the deployer:", deployer.address);
  console.log("║ Deployer balance:", (await deployer.getBalance()).toString());
  console.log("║ On network:", hre.network.name);
  const rewardTokens = await (await hre.ethers.getContractFactory("RewardTokens"))
    .connect(deployer)
    .deploy(nft.address, workToken.address);
  console.log("║ Deploying RewardTokens .....");
  await rewardTokens.deployed();
  console.log("║ RewardTokens deployed to:", rewardTokens.address);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

// yarn hardhat rewardshares:deploy --network sepolia
task("rewardshares:deploy").setAction(async (_, hre) => {
  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const nft: GenesisNft = (await hre.ethers.getContractFactory("GenesisNft")).attach(
    GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES],
  );
  const [deployer] = await hre.ethers.getSigners();
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Contract deployment with the deployer:", deployer.address);
  console.log("║ Deployer balance:", (await deployer.getBalance()).toString());
  console.log("║ On network:", hre.network.name);
  console.log("║ Deploying RewardShares .....");
  const rewardShares = await (await hre.ethers.getContractFactory("RewardShares"))
    .connect(deployer)
    .deploy(nft.address, workToken.address);
  await rewardShares.deployed();
  console.log("║ RewardShares deployed to:", rewardShares.address);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

// yarn hardhat rewardwrapper:deploy --network sepolia
task("rewardwrapper:deploy").setAction(async (_, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const rewardTokensAddress = REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES];
  const rewardSharesAddress = REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES];
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ Contract deployment with the deployer:", deployer.address);
  console.log("║ Deployer balance:", (await deployer.getBalance()).toString());
  console.log("║ On network:", hre.network.name);
  console.log("║ Deploying RewardWrapper .....");
  const rewardWrapper = await (await hre.ethers.getContractFactory("RewardWrapper"))
    .connect(deployer)
    .deploy(nftAddress, [rewardTokensAddress, rewardSharesAddress]);
  await rewardWrapper.deployed();
  console.log("║ RewardWrapper deployed to:", rewardWrapper.address);
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

/****
 **** VERIFY
 ****/

// yarn hardhat rewardtokens:verify --network sepolia
task("rewardtokens:verify").setAction(async function (_, hre) {
  const rewardTokens: RewardTokens = (await hre.ethers.getContractFactory("RewardTokens")).attach(
    REWARD_TOKENS_ADDRESSES[hre.network.name as keyof typeof REWARD_TOKENS_ADDRESSES],
  );
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const workTokenAddress = WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES];
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log(`║ RewardTokens with address ${rewardTokens.address} is being verified`);
  console.log("║ With NFT address:", nftAddress);
  console.log("║ And $WORK Token Address:", workTokenAddress);
  await hre.run("verify:verify", {
    contract: "contracts/reward/RewardTokens.sol:RewardTokens",
    address: rewardTokens.address,
    constructorArguments: [nftAddress, workTokenAddress],
  });
  console.log("");
  console.log("║ RewardTokens contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

// yarn hardhat rewardshares:verify --network sepolia
task("rewardshares:verify").setAction(async function (_, hre) {
  const rewardShares: RewardShares = (await hre.ethers.getContractFactory("RewardShares")).attach(
    REWARD_SHARES_ADDRESSES[hre.network.name as keyof typeof REWARD_SHARES_ADDRESSES],
  );
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  const workTokenAddress = WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES];
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log(`║ RewardShares with address ${rewardShares.address} is being verified`);
  console.log("║ With NFT address:", nftAddress);
  console.log("║ And $WORK Token Address:", workTokenAddress);
  await hre.run("verify:verify", {
    contract: "contracts/reward/RewardShares.sol:RewardShares",
    address: rewardShares.address,
    constructorArguments: [nftAddress, workTokenAddress],
  });
  console.log("");
  console.log("║ RewardShares contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});

// yarn hardhat rewardwrapper:verify --network sepolia
task("rewardwrapper:verify").setAction(async function (_, hre) {
  const rewardWrapper: RewardWrapper = (await hre.ethers.getContractFactory("RewardWrapper")).attach(
    REWARD_WRAPPER_ADDRESSES[hre.network.name as keyof typeof REWARD_WRAPPER_ADDRESSES],
  );
  const rewardAddresses = await rewardWrapper.getRewarders();
  const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log(`║ RewardWrapper with address ${rewardWrapper.address} is being verified`);
  console.log("║ With reward addresses of targets contracts:", rewardAddresses);
  await hre.run("verify:verify", {
    contract: "contracts/reward/RewardWrapper.sol:RewardWrapper",
    address: rewardWrapper.address,
    constructorArguments: [nftAddress, rewardAddresses],
  });
  console.log("");
  console.log("║ RewardWrapper contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
