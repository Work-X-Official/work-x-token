import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { config } from "dotenv";
import { GenesisNftData } from "../../typings";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

config();

chai.use(solidity);

describe("GenesisNft Byte Operations", () => {
  let accounts: SignerWithAddress[];
  let nftData: GenesisNftData;

  before(async () => {
    accounts = await ethers.getSigners();
    nftData = await (await ethers.getContractFactory("GenesisNftData", accounts[0])).deploy();
  });

  it("Test splitBytes", async () => {
    const result = await nftData.splitBytes(ethers.utils.formatBytes32String("0104051050000000000001"));
    expect(result).to.eql([1, 4, 5, 10, 50, 0, 0, 0, 0, 0, 1]);
  });

  it("Test decodeAttributes", async () => {
    const result = await nftData.decodeAttributes(ethers.utils.formatBytes32String("0104051030000000000001"));
    const attributes: string[] = [];
    for (let i = 0; i < result.length; i++) {
      attributes.push(ethers.utils.parseBytes32String(result[i]));
    }
    expect(attributes).to.eql([
      "Female",
      "Caramel",
      "Community Moderator",
      "Earring Silver-Pink",
      "Mobile Office",
      "Amber Blue",
      "Black Hat",
      "Full",
      "Blush Ligh",
      "Business Suit",
      "A/B Testing",
    ]);
  });
});
