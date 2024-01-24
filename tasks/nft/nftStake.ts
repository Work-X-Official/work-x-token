import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { WorkToken } from "../../typings";
import { amount } from "../../test/util/helpers.util";

// example:
// yarn hardhat nft:stake:nfts --startid [nftId] --endid [nftId] --stake [amount of WORK] --approve --network sepolia
task("nft:stake:nfts", "Stake stakeAmount into each from from startid to endid")
  .addParam("startid", "fist nft id to stake in")
  .addParam("endid", "last nft id to stake in")
  .addParam("stake", "amount to stake in each nft")
  .addFlag("approve", "approve the nft contract to spend the stake amount")
  .setAction(async ({ startid, endid, stake, approve }, hre) => {
    const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);
    const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );
    stake = amount(stake);
    const [deployer] = await hre.ethers.getSigners();
    const net = await hre.ethers.provider.getNetwork();
    const chainId = net.chainId;
    console.log("╔═════�");
    console.log("║" + " Staking nfts from " + startid + " to " + endid);
    console.log("║" + " In nft contract " + nft.address);
    console.log("║" + " On chain id" + chainId);
    console.log("║" + " Checking if the you own all nfts from " + startid + " to " + endid);

    const balance = await workToken.balanceOf(deployer.address);
    if (balance.lt(stake.mul(endid - startid + 1))) {
      throw new Error(`The WORK balance is not enough to stake in all nfts`);
    }

    for (let i = startid; i <= endid; i++) {
      const owner = await nft.ownerOf(i);
      if (owner !== deployer.address) {
        throw new Error(`${deployer.address} are not the owner of nft with id ${i}`);
      }
    }

    console.log("║" + " Checking if nfts have enough staking allowance " + startid + " to " + endid);
    for (let i = startid; i <= endid; i++) {
      const allowance = (await nft.getNftInfo(i))[1];
      if (allowance.lte(stake)) {
        throw new Error(`The staking allowance is not enough for nft with id ${i}`);
      }
    }

    console.log("║" + " Start staking....");
    for (let i = startid; i <= endid; i++) {
      if (approve) {
        console.log("║" + " Approving nft with id " + i + " to spend " + stake);
        const tx = await workToken.connect(deployer).approve(nft.address, stake);
        const receipt = await tx.wait();
        console.log("║" + " Approved with tx hash " + receipt.transactionHash);
      }
      console.log("║" + " Staking in nft with id " + i);
      const tx = await nft.connect(deployer).stake(i, stake);
      const receipt = await tx.wait();
      console.log("║" + " Staked with tx hash " + receipt.transactionHash);
    }
    console.log("╚═════�");
  });
