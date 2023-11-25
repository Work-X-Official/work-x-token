import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { GenesisNftData } from "../../typings";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { amount } from "../util/helpers.util";

chai.use(solidity);

describe("GenesisNftData", () => {
  let genesisNftData: GenesisNftData;
  let accounts: SignerWithAddress[];

  before(async () => {
    accounts = await ethers.getSigners();
    genesisNftData = await (await ethers.getContractFactory("GenesisNftData", accounts[0])).deploy();
  });

  // it("the mapping GenderOptions should be initialized", async () => {
  //   const genderOption0 = await genesisNftData.genderOptions("00");
  //   expect(genderOption0).to.equal("Male");
  //   const genderOption1 = await genesisNftData.genderOptions("01");
  //   expect(genderOption1).to.equal("Female");
  // });

  // it("the mapping skinOptions should be initialized", async () => {
  //   const skinOption0 = await genesisNftData.skinOptions("00");
  //   expect(skinOption0).to.equal("Brown");
  // });

  // it("the function split should correctly split the string in two digits", async () => {
  //   const stringToSplit = "00112233";
  //   const result = await genesisNftData.split(stringToSplit);
  //   expect(result[0]).to.equal("00");
  //   expect(result[1]).to.equal("11");
  //   expect(result[2]).to.equal("22");
  //   expect(result[3]).to.equal("33");
  // });

  // it("the decodeAttributes function should return the correct attributes", async () => {
  //   const encodedAttributes = "010203";
  //   const decodedAttributes = await genesisNftData.decodeAttributes(encodedAttributes);
  //   expect(decodedAttributes.length).to.equal(3);
  //   expect(decodedAttributes[0]).to.equal("Female");
  //   expect(decodedAttributes[1]).to.equal("White");
  //   expect(decodedAttributes[2]).to.equal("Graphics Designer");
  // });

  it("The token amount corresponds to the correct level", async () => {
    expect(await genesisNftData.getLevel(amount(0))).to.be.equal(ethers.BigNumber.from(0));
    expect(await genesisNftData.getLevel(amount(550))).to.be.equal(ethers.BigNumber.from(1));
    expect(await genesisNftData.getLevel(amount(1056))).to.be.equal(ethers.BigNumber.from(2));
    expect(await genesisNftData.getLevel(amount(1125))).to.be.equal(ethers.BigNumber.from(2));
    expect(await genesisNftData.getLevel(amount(25000))).to.be.equal(ethers.BigNumber.from(29));
    expect(await genesisNftData.getLevel(amount(152975))).to.be.equal(ethers.BigNumber.from(80));
    expect(await genesisNftData.getLevel(amount(175000))).to.be.equal(ethers.BigNumber.from(80));
  });

  it("The token amount corresponds to the correct capped level", async () => {
    expect(await genesisNftData.getLevelCapped(amount(0), 0)).to.be.equal(ethers.BigNumber.from(0));
    expect(await genesisNftData.getLevelCapped(amount(550), 0)).to.be.equal(ethers.BigNumber.from(1));
    expect(await genesisNftData.getLevelCapped(amount(1056), 0)).to.be.equal(ethers.BigNumber.from(2));
    expect(await genesisNftData.getLevelCapped(amount(1125), 0)).to.be.equal(ethers.BigNumber.from(2));
    expect(await genesisNftData.getLevelCapped(amount(25000), 0)).to.be.equal(ethers.BigNumber.from(10));
    expect(await genesisNftData.getLevelCapped(amount(152975), 5)).to.be.equal(ethers.BigNumber.from(60));
    expect(await genesisNftData.getLevelCapped(amount(175000), 8)).to.be.equal(ethers.BigNumber.from(80));
  });
});
