import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { SALE_DISTRIBUTION_ADDRESSES } from "../constants/saleDistribution.constants";
import { WorkToken } from "../../typings";

// deploys a contract and sets who can sign vouchers and set grants the token distribution contract the right to mint tokens, which is needed for the NFT mint.
// example:
// yarn hardhat nft:deploy --network sepolia

task("nft:deploy").setAction(async (_, hre) => {
  const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  const tokenDistributionAddress =
    SALE_DISTRIBUTION_ADDRESSES[hre.network.name as keyof typeof SALE_DISTRIBUTION_ADDRESSES];
  const [deployer] = await hre.ethers.getSigners();
  let nftVoucherSigner;
  if (process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) {
    nftVoucherSigner = new hre.ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER).connect(hre.ethers.provider);
  } else {
    throw new Error("Please set the PRIVATE_KEY_NFT_VOUCHER_SIGNER environment variable");
  }

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ GenesisNft contract deployment with the deployer:", deployer.address);
  console.log("║ Deployer balance:", (await deployer.getBalance()).toString());
  console.log("║ On network:", hre.network.name);
  console.log("║");
  const nftAttributes = await (await hre.ethers.getContractFactory("GenesisNftAttributes", deployer)).deploy();
  const nftData = await (await hre.ethers.getContractFactory("GenesisNftData"))
    .connect(deployer)
    .deploy(nftAttributes.address);
  await nftData.deployed();

  console.log("║ Deploying the data NFT contract, so that the GenesisNft contract can be deployed that uses this data");
  console.log("║ GenesisNftData deployed to address:", nftData.address);
  console.log("║");

  const nft = await (await hre.ethers.getContractFactory("GenesisNft"))
    .connect(deployer)
    .deploy(
      "Work X Genesis NFT",
      "Work X Genesis NFT",
      workToken.address,
      tokenDistributionAddress,
      nftData.address,
      nftVoucherSigner.address,
    );

  await nft.deployed();
  await nft.deployTransaction.wait(5);

  console.log("║ GenesisNft deployed to:", nft.address);
  console.log("║ On network:", hre.network.name);
  console.log("║ Owner: ", await nft.owner());
  console.log("║");

  const roletx = await workToken.grantRole(await workToken.MINTER_ROLE(), nft.address);
  await roletx.wait();

  console.log("║ The GenesisNft was granted the MINTER_ROLE by the WorkToken contract");
  await hre.run("verify:verify", {
    contract: "contracts/nft/GenesisNft.sol:GenesisNft",
    address: nft.address,
    constructorArguments: [
      "Work X Genesis NFT",
      "Work X Genesis NFT",
      workToken.address,
      tokenDistributionAddress,
      nftData.address,
      nftVoucherSigner.address,
    ],
  });
  console.log("║");
  console.log("║ The Genesis NFT contract has been verified.");
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");
});
