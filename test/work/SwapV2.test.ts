import { amount } from "./../util/helpers.util";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SwapV2, WorkToken } from "../../typings";
import { approveWorkToken, regenerateWorkToken, sendToken } from "../util/worktoken.util";

// this test requires the "initialDate: "2023-12-05 10:10:00 AM"," to be commented in, in hardhat.config.ts
describe.only("SwapV2", function () {
  let accounts: SignerWithAddress[];
  let workTokenOld: WorkToken;
  let workTokenNew: WorkToken;
  let swapV2: SwapV2;

  let deployer: SignerWithAddress;
  let swapper1: SignerWithAddress;
  let swapper2: SignerWithAddress;

  this.beforeAll(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    swapper1 = accounts[1];
    swapper2 = accounts[2];
    workTokenOld = await regenerateWorkToken(accounts, deployer.address, false);
    await approveWorkToken(network, workTokenOld, deployer, swapper1.address);
    workTokenNew = await regenerateWorkToken(accounts, deployer.address, false);
    swapV2 = (await (
      await ethers.getContractFactory("SwapV2")
    ).deploy(workTokenOld.address, workTokenNew.address)) as SwapV2;
    // await approveWorkToken(network, workTokenNew, swapV2swapper1, swapV2.address);
    await sendToken(network, deployer, swapV2.address, amount(1000000), workTokenNew);
  });

  describe("Whitelist", () => {
    it("Deployer should be able to whitelist an address", async () => {
      await swapV2.connect(deployer).whitelist(swapper1.address, true);
    });
    it("Non-deployer address should not be able to whitelist an address", async () => {
      await expect(swapV2.connect(swapper1).whitelist(swapper2.address, true)).to.be.reverted;
    });
  });

  describe("Swap", () => {
    it("Non-whitelisted address should not be able to swap", async () => {
      await expect(swapV2.connect(swapper2).swap()).to.be.revertedWith("NotWhitelisted");
    });

    it("Whitelisted address without v1 balance should not be able to swap", async () => {
      await expect(swapV2.connect(swapper1).swap()).to.be.revertedWith("SwapAmountZero");
    });

    it("Whitelisted address without approved v1 allowance should not be able to swap", async () => {
      await sendToken(network, deployer, swapper1.address, amount(1000), workTokenOld);
      await expect(swapV2.connect(swapper1).swap()).to.be.revertedWith("SwapAmountAllowanceInsufficient");
    });

    it("Whitelisted address with v1 balance and approved allowance should be able to swap", async () => {
      await approveWorkToken(network, workTokenOld, swapper1, swapV2.address);
      const balanceOldBefore = await workTokenOld.balanceOf(swapper1.address);
      const balanceNewBefore = await workTokenNew.balanceOf(swapper1.address);
      await swapV2.connect(swapper1).swap();
      const balanceOldAfter = await workTokenOld.balanceOf(swapper1.address);
      const balanceNewAfter = await workTokenNew.balanceOf(swapper1.address);
      expect(balanceOldAfter).to.equal(0);
      expect(balanceNewAfter).to.equal(balanceNewBefore.add(balanceOldBefore));
    });
  });
});
