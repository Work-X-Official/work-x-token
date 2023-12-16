import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { GenesisNftData } from "../../typings";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { amount } from "../util/helpers.util";

chai.use(solidity);

describe("GenesisNftData", () => {
  let nftData: GenesisNftData;
  let accounts: SignerWithAddress[];

  before(async () => {
    accounts = await ethers.getSigners();
    const nftAttributes = await (await ethers.getContractFactory("GenesisNftAttributes", accounts[0])).deploy();
    nftData = await (await ethers.getContractFactory("GenesisNftData", accounts[0])).deploy(nftAttributes.address);
  });

  describe("Test Encoding", () => {
    it("Test splitBytes", async () => {
      const result = await nftData.splitBytes("0x0104050A320000000C09580000000000");
      expect(result).to.eql([1, 4, 5, 10, 50, 0, 0, 0, 12, 9, 88]);
    });

    it("Test decodeAttributes", async () => {
      const attributes = await nftData.decodeAttributes("0x0104050a1e000000000000".concat("0".repeat(42)), 1);
      expect(attributes).to.eql([
        "Female",
        "Caramel",
        "Community Moderator",
        "Earring Silver-Pink",
        "Mobile Office",
        "Amber Blue",
        "Black Hat",
        "Full",
        "Blush Light",
        "None",
        "Business Suit",
      ]);
    });

    it("Test decodeAttributes not initialized", async () => {
      const attributes = await nftData.decodeAttributes("0x0104050a1e000000000000".concat("0".repeat(42)), 0);
      expect(attributes).to.eql(["?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"]);
    });
  });

  it("The token amount corresponds to the correct level", async () => {
    expect(await nftData.getLevel(amount(0))).to.be.equal(ethers.BigNumber.from(0));
    expect(await nftData.getLevel(amount(550))).to.be.equal(ethers.BigNumber.from(1));
    expect(await nftData.getLevel(amount(1056))).to.be.equal(ethers.BigNumber.from(2));
    expect(await nftData.getLevel(amount(1125))).to.be.equal(ethers.BigNumber.from(2));
    expect(await nftData.getLevel(amount(25000))).to.be.equal(ethers.BigNumber.from(29));
    expect(await nftData.getLevel(amount(152975))).to.be.equal(ethers.BigNumber.from(80));
    expect(await nftData.getLevel(amount(175000))).to.be.equal(ethers.BigNumber.from(80));
  });

  it("The token amount corresponds to the correct capped level", async () => {
    expect(await nftData.getLevelCapped(amount(0), 0)).to.be.equal(ethers.BigNumber.from(0));
    expect(await nftData.getLevelCapped(amount(550), 0)).to.be.equal(ethers.BigNumber.from(1));
    expect(await nftData.getLevelCapped(amount(1056), 0)).to.be.equal(ethers.BigNumber.from(2));
    expect(await nftData.getLevelCapped(amount(1125), 0)).to.be.equal(ethers.BigNumber.from(2));
    expect(await nftData.getLevelCapped(amount(25000), 0)).to.be.equal(ethers.BigNumber.from(10));
    expect(await nftData.getLevelCapped(amount(152975), 5)).to.be.equal(ethers.BigNumber.from(60));
    expect(await nftData.getLevelCapped(amount(175000), 8)).to.be.equal(ethers.BigNumber.from(80));
  });
});
