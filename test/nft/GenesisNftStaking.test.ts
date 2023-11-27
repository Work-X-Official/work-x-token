import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, ERC20, TokenDistribution } from "../../typings";
import { expectToRevert, getImpersonateAccounts, mineDays } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { mintNft, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";

config();

chai.use(solidity);

describe("GenesisNftStaking", () => {
  let nft: GenesisNft;
  let signerImpersonated: SignerWithAddress;
  let stablecoin: ERC20;
  let stablecoinDecimals: number;
  let accounts: SignerWithAddress[];
  let nftVoucherSigner: Wallet;
  let distribution: TokenDistribution;
  let workToken: WorkToken;

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;
  let nftMinter4: SignerWithAddress;
  let nftMinter5: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;
  let nftId4: number;
  let nftId5: number;

  let chainId: number;

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
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 11;
    distribution = await regenerateTokenDistribution(startTime, workToken);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
    await distribution.setWalletClaimable([nftMinter3.address], [500], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter4.address], [10000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter5.address], [100000], [0], [0], [0]);
    await mineDays(12, network);
    ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
    ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 500, 0, 0, chainId));
    ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter4, 10000, 0, 0, chainId));
    ({ nftId: nftId5 } = await mintNft(network, nft, workToken, nftMinter5, 100000, 0, 0, chainId));
  });

  it("On day 0, Check that the total for month 0 is oke and that all the total amounts are correct", async () => {
    const totals = await nft.getTotals(0);
    const totalExpected = amount(500 + 10000 + 100000);
    expect(totals._minimumBalance).to.be.equal(totalExpected);
    expect(totals._totalBalance).to.be.equal(totalExpected);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 0)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 0)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 0)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 0)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(500));
    expect((await nft.getNftInfoAtMonth(nftId3, 0)).staked).to.be.equal(amount(500));
    expect((await nft.getNftInfoAtMonth(nftId3, 0)).minimumStaked).to.be.equal(amount(500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId4, 0)).staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId4, 0)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(100000));
    expect((await nft.getNftInfoAtMonth(nftId5, 0)).staked).to.be.equal(amount(100000));
    expect((await nft.getNftInfoAtMonth(nftId5, 0)).minimumStaked).to.be.equal(amount(100000));
  });

  it("On day 10, is oke and that all the total amounts are correct.", async () => {
    await mineDays(10, network);

    // nftMinter2 and nftMinter3 stake
    await nft.connect(nftMinter2).stake(nftId2, amount(1000));
    await nft.connect(nftMinter3).stake(nftId3, amount(2000));

    const totals = await nft.getTotals(0);
    const minimumExpected = amount(500 + 10000 + 100000);
    const expectedTotal = amount(1000 + 2500 + 10000 + 100000);
    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 0)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 0)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(1000));
    expect((await nft.getNftInfoAtMonth(nftId2, 0)).staked).to.be.equal(amount(1000));
    expect((await nft.getNftInfoAtMonth(nftId2, 0)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(2500));
    expect((await nft.getNftInfoAtMonth(nftId3, 0)).staked).to.be.equal(amount(2500));
    expect((await nft.getNftInfoAtMonth(nftId3, 0)).minimumStaked).to.be.equal(amount(500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId4, 0)).staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId4, 0)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(100000));
    expect((await nft.getNftInfoAtMonth(nftId5, 0)).staked).to.be.equal(amount(100000));
    expect((await nft.getNftInfoAtMonth(nftId5, 0)).minimumStaked).to.be.equal(amount(100000));
  });

  it("On day 40, stake in nft4, and 5, check if all amounts are correct.", async () => {
    await mineDays(30, network);

    await nft.connect(nftMinter4).stake(nftId4, amount(5000));
    await nft.connect(nftMinter5).stake(nftId5, amount(5000));

    const totalsPrev = await nft.getTotals(0);
    const minimumExpectedPrev = amount(500 + 10000 + 100000);
    const expectedTotalPrev = amount(1000 + 2500 + 10000 + 100000);
    expect(totalsPrev._minimumBalance).to.be.equal(minimumExpectedPrev);
    expect(totalsPrev._totalBalance).to.be.equal(expectedTotalPrev);

    const totals = await nft.getTotals(1);
    const minimumExpected = amount(1000 + 2500 + 10000 + 100000);
    const expectedTotal = amount(1000 + 2500 + 15000 + 105000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 1)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 1)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(1000));
    expect((await nft.getNftInfoAtMonth(nftId2, 1)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 1)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(2500));
    expect((await nft.getNftInfoAtMonth(nftId3, 1)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId3, 1)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 1)).staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 1)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(105000));
    expect((await nft.getNftInfoAtMonth(nftId5, 1)).staked).to.be.equal(amount(105000));
    expect((await nft.getNftInfoAtMonth(nftId5, 1)).minimumStaked).to.be.equal(amount(100000));
  });

  it("On day 50, stake in nft2, and 3, check if all amounts are correct.", async () => {
    await mineDays(10, network);

    await nft.connect(nftMinter2).stake(nftId2, amount(10000));
    await nft.connect(nftMinter3).stake(nftId3, amount(10000));

    const totalsPrev = await nft.getTotals(0);
    const minimumExpectedPrev = amount(500 + 10000 + 100000);
    const expectedTotalPrev = amount(1000 + 2500 + 10000 + 100000);
    expect(totalsPrev._minimumBalance).to.be.equal(minimumExpectedPrev);
    expect(totalsPrev._totalBalance).to.be.equal(expectedTotalPrev);

    const totals = await nft.getTotals(1);
    const minimumExpected = amount(1000 + 2500 + 10000 + 100000);
    const expectedTotal = amount(11000 + 12500 + 15000 + 105000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 1)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 1)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(11000));
    expect((await nft.getNftInfoAtMonth(nftId2, 1)).staked).to.be.equal(amount(11000));
    expect((await nft.getNftInfoAtMonth(nftId2, 1)).minimumStaked).to.be.equal(amount(1000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(12500));
    expect((await nft.getNftInfoAtMonth(nftId3, 1)).staked).to.be.equal(amount(12500));
    expect((await nft.getNftInfoAtMonth(nftId3, 1)).minimumStaked).to.be.equal(amount(2500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 1)).staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 1)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(105000));
    expect((await nft.getNftInfoAtMonth(nftId5, 1)).staked).to.be.equal(amount(105000));
    expect((await nft.getNftInfoAtMonth(nftId5, 1)).minimumStaked).to.be.equal(amount(100000));
  });

  it("On day 60, all nfts stake, check if all amounts are correct.", async () => {
    await mineDays(10, network);

    await nft.connect(nftMinter1).stake(nftId1, amount(5000));
    await nft.connect(nftMinter2).stake(nftId2, amount(5000));
    await nft.connect(nftMinter3).stake(nftId3, amount(5000));
    await nft.connect(nftMinter4).stake(nftId4, amount(5000));
    await nft.connect(nftMinter5).stake(nftId5, amount(5000));

    const totals = await nft.getTotals(2);
    const minimumExpected = amount(11000 + 12500 + 15000 + 105000);
    const expectedTotal = amount(5000 + 16000 + 17500 + 20000 + 110000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(5000));
    expect((await nft.getNftInfoAtMonth(nftId1, 2)).staked).to.be.equal(amount(5000));
    expect((await nft.getNftInfoAtMonth(nftId1, 2)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(16000));
    expect((await nft.getNftInfoAtMonth(nftId2, 2)).staked).to.be.equal(amount(16000));
    expect((await nft.getNftInfoAtMonth(nftId2, 2)).minimumStaked).to.be.equal(amount(11000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(17500));
    expect((await nft.getNftInfoAtMonth(nftId3, 2)).staked).to.be.equal(amount(17500));
    expect((await nft.getNftInfoAtMonth(nftId3, 2)).minimumStaked).to.be.equal(amount(12500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId4, 2)).staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId4, 2)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(110000));
    expect((await nft.getNftInfoAtMonth(nftId5, 2)).staked).to.be.equal(amount(110000));
    expect((await nft.getNftInfoAtMonth(nftId5, 2)).minimumStaked).to.be.equal(amount(105000));
  });

  it("On day 70, 2 and 3 unstake, check if all amounts are correct.", async () => {
    await mineDays(10, network);

    await nft.connect(nftMinter2).unstake(nftId2, amount(6000));
    await nft.connect(nftMinter3).unstake(nftId3, amount(6000));

    const totals = await nft.getTotals(2);
    const minimumExpected = amount(10000 + 11500 + 15000 + 105000);
    const expectedTotal = amount(5000 + 10000 + 11500 + 20000 + 110000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(5000));
    expect((await nft.getNftInfoAtMonth(nftId1, 2)).staked).to.be.equal(amount(5000));
    expect((await nft.getNftInfoAtMonth(nftId1, 2)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId2, 2)).staked).to.be.equal(amount(10000));
    expect((await nft.getNftInfoAtMonth(nftId2, 2)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(11500));
    expect((await nft.getNftInfoAtMonth(nftId3, 2)).staked).to.be.equal(amount(11500));
    expect((await nft.getNftInfoAtMonth(nftId3, 2)).minimumStaked).to.be.equal(amount(11500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId4, 2)).staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId4, 2)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(110000));
    expect((await nft.getNftInfoAtMonth(nftId5, 2)).staked).to.be.equal(amount(110000));
    expect((await nft.getNftInfoAtMonth(nftId5, 2)).minimumStaked).to.be.equal(amount(105000));
  });

  it("On day 90, 1, 2 stake, 3, 4 unstake, check if all amounts are correct.", async () => {
    await mineDays(20, network);

    await nft.connect(nftMinter1).stake(nftId1, amount(10000));
    await nft.connect(nftMinter2).stake(nftId2, amount(10000));
    await nft.connect(nftMinter3).unstake(nftId3, amount(4000));
    await nft.connect(nftMinter4).unstake(nftId4, amount(4000));

    const totals = await nft.getTotals(3);
    const minimumExpected = amount(5000 + 10000 + 7500 + 16000 + 110000);
    const expectedTotal = amount(15000 + 20000 + 7500 + 16000 + 110000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId1, 3)).staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId1, 3)).minimumStaked).to.be.equal(amount(5000));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId2, 3)).staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId2, 3)).minimumStaked).to.be.equal(amount(10000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(7500));
    expect((await nft.getNftInfoAtMonth(nftId3, 3)).staked).to.be.equal(amount(7500));
    expect((await nft.getNftInfoAtMonth(nftId3, 3)).minimumStaked).to.be.equal(amount(7500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(16000));
    expect((await nft.getNftInfoAtMonth(nftId4, 3)).staked).to.be.equal(amount(16000));
    expect((await nft.getNftInfoAtMonth(nftId4, 3)).minimumStaked).to.be.equal(amount(16000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(110000));
    expect((await nft.getNftInfoAtMonth(nftId5, 3)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId5, 3)).minimumStaked).to.be.equal(amount(0));
  });

  it("On day 120, only nft 5 stakes, check if all amounts are correct.", async () => {
    await mineDays(30, network);

    await nft.connect(nftMinter5).stake(nftId5, amount(20000));

    const totals = await nft.getTotals(4);
    const minimumExpected = amount(15000 + 20000 + 7500 + 16000 + 110000);
    const expectedTotal = amount(15000 + 20000 + 7500 + 16000 + 130000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId1, 4)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 4)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId2, 4)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 4)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(7500));
    expect((await nft.getNftInfoAtMonth(nftId3, 4)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId3, 4)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(16000));
    expect((await nft.getNftInfoAtMonth(nftId4, 4)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId4, 4)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(130000));
    expect((await nft.getNftInfoAtMonth(nftId5, 4)).staked).to.be.equal(amount(130000));
    expect((await nft.getNftInfoAtMonth(nftId5, 4)).minimumStaked).to.be.equal(amount(110000));
  });

  it("On day 150, only nft 4 unstakes, check if all amounts are correct.", async () => {
    await mineDays(30, network);

    await nft.connect(nftMinter4).unstake(nftId4, amount(1000));

    const totals = await nft.getTotals(5);
    const minimumExpected = amount(15000 + 20000 + 7500 + 15000 + 130000);
    const expectedTotal = amount(15000 + 20000 + 7500 + 15000 + 130000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId1, 5)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId1, 5)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId2, 5)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 5)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(7500));
    expect((await nft.getNftInfoAtMonth(nftId3, 5)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId3, 5)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 5)).staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 5)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(130000));
    expect((await nft.getNftInfoAtMonth(nftId5, 5)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId5, 5)).minimumStaked).to.be.equal(amount(0));
  });

  it("On day 210, only nft 1 stakes, check if all amounts are correct.", async () => {
    await mineDays(60, network);

    await nft.connect(nftMinter1).stake(nftId1, amount(15000));

    const totals = await nft.getTotals(7);
    const minimumExpected = amount(15000 + 20000 + 7500 + 15000 + 130000);
    const expectedTotal = amount(30000 + 20000 + 7500 + 15000 + 130000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(30000));
    expect((await nft.getNftInfoAtMonth(nftId1, 7)).staked).to.be.equal(amount(30000));
    expect((await nft.getNftInfoAtMonth(nftId1, 7)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(20000));
    expect((await nft.getNftInfoAtMonth(nftId2, 7)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId2, 7)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(7500));
    expect((await nft.getNftInfoAtMonth(nftId3, 7)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId3, 7)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 7)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId4, 7)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(130000));
    expect((await nft.getNftInfoAtMonth(nftId5, 7)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId5, 7)).minimumStaked).to.be.equal(amount(0));
  });

  it("On day 220, 1,2,3, 5, unstakes 1000, check if all amounts are correct.", async () => {
    await mineDays(10, network);

    await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
    await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
    await nft.connect(nftMinter3).unstake(nftId3, amount(1000));
    await nft.connect(nftMinter5).unstake(nftId5, amount(1000));

    const totals = await nft.getTotals(7);

    const minimumExpected = amount(15000 + 19000 + 6500 + 15000 + 129000);
    const expectedTotal = amount(29000 + 19000 + 6500 + 15000 + 129000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(29000));
    expect((await nft.getNftInfoAtMonth(nftId1, 7)).staked).to.be.equal(amount(29000));
    expect((await nft.getNftInfoAtMonth(nftId1, 7)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(19000));
    expect((await nft.getNftInfoAtMonth(nftId2, 7)).staked).to.be.equal(amount(19000));
    expect((await nft.getNftInfoAtMonth(nftId2, 7)).minimumStaked).to.be.equal(amount(19000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(6500));
    expect((await nft.getNftInfoAtMonth(nftId3, 7)).staked).to.be.equal(amount(6500));
    expect((await nft.getNftInfoAtMonth(nftId3, 7)).minimumStaked).to.be.equal(amount(6500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(15000));
    expect((await nft.getNftInfoAtMonth(nftId4, 7)).staked).to.be.equal(amount(0));
    expect((await nft.getNftInfoAtMonth(nftId4, 7)).minimumStaked).to.be.equal(amount(0));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(129000));
    expect((await nft.getNftInfoAtMonth(nftId5, 7)).staked).to.be.equal(amount(129000));
    expect((await nft.getNftInfoAtMonth(nftId5, 7)).minimumStaked).to.be.equal(amount(129000));
  });

  it("On day 400, everybody stakes 40000, check if all amounts are correct.", async () => {
    await mineDays(180, network);

    await nft.connect(nftMinter1).stake(nftId1, amount(50000));
    await nft.connect(nftMinter2).stake(nftId2, amount(50000));
    await nft.connect(nftMinter3).stake(nftId3, amount(50000));
    await nft.connect(nftMinter4).stake(nftId4, amount(50000));
    await nft.connect(nftMinter5).stake(nftId5, amount(50000));

    const totals = await nft.getTotals(13);
    const minimumExpected = amount(29000 + 19000 + 6500 + 15000 + 129000);
    const expectedTotal = amount(79000 + 69000 + 56500 + 65000 + 179000);

    expect(totals._minimumBalance).to.be.equal(minimumExpected);
    expect(totals._totalBalance).to.be.equal(expectedTotal);

    expect((await nft.getNftInfo(nftId1))._staked).to.be.equal(amount(79000));
    expect((await nft.getNftInfoAtMonth(nftId1, 13)).staked).to.be.equal(amount(79000));
    expect((await nft.getNftInfoAtMonth(nftId1, 13)).minimumStaked).to.be.equal(amount(29000));

    expect((await nft.getNftInfo(nftId2))._staked).to.be.equal(amount(69000));
    expect((await nft.getNftInfoAtMonth(nftId2, 13)).staked).to.be.equal(amount(69000));
    expect((await nft.getNftInfoAtMonth(nftId2, 13)).minimumStaked).to.be.equal(amount(19000));

    expect((await nft.getNftInfo(nftId3))._staked).to.be.equal(amount(56500));
    expect((await nft.getNftInfoAtMonth(nftId3, 13)).staked).to.be.equal(amount(56500));
    expect((await nft.getNftInfoAtMonth(nftId3, 13)).minimumStaked).to.be.equal(amount(6500));

    expect((await nft.getNftInfo(nftId4))._staked).to.be.equal(amount(65000));
    expect((await nft.getNftInfoAtMonth(nftId4, 13)).staked).to.be.equal(amount(65000));
    expect((await nft.getNftInfoAtMonth(nftId4, 13)).minimumStaked).to.be.equal(amount(15000));

    expect((await nft.getNftInfo(nftId5))._staked).to.be.equal(amount(179000));
    expect((await nft.getNftInfoAtMonth(nftId5, 13)).staked).to.be.equal(amount(179000));
    expect((await nft.getNftInfoAtMonth(nftId5, 13)).minimumStaked).to.be.equal(amount(129000));
  });

  describe("Test stakeAndEvolve", async () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;
    let nftMinter3: SignerWithAddress;
    let nftMinter4: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;
    let nftId3: number;
    let nftId4: number;

    before(async () => {
      nftMinter1 = accounts[3];
      nftMinter2 = accounts[4];
      nftMinter3 = accounts[5];
      nftMinter4 = accounts[6];
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken);
      await distribution.setWalletClaimable([nftMinter4.address], [155000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 0, 0, 0, chainId));
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter4, 155000, 0, 0, chainId));
    });

    it("Cannot call stakeAndEvolve if you are not the owner", async () => {
      await expectToRevert(
        nft.connect(nftMinter2).stakeAndEvolve(nftId1, amount(1000)),
        "GenesisNft: You are not the owner of this NFT",
      );
    });
    it("Cannot call stakeAndEvolve before the nft startTime (except level 80 people)", async () => {
      await expectToRevert(
        nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(1)),
        "GenesisNft: The amount you want to stake is more than the total allowance",
      );
      // go to nft Starttime
      await mineDays(12, network);
    });

    it("StakeAndEvolve nftId1 at day 20 increase stake nftInfo is correct(did not evolve to tier 1)", async () => {
      await mineDays(20, network);
      const amount = ethers.utils.parseEther("5000");
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount);
      expect(await nft.getStaked(nftId1)).to.be.equal(amount);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount);
      expect(nftInfo._shares).to.be.equal(11 + 50);
      expect(nftInfo._tier).to.be.equal(0);
      expect(await nft.getLevel(nftId1)).to.be.equal(9);
    });
    it("StakeAndEvolve nftId2 at day 40 increase stake nftInfo is correct(did evolve to tier 1)", async () => {
      await mineDays(20, network);
      const amount = ethers.utils.parseEther("11000");
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount);
      expect(await nft.getStaked(nftId2)).to.be.equal(amount);
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount);
      expect(nftInfo._shares).to.be.equal(23 + 50);
      expect(nftInfo._tier).to.be.equal(1);
      expect(await nft.getLevel(nftId2)).to.be.equal(16);
    });
    it("StakeAndEvolve nftId3 at day 60, increase stake and nftInfo is correct, did evolve to tier 2", async () => {
      await mineDays(20, network);
      const amount = ethers.utils.parseEther("16000");
      await nft.connect(nftMinter3).stakeAndEvolve(nftId3, amount);
      expect(await nft.getStaked(nftId3)).to.be.equal(amount);
      const nftInfo = await nft.getNftInfo(nftId3);
      expect(nftInfo._staked).to.be.equal(amount);
      expect(nftInfo._shares).to.be.equal(33 + 50);
      expect(nftInfo._tier).to.be.equal(2);
      expect(await nft.getLevel(nftId3)).to.be.equal(21);
    });

    it("StakeAndEvolve nftId4 is level 80, so can stakeAndEvolve unlimited but will not increase tier", async () => {
      const amountMint = ethers.utils.parseEther("155000");
      const amountStake = ethers.utils.parseEther("95000");
      const nftInfoBefore = await nft.getNftInfo(nftId4);
      expect(await nft.getLevel(nftId4)).to.be.equal(80);
      expect(nftInfoBefore._staked).to.be.equal(amountMint);
      expect(nftInfoBefore._shares).to.be.equal(320 + 50);
      expect(nftInfoBefore._tier).to.be.equal(8);
      await nft.connect(nftMinter4).stakeAndEvolve(nftId4, amountStake);
      const nftInfoAfter = await nft.getNftInfo(nftId4);
      expect(nftInfoAfter._staked).to.be.equal(amountMint.add(amountStake));
      expect(nftInfoAfter._shares).to.be.equal(320 + 50);
      expect(nftInfoAfter._tier).to.be.equal(8);
      expect(await nft.getLevel(nftId4)).to.be.equal(80);
    });
  });
});
