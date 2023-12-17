import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, ERC20, TokenDistribution } from "../../typings";
import { getImpersonateAccounts, mineDays } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { Stake, mintNft, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";

config();

chai.use(solidity);

describe("GenesisNftUpdateMonthly", () => {
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

  let nftId1: number;
  let nftId2: number;
  let nftId3: number;

  let chainId: number;

  before(async () => {
    const acc = await getImpersonateAccounts(network);
    chainId = (await ethers.provider.getNetwork()).chainId;
    signerImpersonated = await ethers.getSigner(acc.signerImpersonatedAddress);
    stablecoin = await ethers.getContractAt("ERC20", acc.stablecoinAddress);
    stablecoinDecimals = await stablecoin.decimals();
    accounts = await ethers.getSigners();

    nftMinter1 = accounts[1];
    nftMinter2 = accounts[2];
    nftMinter3 = accounts[3];

    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
    distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
    await distribution.setWalletClaimable([nftMinter2.address], [1000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [2000], [0], [0], [0]);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
    ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 1000, 0, 0, chainId));
    ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 2000, 0, 0, chainId));
  });

  describe("Test functions using updateMonthly. stake,unstake, destroy", () => {
    it("Minted state is correct", async () => {
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(0));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));

      const nftInfoMonth2 = await getNftInfoAtMonth(nftId2, 0);
      expect(nftInfoMonth2.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth2.minimumStaked).to.be.equal(amount(1000));

      const nftInfoMonth3 = await getNftInfoAtMonth(nftId3, 0);
      expect(nftInfoMonth3.staked).to.be.equal(amount(2000));
      expect(nftInfoMonth3.minimumStaked).to.be.equal(amount(2000));

      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3000));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });

    it("In month 0, day 0, nftMinter1 will stake 100", async () => {
      await mineDays(22, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(100));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3100));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });

    it("In month 0, day 0, nftMinter1 will stake 100 again", async () => {
      await nft.connect(nftMinter1).stake(nftId1, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(200));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3200));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });

    it("In month 0, day 0, nftMinter1 will try to unstake 50 but fail", async () => {
      await expect(nft.connect(nftMinter1).unstake(nftId1, amount(50))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("In month 1, day 30, nftMinter2 tries to unstake but fails", async () => {
      await mineDays(30, network);
      await expect(nft.connect(nftMinter2).unstake(nftId2, amount(1000))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("In month 1, day 30, nftMinter3 unstakes 500 and fails", async () => {
      await expect(nft.connect(nftMinter3).unstake(nftId3, amount(500))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("In month 1, nftMinter1 will stake 2800", async () => {
      await nft.connect(nftMinter1).stake(nftId1, amount(2800));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(3000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(200));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(6000));
      expect(totals._minimumBalance).to.be.equal(amount(3200));
    });

    it("In month 1, nftMinter2 will stake 2000", async () => {
      await nft.connect(nftMinter2).stake(nftId2, amount(2000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(3000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(8000));
      expect(totals._minimumBalance).to.be.equal(amount(3200));
    });

    it("In month 2, nftMinter2 will stake again 2000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter2).stake(nftId2, amount(2000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(5000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3000));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(10000));
      expect(totals._minimumBalance).to.be.equal(amount(8000));
    });

    it("In month 2, nftMinter3 will stake 3000 again", async () => {
      await nft.connect(nftMinter3).stake(nftId3, amount(3000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(5000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(2000));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(13000));
      expect(totals._minimumBalance).to.be.equal(amount(8000));
    });

    it("In month 3, nftMinter1 will stake 4000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(4000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(7000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3000));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(17000));
      expect(totals._minimumBalance).to.be.equal(amount(13000));
    });

    it("In month 3, nftMinter2 will stake 4000", async () => {
      await nft.connect(nftMinter2).stake(nftId2, amount(4000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(9000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(5000));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(21000));
      expect(totals._minimumBalance).to.be.equal(amount(13000));
    });

    it("In month 3, nftMinter1 will unstake 500", async () => {
      await nft.connect(nftMinter1).unstake(nftId1, amount(500));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(6500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3000));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(20500));
      expect(totals._minimumBalance).to.be.equal(amount(13000));
    });

    it("In month 4, nftMinter2 will stake 100", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter2).stake(nftId2, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(9100));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(9000));
      const totals = await nft.getTotals(4);
      expect(totals._totalBalance).to.be.equal(amount(20600));
      expect(totals._minimumBalance).to.be.equal(amount(20500));
    });

    it("In month 4, nftMinter2 will unstake 300", async () => {
      await nft.connect(nftMinter2).unstake(nftId2, amount(300));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(8800));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(8800));
      const totals = await nft.getTotals(4);
      expect(totals._totalBalance).to.be.equal(amount(20300));
      expect(totals._minimumBalance).to.be.equal(amount(20300));
    });

    it("In month 5, nftMinter1 will stake 1000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(7500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(6500));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(21300));
      expect(totals._minimumBalance).to.be.equal(amount(20300));
    });

    it("In month 5, nftMinter2 will stake 200", async () => {
      await nft.connect(nftMinter2).stake(nftId2, amount(200));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(9000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(8800));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(21500));
      expect(totals._minimumBalance).to.be.equal(amount(20300));
    });

    it("In month 5, nftMinter2 will unstake 300", async () => {
      await nft.connect(nftMinter2).unstake(nftId2, amount(300));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(8700));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(8700));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(21200));
      expect(totals._minimumBalance).to.be.equal(amount(20200));
    });

    it("In month 5, nftMinter2 will unstake 100 again", async () => {
      await nft.connect(nftMinter2).unstake(nftId2, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(8600));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(8600));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(21100));
      expect(totals._minimumBalance).to.be.equal(amount(20100));
    });

    it("In month 6, nftMinter1 will unstake 1000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 6);
      expect(nftInfoMonth.staked).to.be.equal(amount(6500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(6500));
      const totals = await nft.getTotals(6);
      expect(totals._totalBalance).to.be.equal(amount(20100));
      expect(totals._minimumBalance).to.be.equal(amount(20100));
    });

    it("In month 8, nftMinter1 will unstake 100", async () => {
      await mineDays(60, network);
      await nft.connect(nftMinter1).unstake(nftId1, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 8);
      expect(nftInfoMonth.staked).to.be.equal(amount(6400));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(6400));
      const totals = await nft.getTotals(8);
      expect(totals._totalBalance).to.be.equal(amount(20000));
      expect(totals._minimumBalance).to.be.equal(amount(20000));
    });

    it("In month 8, nftMinter1 will stake 100", async () => {
      await nft.connect(nftMinter1).stake(nftId1, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 8);
      expect(nftInfoMonth.staked).to.be.equal(amount(6500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(6400));
      const totals = await nft.getTotals(8);
      expect(totals._totalBalance).to.be.equal(amount(20100));
      expect(totals._minimumBalance).to.be.equal(amount(20000));
    });

    it("In month 18, nftMinter3 will stake 20000", async () => {
      await mineDays(300, network);
      await nft.connect(nftMinter3).stake(nftId3, amount(20000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 18);
      expect(nftInfoMonth.staked).to.be.equal(amount(25000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(5000));
      const totals = await nft.getTotals(18);
      expect(totals._totalBalance).to.be.equal(amount(40100));
      expect(totals._minimumBalance).to.be.equal(amount(20100));
    });

    it("In month 19, nftMinter3 will unstake 1000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter3).unstake(nftId3, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 19);
      expect(nftInfoMonth.staked).to.be.equal(amount(24000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(24000));
      const totals = await nft.getTotals(19);
      expect(totals._totalBalance).to.be.equal(amount(39100));
      expect(totals._minimumBalance).to.be.equal(amount(39100));
    });

    it("In month 39, nftMinter1 will stake 1500000", async () => {
      await mineDays(600, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(150000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 39);
      expect(nftInfoMonth.staked).to.be.equal(amount(156500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(6500));
      const totals = await nft.getTotals(39);
      expect(totals._totalBalance).to.be.equal(amount(189100));
      expect(totals._minimumBalance).to.be.equal(amount(39100));
    });

    it("In month 39, nftMinter2 will stake 1500000", async () => {
      await nft.connect(nftMinter2).stake(nftId2, amount(150000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 39);
      expect(nftInfoMonth.staked).to.be.equal(amount(158600));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(8600));
      const totals = await nft.getTotals(39);
      expect(totals._totalBalance).to.be.equal(amount(339100));
      expect(totals._minimumBalance).to.be.equal(amount(39100));
    });
    it("In month 39, nftMinter3 will stake 1500000", async () => {
      await nft.connect(nftMinter3).stake(nftId3, amount(150000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 39);
      expect(nftInfoMonth.staked).to.be.equal(amount(174000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(24000));
      const totals = await nft.getTotals(39);
      expect(totals._totalBalance).to.be.equal(amount(489100));
      expect(totals._minimumBalance).to.be.equal(amount(39100));
    });

    it("In month 39, nftMinter1 will destroy", async () => {
      await nft.connect(nftMinter1).destroyNft(nftId1);
      await expect(getNftInfoAtMonth(nftId1, 39)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(39);
      expect(totals._totalBalance).to.be.equal(amount(332600));
      expect(totals._minimumBalance).to.be.equal(amount(32600));
    });

    it("In Month 40, nftMinter2 will will destroy", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter2).destroyNft(nftId2);
      await expect(getNftInfoAtMonth(nftId2, 40)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(40);
      expect(totals._totalBalance).to.be.equal(amount(174000));
      expect(totals._minimumBalance).to.be.equal(amount(174000));
    });

    it("In Month 41, nftMInter3 will unstake 100", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter3).unstake(nftId3, amount(100));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 41);
      expect(nftInfoMonth.staked).to.be.equal(amount(173900));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(173900));
      const totals = await nft.getTotals(41);
      expect(totals._totalBalance).to.be.equal(amount(173900));
      expect(totals._minimumBalance).to.be.equal(amount(173900));
    });
  });

  describe("Test functions using updateMonthly with high mint amounts", () => {
    before(async () => {
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [160000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [160000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [160000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 160000, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 160000, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 160000, 0, 0, chainId));
    });

    it("Minted state is correct", async () => {
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(160000));

      const nftInfoMonth2 = await getNftInfoAtMonth(nftId2, 0);
      expect(nftInfoMonth2.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth2.minimumStaked).to.be.equal(amount(160000));

      const nftInfoMonth3 = await getNftInfoAtMonth(nftId3, 0);
      expect(nftInfoMonth3.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth3.minimumStaked).to.be.equal(amount(160000));

      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(480000));
      expect(totals._minimumBalance).to.be.equal(amount(480000));
    });

    it("In month 0, day 0, nftMinter1 unstakes 1000", async () => {
      await mineDays(22, network);
      await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(159000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(159000));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(479000));
      expect(totals._minimumBalance).to.be.equal(amount(479000));
    });

    it("In month 1, day 30, nftMinter2 stakes 500", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter2).stake(nftId2, amount(500));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(160500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(160000));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(479500));
      expect(totals._minimumBalance).to.be.equal(amount(479000));
    });

    it("In month 1, day 30, nftMinter2 unstaked 5000", async () => {
      await nft.connect(nftMinter2).unstake(nftId2, amount(5000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(155500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(155500));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(474500));
      expect(totals._minimumBalance).to.be.equal(amount(474500));
    });
    it("In month 2, day 60, nftMinter 2 destroys", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter2).destroyNft(nftId2);
      await expect(getNftInfoAtMonth(nftId2, 2)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(319000));
      expect(totals._minimumBalance).to.be.equal(amount(319000));
    });

    it("In month 3, day 90, nftMinter3 unstakes 1000", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter3).unstake(nftId3, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(159000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(159000));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(318000));
      expect(totals._minimumBalance).to.be.equal(amount(318000));
    });

    it("In month 3, day 90, nftMinter1 destroys", async () => {
      await nft.connect(nftMinter1).destroyNft(nftId1);
      await expect(getNftInfoAtMonth(nftId1, 3)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(159000));
      expect(totals._minimumBalance).to.be.equal(amount(159000));
    });
  });

  describe("Test functions using updateMonthly with edge cases", () => {
    before(async () => {
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [160000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [160000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [160000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 160000, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 160000, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 160000, 0, 0, chainId));
    });

    it("Minted state is correct", async () => {
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(160000));

      const nftInfoMonth2 = await getNftInfoAtMonth(nftId2, 0);
      expect(nftInfoMonth2.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth2.minimumStaked).to.be.equal(amount(160000));

      const nftInfoMonth3 = await getNftInfoAtMonth(nftId3, 0);
      expect(nftInfoMonth3.staked).to.be.equal(amount(160000));
      expect(nftInfoMonth3.minimumStaked).to.be.equal(amount(160000));

      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(480000));
      expect(totals._minimumBalance).to.be.equal(amount(480000));
    });

    it("In month 0, day 0, nftMinter1 stakes 1000", async () => {
      await mineDays(22, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(1000));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(161000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(160000));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(481000));
      expect(totals._minimumBalance).to.be.equal(amount(480000));
    });

    it("In month 1, day 30, nftMinter1 unstakes 0", async () => {
      await mineDays(30, network);
      await nft.connect(nftMinter1).unstake(nftId1, amount(0));
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(161000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(161000));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(481000));
      expect(totals._minimumBalance).to.be.equal(amount(481000));
    });

    it("In month 2, day 60, nftMinter2 will try to unstake more than uint128 and error", async () => {
      await mineDays(30, network);
      const amountMoreThanUint128 = ethers.BigNumber.from("2").pow(129);
      await expect(nft.connect(nftMinter2).unstake(nftId2, amountMoreThanUint128)).to.be.revertedWith(
        "UnstakeAmountNotAllowed",
      );
    });

    it("In month 2, day 60, nftMinter2 unstakes all tokens should revert", async () => {
      await expect(nft.connect(nftMinter2).unstake(nftId2, amount(161000))).to.be.revertedWith(
        "UnstakeAmountNotAllowed",
      );
    });

    it("In month 2, day 60, nftMinter1 destroys", async () => {
      await nft.connect(nftMinter1).destroyNft(nftId1);
      await expect(getNftInfoAtMonth(nftId1, 2)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(320000));
      expect(totals._minimumBalance).to.be.equal(amount(320000));
    });
    it("In month 2, day 60, nftMinter2 destroys", async () => {
      await nft.connect(nftMinter2).destroyNft(nftId2);
      await expect(getNftInfoAtMonth(nftId2, 2)).to.be.revertedWith("NftNotExists");
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(160000));
      expect(totals._minimumBalance).to.be.equal(amount(160000));
    });
  });

  const getNftInfoAtMonth = async (nftId: number, month: number): Promise<Stake> => {
    const ret = await nft.getStaked(nftId, month);
    return {
      staked: ret[0],
      minimumStaked: ret[1],
    };
  };
});
