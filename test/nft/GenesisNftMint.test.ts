import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, TokenDistribution, ERC20 } from "../../typings";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { _mintNft, mintNft, mintNftMany, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";
import { amount, getImpersonateAccounts, mineDays } from "../util/helpers.util";

config();

chai.use(solidity);

/**
 * IMPORTANT: To use these test it is necessary to set number of accounts in hardhat config to 1000
 * These tests take a long time to run, so they are skipped by default, remove .skip to run them
 **/

describe("GenesisNftMint", () => {
  let nft: GenesisNft;
  let signerImpersonated: SignerWithAddress;

  let accounts: SignerWithAddress[];
  let nftVoucherSigner: Wallet;
  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let chainId: number;

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;
  let nftMinter4: SignerWithAddress;
  let nftMinter5: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;
  let nftId4: number;

  let stablecoin: ERC20;
  let stablecoinDecimals: number;

  before(async () => {
    chainId = (await ethers.provider.getNetwork()).chainId;
    accounts = await ethers.getSigners();

    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 7;
    distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
  });

  describe("Minting Type", async () => {
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
    it("Should revert when trying to mint another nft of type 0", async () => {
      const type = 0;
      await expect(mintNft(network, nft, workToken, accounts[350], 0, 0, type, chainId)).to.be.revertedWith(
        "NftMintUnavailable",
      );
    });
    it("Mint all remaining nfts by owner", async () => {
      await nft.mintRemainingToTreasury();
      const nftCountRead = await nft.nftIdCounter();
      expect(nftCountRead).to.equal(999);
    });
    it("Should revert with All nfts minted", async () => {
      await expect(mintNft(network, nft, workToken, accounts[356], 0, 0, 0, chainId)).to.be.revertedWith(
        "NftMintUnavailable",
      );
      await expect(mintNft(network, nft, workToken, accounts[356], 0, 0, 1, chainId)).to.be.revertedWith(
        "NftMintUnavailable",
      );
      await expect(mintNft(network, nft, workToken, accounts[356], 0, 0, 2, chainId)).to.be.revertedWith(
        "NftMintUnavailable",
      );
    });
    it("Should revert if someone mints with an invalid type", async () => {
      await expect(mintNft(network, nft, workToken, accounts[356], 0, 0, 3, chainId)).to.be.revertedWith(
        "MintTypeInvalid",
      );
    });
  });

  describe("Minting Nft with $WORK Tokens", async () => {
    before(async () => {
      const acc = await getImpersonateAccounts(network);
      chainId = (await ethers.provider.getNetwork()).chainId;
      signerImpersonated = await ethers.getSigner(acc.signerImpersonatedAddress);
      stablecoin = await ethers.getContractAt("ERC20", acc.stablecoinAddress);
      stablecoinDecimals = await stablecoin.decimals();
      accounts = await ethers.getSigners();

      nftMinter1 = accounts[0];
      nftMinter2 = accounts[1];
      nftMinter3 = accounts[2];
      nftMinter4 = accounts[3];
      nftMinter5 = accounts[4];

      if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
      nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(
        ethers.provider,
      );

      await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 13;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await distribution.setWalletClaimable([nftMinter1.address], [5000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [5000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [100000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter4.address], [100000], [0], [0], [0]);
    });

    it("At day 0, NftMinter 1 tries to claim something, but there is nothing to claim yet at start", async () => {
      const balanceBefore = await workToken.balanceOf(nftMinter1.address);
      expect(balanceBefore).to.be.equal(amount(250_000));
      await expect(distribution.connect(nftMinter1).claimTokens()).to.be.revertedWith(
        "TokenDistribution: You don't have any tokens to claim",
      );
      const balanceAfter = await workToken.balanceOf(nftMinter1.address);
      expect(balanceAfter).to.be.equal(amount(250_000));
      expect(balanceAfter).to.be.equal(balanceBefore);
    });

    it("At day 6, NftMinter 1 and NftMinter 3 claim their vested tokens from the seed Sale", async () => {
      const balanceBeforeMinter1 = await workToken.balanceOf(nftMinter1.address);
      const balanceBeforeMinter3 = await workToken.balanceOf(nftMinter3.address);
      await mineDays(6, network);
      await distribution.connect(nftMinter1).claimTokens();
      await distribution.connect(nftMinter3).claimTokens();
      const balanceAfterMinter1 = await workToken.balanceOf(nftMinter1.address);
      const balanceAfterMinter3 = await workToken.balanceOf(nftMinter3.address);

      expect(balanceAfterMinter1).to.be.gt(balanceBeforeMinter1);
      expect(balanceAfterMinter3).to.be.gt(balanceBeforeMinter3);
    });

    it("At day 6, NftMinter 1 claims his nft, and will try to stake tokens in it, but it will be minted without any tokens within it.", async () => {
      ({ nftId: nftId1 } = await _mintNft(network, nft, workToken, nftMinter1, 5000, 0, 0, chainId));
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId1, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(0));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(0));
    });

    it("At day 6, NftMinter 2 claims his nft with all his 5000 tokens staked in it", async () => {
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 5000, 0, 0, chainId));
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId2, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(5000));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(5000));
      const claimed = await distribution.claimedTokens(nftMinter2.address);
      expect(claimed).to.be.equal(amount(5000));
    });

    it("At day 6, NftMinter 3 claims his nft with 0 tokens staked in it", async () => {
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 0, 0, 0, chainId));
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId3, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(0));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(0));
    });

    it("At day 6, NftMinter 4 claims his nft with half 50000 tokens staked in it", async () => {
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter4, 50000, 0, 0, chainId));
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId4, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(50000));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(50000));
      const claimed = await distribution.claimedTokens(nftMinter4.address);
      expect(claimed).to.be.equal(amount(50000));
    });

    it("Move to end of vesting, where everyone will claims tokens", async () => {
      await mineDays(550, network);
    });

    it("nftMinter 1 claimed tokens before minting his nft, so no tokens in the nft and all tokens in his wallet", async () => {
      await distribution.connect(nftMinter1).claimTokens();
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId1, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(0));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(0));
      const balance = await workToken.balanceOf(nftMinter1.address);
      expect(balance).to.be.equal(amount(250_000 + 5000));
      const claimed = await distribution.claimedTokens(nftMinter1.address);
      expect(claimed).to.be.equal(amount(5000));
    });

    it("nftMinter 2 claimed no tokens before minting his nft, so akk tokens in the nft and no additional tokens in his wallet", async () => {
      await expect(distribution.connect(nftMinter2).claimTokens()).to.be.revertedWith(
        "TokenDistribution: You don't have any tokens to claim",
      );
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId2, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(5000));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(5000));
      const balance = await workToken.balanceOf(nftMinter2.address);
      expect(balance).to.be.equal(amount(250_000));
      const claimed = await distribution.claimedTokens(nftMinter2.address);
      expect(claimed).to.be.equal(amount(5000));
    });

    it("nftMinter 3 claimed tokens before minting his nft, so no tokens in the nft and all tokens in his wallet", async () => {
      await distribution.connect(nftMinter3).claimTokens();
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId3, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(0));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(0));
      const balance = await workToken.balanceOf(nftMinter3.address);
      expect(balance).to.be.equal(amount(250_000 + 100_000));
      const claimed = await distribution.claimedTokens(nftMinter3.address);
      expect(claimed).to.be.equal(amount(100_000));
    });

    it("nftMinter 4 claimed no tokens before minting his nft, minted half of his tokens in nft and then half of tokens in his wallet", async () => {
      await distribution.connect(nftMinter4).claimTokens();
      const _tokenIdInfoAtMonth = await nft.getStaked(nftId4, 0);
      expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(50000));
      expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(50000));
      const balance = await workToken.balanceOf(nftMinter4.address);
      expect(balance).to.be.equal(amount(2250000 + 50000));
      const claimed = await distribution.claimedTokens(nftMinter4.address);
      expect(claimed).to.be.equal(amount(100_000));
    });

    it("Mint NFT with invalid _lockTime", async () => {
      await expect(
        mintNft(network, nft, workToken, nftMinter5, 50000, 60 * 60 * 24 * 600, 0, chainId),
      ).to.be.revertedWith("LockPeriodInvalid");
    });
  });
});
