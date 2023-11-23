import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, GenesisNftData, TokenDistribution } from "../../typings";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { mintNftMany } from "../util/nft.util";

config();

chai.use(solidity);

// To use these test it is necessary to set number of accounts in hardhat config to minimum 350

describe.only("GenesisNftMintType", () => {
  let nft: GenesisNft;
  let nftData: GenesisNftData;
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

    await regenerateWorkToken();
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 6;
    await regenerateTokenDistribution(startTime);
    await regenerateNft();
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

  const regenerateNft = async (): Promise<GenesisNft> => {
    nftData = await (await ethers.getContractFactory("GenesisNftData", signerImpersonated)).deploy();
    nft = await (
      await ethers.getContractFactory("GenesisNft", signerImpersonated)
    ).deploy("Work X Genesis NFT", "Work X Genesis NFT", workToken.address, distribution.address, nftData.address);
    await nft.deployed();
    await nft.grantRole(await nft.SIGNER_ROLE(), nftVoucherSigner.address);
    await workToken.grantRole(await workToken.MINTER_ROLE(), nft.address);
    return nft;
  };

  const regenerateWorkToken = async (minter = accounts[0].address): Promise<boolean> => {
    workToken = await (await ethers.getContractFactory("WorkToken")).deploy();
    await workToken.grantRole(await workToken.MINTER_ROLE(), minter);
    for (let i = 0; i < 10; i++) {
      await workToken.mint(accounts[i].address, amount(250000));
    }
    return true;
  };

  const regenerateTokenDistribution = async (_startTime: number) => {
    if (_startTime == null) {
      _startTime = (await ethers.provider.getBlock("latest")).timestamp;
    }
    distribution = (await (
      await ethers.getContractFactory("TokenDistribution")
    ).deploy(workToken.address, _startTime)) as TokenDistribution;
    await workToken.grantRole(await workToken.MINTER_ROLE(), distribution.address);
  };
});
