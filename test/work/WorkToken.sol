import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { WorkToken } from "../../typings";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { regenerateWorkToken } from "../util/worktoken.util";
import { BigNumber } from "ethers";

config();

chai.use(solidity);

describe.only("WorkToken", () => {
  let accounts: SignerWithAddress[];
  let minter1: SignerWithAddress;
  let minter2: SignerWithAddress;
  let workToken: WorkToken;

  before(async () => {
    accounts = await ethers.getSigners();
    minter1 = accounts[3];
    minter2 = accounts[4];

    workToken = await regenerateWorkToken(accounts, accounts[0].address);
  });

  describe("Minting", async () => {
    it("You cannot mint tokens if you are not a minter", async () => {
      await expect(
        workToken.connect(minter2).mint(minter1.address, ethers.utils.parseUnits("100", 18)),
      ).to.be.revertedWith(
        `AccessControl: account ${minter2.address.toLowerCase()} is missing role ${await workToken.MINTER_ROLE()}`,
      );
    });
    it("You can mint tokens if you have a minter Role", async () => {
      const balanceBefore = await workToken.balanceOf(minter1.address);

      await workToken.connect(accounts[0]).mint(minter1.address, ethers.utils.parseUnits("100", 18));
      const balanceAfter = await workToken.balanceOf(minter1.address);

      expect(balanceAfter).to.be.eq(balanceBefore.add(ethers.utils.parseUnits("100", 18)));
    });
  });

  describe("Burning", async () => {
    it("You cannot burnFrom other people tokens without approval", async () => {
      const balance = await workToken.balanceOf(minter1.address);
      expect(balance).to.be.gt(0);
      await expect(
        workToken.connect(minter2).burnFrom(minter1.address, ethers.utils.parseUnits("100", 18)),
      ).to.be.revertedWith("ERC20: insufficient allowance'");
    });
    it("You can burn your own tokens", async () => {
      const balanceBefore = await workToken.balanceOf(minter1.address);
      expect(balanceBefore).to.be.gt(0);

      await workToken.connect(minter1).burn(ethers.utils.parseUnits("2250100", 18));
      const balanceAfter = await workToken.balanceOf(minter1.address);
      expect(balanceAfter).to.be.eq(0);
    });
  });
  describe("Capped Amount", async () => {
    let cap: BigNumber;
    it("The cap is 100M tokens", async () => {
      cap = await workToken.cap();
      expect(cap).to.be.eq(ethers.utils.parseUnits("100000000", 18));
    });

    it("The cap is 100M tokens, this can be minted", async () => {
      const currentSupplyBefore = await workToken.totalSupply();
      const mintable = cap.sub(currentSupplyBefore);

      await workToken.connect(accounts[0]).mint(minter1.address, mintable);
      const currentSupplyAfter = await workToken.totalSupply();
      expect(currentSupplyAfter).to.be.eq(cap);
    });

    it("Revert if trying to mint more", async () => {
      await expect(workToken.connect(accounts[0]).mint(minter1.address, BigNumber.from(1))).to.be.revertedWith(
        "ERC20Capped: cap exceeded",
      );
    });

    it("After a burn more can be minted", async () => {
      const amountBurn = ethers.utils.parseUnits("1000", 18);
      await workToken.connect(minter1).burn(amountBurn);
      await workToken.connect(accounts[0]).mint(minter1.address, ethers.utils.parseUnits("1000", 18));
      const currentSupplyAfter = await workToken.totalSupply();
      expect(currentSupplyAfter).to.be.eq(cap);
    });
  });
});