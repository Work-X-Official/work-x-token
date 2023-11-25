import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { config } from "dotenv";
import { GenesisNftData } from "../../typings";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

config();

chai.use(solidity);

describe("Byte Operations", () => {
  let accounts: SignerWithAddress[];
  let nftData: GenesisNftData;

  before(async () => {
    accounts = await ethers.getSigners();
    nftData = await (await ethers.getContractFactory("GenesisNftData", accounts[0])).deploy();
  });

  it("test splitBytes", async () => {
    const result = await nftData.splitBytes(ethers.utils.formatBytes32String("0104051050000000000001"));
    console.log(result);
    //expect(result).to.equal([1, 4, 5, 10, 50, 0, 0, 0, 0, 0, 1]);
  });

  it("test decodeAttributes", async () => {
    const result = await nftData.decodeAttributes(ethers.utils.formatBytes32String("0104051030000000000001"));
    console.log(result);
  });
});
