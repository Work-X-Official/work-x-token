import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { GENESIS_NFT_ADDRESSES } from "../constants/nft.constants";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";
import { WorkToken } from "../../typings";
import { amount, big } from "../../test/util/helpers.util";
import * as fs from "fs";

// yarn hardhat nft:stake:all --stake [amount of $WORK] --network sepolia
task("nft:stake:all", "Stake stakeAmount into each from from startid to endid")
  .addParam("stake", "amount to stake in each nft")
  .setAction(async ({ stake }, hre) => {
    const nftAddress = GENESIS_NFT_ADDRESSES[hre.network.name as keyof typeof GENESIS_NFT_ADDRESSES];
    const nft = (await hre.ethers.getContractFactory("GenesisNft")).attach(nftAddress);
    const workToken: WorkToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
      WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
    );
    const stakeAmount = amount(stake);

    const [deployer] = await hre.ethers.getSigners();
    const ids = (await nft.getIdsFromWallet(deployer.address)).map(id => id.toNumber());
    const net = await hre.ethers.provider.getNetwork();
    const chainId = net.chainId;
    console.log("╔══════════════════════════════════════════════════════════════════════");
    console.log("║ Staking " + stake + " $WORK into all your " + ids.length + " Work X Genesis NFTs");
    console.log("║ NFT contract address: " + nft.address);
    console.log("║ Chain ID: " + chainId);

    const balance = await workToken.balanceOf(deployer.address);
    const balanceFormatted = hre.ethers.utils.formatEther(balance);
    console.log("║ Your $WORK balance: " + balanceFormatted);
    const totalStakeAmount = stake * ids.length;
    console.log("║ Total amount of $WORK to stake into all " + ids.length + " NFTs: " + totalStakeAmount);

    if (balance.lt(totalStakeAmount)) {
      throw new Error("Your WORK balance is not enough to stake " + stake + " in all your " + ids.length + " NFTs");
    }
    const skip: number[] = [];
    let approveAmount = big(0);
    console.log(`║ Checking if your ${ids.length} NFTs have enough staking allowance`);
    for (let i = 0; i < ids.length; i++) {
      const nftInfo = await nft.getNftInfo(ids[i]);
      const allowance = nftInfo._stakingAllowance;
      console.log(
        `║ ${i} NFT id ${ids[i]} has staking allowance ${hre.ethers.utils.formatEther(allowance.toString())}`,
      );

      if (allowance.lte(stakeAmount)) {
        skip.push(ids[i]);
      } else {
        approveAmount = approveAmount.add(stakeAmount);
      }
    }
    console.log("║ Allowance checked. " + skip.length + " NFTs have insufficient allowance");
    if (skip.length > 0) {
      const skipFormatted = skip.join(", ");
      console.log(`║ Skip staking because insufficient allowance for NFTs with id: ${skipFormatted}`);
    }

    //approve
    console.log(
      "║ Approving NFT with address " + nft.address + " to spend " + hre.ethers.utils.formatEther(approveAmount),
    );
    const tx = await workToken.connect(deployer).approve(nft.address, approveAmount);
    const receipt = await tx.wait();
    console.log("║ Approved with tx hash " + receipt.transactionHash);
    console.log("║ Start staking....");
    for (let i = 0; i < ids.length; i++) {
      if (skip.includes(ids[i])) {
        continue;
      }

      console.log("║ Staking in NFT with id " + ids[i]);
      const tx = await nft.connect(deployer).stake(ids[i], stakeAmount);
      const receipt = await tx.wait();
      console.log("║ Staked with tx hash " + receipt.transactionHash);
      fs.appendFileSync(`processed_ids_${hre.network.name}.txt`, `${ids[i]}\n`);
    }
    console.log("╚══════════════════════════════════════════════════════════════════════");
  });
