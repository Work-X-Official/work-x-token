import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, TokenDistribution } from "../../typings";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { mintNftMany, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";

config();

chai.use(solidity);

/**
 * IMPORTANT: To use these test it is necessary to set number of accounts in hardhat config to 1000
 * These tests take a long time to run, so they are skipped by default, remove .skip to run them
 **/

describe.skip("GenesisNftMintType", () => {
  let nft: GenesisNft;
  let signerImpersonated: SignerWithAddress;

  let accounts: SignerWithAddress[];
  let nftVoucherSigner: Wallet;
  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let chainId: number;

  before(async () => {
    chainId = (await ethers.provider.getNetwork()).chainId;
    accounts = await ethers.getSigners();

    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 6;
    distribution = await regenerateTokenDistribution(startTime, workToken);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
  });

  describe("Minting", async () => {
    let nftCount = 0;

    it("Mint all 349 nfts of type 0, so all but one", async () => {
      const quantity = 349;
      const type = 0;
      const nftIds = await mintNftMany(network, nft, workToken, accounts, quantity, type, chainId);
      nftCount += nftIds.length;
      const nftCountRead = await nft.nftIdCounter();
      expect(nftCountRead).to.equal(349);
      expect(nftCount).to.equal(349);
    }).timeout(1000000);

    it("Mint the last nft of type 0, so making the total 350", async () => {
      const quantity = 1;
      const type = 0;
      const nftIds = await mintNftMany(network, nft, workToken, accounts, quantity, type, chainId);
      nftCount += nftIds.length;
      const nftCountRead = await nft.nftIdCounter();
      expect(nftCountRead).to.equal(350);
      expect(nftCount).to.equal(350);
    });
  });
});
