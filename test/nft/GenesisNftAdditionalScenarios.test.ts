import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, ERC20, TokenDistribution } from "../../typings";
import { getImpersonateAccounts, mineDays } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { approveGenesisNft, mintNft, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";

config();

chai.use(solidity);

describe("GenesisNftAdditionalScenarios", () => {
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

    nftMinter1 = accounts[0];
    nftMinter2 = accounts[1];
    nftMinter3 = accounts[2];

    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
    distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
    await distribution.setWalletClaimable([nftMinter1.address], [500], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter2.address], [10000], [0], [0], [0]);
    await distribution.setWalletClaimable([nftMinter3.address], [200000], [0], [0], [0]);
    await mineDays(12, network);
    ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 10, 0, 0, chainId));
    ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 200000, 0, 0, chainId));
  });

  describe("Try some more staking/unstaking including a transfer", () => {
    it("Check state after minting nftId1", async () => {
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(0);
      expect(nftInfo._stakingAllowance).to.be.equal(amount(294));
      expect(nftInfo._shares).to.be.equal(50 + 1);
      expect(nftInfo._level).to.be.equal(0);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check state after minting nftId2", async () => {
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(10));
      expect(nftInfo._stakingAllowance).to.be.equal(amount(294));
      expect(nftInfo._shares).to.be.equal(50 + 1);
      expect(nftInfo._level).to.be.equal(0);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check state after minting nftId3", async () => {
      const nftInfo = await nft.getNftInfo(nftId3);
      expect(nftInfo._staked).to.be.equal(amount(200000));
      expect(nftInfo._stakingAllowance).to.be.equal(amount(294));
      expect(nftInfo._shares).to.be.equal(50 + 320);
      expect(nftInfo._level).to.be.equal(80);
      expect(nftInfo._tier).to.be.equal(8);
    });

    it("Check Totals", async () => {
      const totals = await nft.getTotals(0);
      expect(totals._totalShares).to.be.equal(51 + 51 + 370);
      expect(totals._totalBalance).to.be.equal(amount(200010));
      expect(totals._minimumBalance).to.be.equal(amount(200010));
    });

    it("Stake something from zero staked and zero minimum month balance", async () => {
      const amountStake = amount(100);
      await nft.connect(nftMinter1).stake(nftId1, amountStake);

      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(100));
      expect(nftInfo._stakingAllowance).to.be.equal(amount(194));
      expect(nftInfo._shares).to.be.equal(50 + 1);
      expect(nftInfo._level).to.be.equal(0);
      expect(nftInfo._tier).to.be.equal(0);
      const totals = await nft.getTotals(0);
      expect(totals._totalShares).to.be.equal(51 + 51 + 370);
      expect(totals._totalBalance).to.be.equal(amount(200110));
      expect(totals._minimumBalance).to.be.equal(amount(200010));
    });

    it("Stake 9 more times each time with one day in between.", async () => {
      const amountStake = amount(100);
      for (let i = 0; i < 9; i++) {
        await nft.connect(nftMinter1).stake(nftId1, amountStake);
        await mineDays(1, network);

        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amountStake.mul(i + 2));
        expect(nftInfo._stakingAllowance).to.be.equal(amount(194 * (i + 2)));
        if (i < 4) {
          expect(nftInfo._level).to.be.equal(0);
        } else {
          expect(nftInfo._level).to.be.equal(1);
        }
        expect(nftInfo._tier).to.be.equal(0);
        const totals = await nft.getTotals(0);
        expect(totals._totalBalance).to.be.equal(amount(200010).add(amountStake.mul(i + 2)));
        expect(totals._minimumBalance).to.be.equal(amount(200010));
      }
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amountStake.mul(10));
      expect(nftInfo._stakingAllowance).to.be.equal(amount(1940));
      expect(nftInfo._level).to.be.equal(1);
      expect(nftInfo._tier).to.be.equal(0);
      expect(nftInfo._shares).to.be.equal(50 + 2);
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(201010));
      expect(totals._minimumBalance).to.be.equal(amount(200010));
    });

    it("Stake on day 9 after start, something from 10 to 1000, starting at balance", async () => {
      const amountStake = amount(990);
      await nft.connect(nftMinter2).stake(nftId2, amountStake);
      const nftInfoBefore = await nft.getNftInfo(nftId2);
      expect(nftInfoBefore._staked).to.be.equal(amount(1000));
      expect(nftInfoBefore._stakingAllowance).to.be.equal(amount(1950));
      expect(nftInfoBefore._shares).to.be.equal(50 + 2);
      expect(nftInfoBefore._level).to.be.equal(1);
      expect(nftInfoBefore._tier).to.be.equal(0);
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(202000));
      expect(totals._minimumBalance).to.be.equal(amount(200010));
    });

    it("Stake on day 39 after start, something from 10 to 1000, starting at balance 200000", async () => {
      await mineDays(30, network);
      const amountStake = amount(1000);
      await nft.connect(nftMinter3).stake(nftId3, amountStake);
      const nftInfoBefore = await nft.getNftInfo(nftId3);
      expect(nftInfoBefore._staked).to.be.equal(amount(201000));
      expect(nftInfoBefore._stakingAllowance).to.be.equal(amount(40 * 294).sub(amount(1000)));
      expect(nftInfoBefore._shares).to.be.equal(50 + 320);
      expect(nftInfoBefore._level).to.be.equal(80);
      expect(nftInfoBefore._tier).to.be.equal(8);
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(203000));
      expect(totals._minimumBalance).to.be.equal(amount(202000));
    });

    it("30 days later, minter1 stakes total allowance", async () => {
      await mineDays(30, network);
      const nftInfoBefore = await nft.getNftInfo(nftId1);
      expect(nftInfoBefore._staked).to.be.equal(amount(1000));
      const allowance = nftInfoBefore._stakingAllowance;
      await nft.connect(nftMinter1).stake(nftId1, allowance);

      const nftInfoAfter = await nft.getNftInfo(nftId1);
      expect(nftInfoAfter._staked).to.be.equal(amount(20580));

      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(222580));
      expect(totals._minimumBalance).to.be.equal(amount(203000));
    });

    it("nftMinter2 tries unstaking from nftId1, should fail", async () => {
      await expect(nft.connect(nftMinter2).unstake(nftId1, amount(100))).to.be.revertedWith(
        "GenesisNft: You are not the owner of this NFT!",
      );
    });

    it("nftMinter1 unstaked 100 and puts 100 back", async () => {
      await nft.connect(nftMinter1).unstake(nftId1, amount(100));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(20480));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(222480));
      expect(totals._minimumBalance).to.be.equal(amount(203000));
      await nft.connect(nftMinter1).stake(nftId1, amount(100));
      const nftInfoAfter = await nft.getNftInfo(nftId1);
      expect(nftInfoAfter._staked).to.be.equal(amount(20580));

      const totals2 = await nft.getTotals(2);
      expect(totals2._totalBalance).to.be.equal(amount(222580));
      expect(totals2._minimumBalance).to.be.equal(amount(203000));
    });

    it("nftMinter1 transfers his nft to nftMinter2, nftMinter 1 cannot unstake anymore", async () => {
      await approveGenesisNft(network, nft, nftId1, nftMinter1, nftMinter2.address);
      await nft.connect(nftMinter1).transferFrom(nftMinter1.address, nftMinter2.address, nftId1);
      await expect(nft.connect(nftMinter1).unstake(nftId1, amount(100))).to.be.revertedWith(
        "GenesisNft: You are not the owner of this NFT!",
      );
    });

    it("nftMinter2 unstakes 100 from nftId1 which he received", async () => {
      await nft.connect(nftMinter2).unstake(nftId1, amount(100));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(20480));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(222480));
      expect(totals._minimumBalance).to.be.equal(amount(203000));
    });

    it("One year later, nftMinter2 can also unstake from his own nftId2 after staking enough", async () => {
      await mineDays(365, network);
      await nft.connect(nftMinter2).stake(nftId2, amount(10000));
      await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      const totals = await nft.getTotals(14);
      expect(totals._totalBalance).to.be.equal(amount(231480));
      expect(totals._minimumBalance).to.be.equal(amount(222480));
    });
  });

  describe("Stake and evolveTier every month or second month solo", () => {
    let nftMinter1: SignerWithAddress;

    let nftId1: number;

    before(async () => {
      const accounts = await ethers.getSigners();
      nftMinter1 = accounts[3];
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [155000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    });

    it("1st Stake 5000 and evolveTier", async () => {
      await mineDays(365 * 2, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(5000));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(5000));
      expect(nftInfo._shares).to.be.equal(50 + 11);
      expect(nftInfo._level).to.be.equal(9);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("2st Stake 5000 and evolveTier", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(5000));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      expect(nftInfo._shares).to.be.equal(50 + 21);
      expect(nftInfo._tier).to.be.equal(1);
      expect(nftInfo._level).to.be.equal(15);
    });

    it("3st Stake 5000 and evolveTier", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(5000));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(15000));
      expect(nftInfo._shares).to.be.equal(50 + 31);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(20);
    });

    it("4st Stake 5000 and evolveTier", async () => {
      await mineDays(30 * 1, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(5000));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(20000));
      expect(nftInfo._shares).to.be.equal(50 + 43);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(25);
    });

    it("5st Stake 10000 and evolveTier", async () => {
      await mineDays(30 * 1, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(10000));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(30000));
      expect(nftInfo._shares).to.be.equal(50 + 61);
      expect(nftInfo._tier).to.be.equal(3);
      expect(nftInfo._level).to.be.equal(32);
    });
  });

  describe("StakeAndEvolveTier every month or second month, two people, not simulatenously", () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;

    before(async () => {
      const accounts = await ethers.getSigners();
      nftMinter1 = accounts[3];
      nftMinter2 = accounts[4];
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [155000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
    });

    it("nftId1 1st, StakeAndEvolve 5000", async () => {
      await mineDays(365 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(5000));
      expect(nftInfo._shares).to.be.equal(50 + 11);
      expect(nftInfo._level).to.be.equal(9);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check total shares after 24 months", async () => {
      const totals = await nft.getTotals(24);
      expect(totals._totalShares).to.be.equal(61 + 51);
    });

    it("nftId2 1st, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter2).stake(nftId2, amount(5000));
      await nft.connect(nftMinter2).evolveTier(nftId2);
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(5000));
      expect(nftInfo._shares).to.be.equal(50 + 11);
      expect(nftInfo._level).to.be.equal(9);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check total shares after 26 months", async () => {
      const totals = await nft.getTotals(26);
      expect(totals._totalShares).to.be.equal(61 + 61);
    });

    it("nftId1 2nd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      expect(nftInfo._shares).to.be.equal(50 + 21);
      expect(nftInfo._tier).to.be.equal(1);
      expect(nftInfo._level).to.be.equal(15);
    });

    it("Check total shares after 28 months", async () => {
      const totals = await nft.getTotals(28);
      expect(totals._totalShares).to.be.equal(71 + 61);
    });

    it("nftId2 2nd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      expect(nftInfo._shares).to.be.equal(50 + 21);
      expect(nftInfo._tier).to.be.equal(1);
      expect(nftInfo._level).to.be.equal(15);
    });

    it("Check total shares after 30 months", async () => {
      const totals = await nft.getTotals(30);
      expect(totals._totalShares).to.be.equal(71 + 71);
    });

    it("nftId1 3rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(15000));
      expect(nftInfo._shares).to.be.equal(50 + 31);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(20);
    });

    it("Check total shares after 32 months", async () => {
      const totals = await nft.getTotals(32);
      expect(totals._totalShares).to.be.equal(81 + 71);
    });

    it("nftId2 3rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(15000));
      expect(nftInfo._shares).to.be.equal(50 + 31);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(20);
    });

    it("Check total shares after 34 months", async () => {
      const totals = await nft.getTotals(34);
      expect(totals._totalShares).to.be.equal(81 + 81);
    });

    it("nftId1 4rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 1, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(20000));
      expect(nftInfo._shares).to.be.equal(50 + 43);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(25);
    });

    it("Check total shares after 35 months", async () => {
      const totals = await nft.getTotals(35);
      expect(totals._totalShares).to.be.equal(93 + 81);
    });

    it("nftId2 4rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 1, network);
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(20000));
      expect(nftInfo._shares).to.be.equal(50 + 43);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(25);
    });

    it("Check total shares after 36 months", async () => {
      const totals = await nft.getTotals(36);
      expect(totals._totalShares).to.be.equal(93 + 93);
    });
  });

  describe("Stake and evolveTier every month or second month, two people, simulatenously", () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;

    before(async () => {
      const accounts = await ethers.getSigners();
      nftMinter1 = accounts[3];
      nftMinter2 = accounts[4];
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [155000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
    });

    it("nftId1 1st, StakeAndEvolve 5000", async () => {
      await mineDays(365 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(5000));
      expect(nftInfo._shares).to.be.equal(50 + 11);
      expect(nftInfo._level).to.be.equal(9);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check 1, total shares after 24 months", async () => {
      const totals = await nft.getTotals(24);
      expect(totals._totalShares).to.be.equal(61 + 51);
    });

    it("nftId2 1st, StakeAndEvolve 5000", async () => {
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(5000));
      expect(nftInfo._shares).to.be.equal(50 + 11);
      expect(nftInfo._level).to.be.equal(9);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Check 2, total shares after 24 months", async () => {
      const totals = await nft.getTotals(24);
      expect(totals._totalShares).to.be.equal(61 + 61);
    });

    it("nftId1 2nd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      expect(nftInfo._shares).to.be.equal(50 + 21);
      expect(nftInfo._tier).to.be.equal(1);
      expect(nftInfo._level).to.be.equal(15);
    });

    it("Check 1, total shares after 26 months", async () => {
      const totals = await nft.getTotals(26);
      expect(totals._totalShares).to.be.equal(71 + 61);
    });

    it("nftId2 2nd, StakeAndEvolve 5000", async () => {
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(10000));
      expect(nftInfo._shares).to.be.equal(50 + 21);
      expect(nftInfo._tier).to.be.equal(1);
      expect(nftInfo._level).to.be.equal(15);
    });

    it("Check 2, total shares after 26 months", async () => {
      const totals = await nft.getTotals(26);
      expect(totals._totalShares).to.be.equal(71 + 71);
    });

    it("nftId1 3rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 2, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(15000));
      expect(nftInfo._shares).to.be.equal(50 + 31);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(20);
    });

    it("Check 1, total shares after 28 months", async () => {
      const totals = await nft.getTotals(28);
      expect(totals._totalShares).to.be.equal(81 + 71);
    });

    it("nftId2 3rd, StakeAndEvolve 5000", async () => {
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(15000));
      expect(nftInfo._shares).to.be.equal(50 + 31);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(20);
    });

    it("Check 2, total shares after 28 months", async () => {
      const totals = await nft.getTotals(28);
      expect(totals._totalShares).to.be.equal(81 + 81);
    });

    it("nftId1 4rd, StakeAndEvolve 5000", async () => {
      await mineDays(30 * 1, network);
      await nft.connect(nftMinter1).stakeAndEvolve(nftId1, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(20000));
      expect(nftInfo._shares).to.be.equal(50 + 43);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(25);
    });

    it("Check 1, total shares after 29 months", async () => {
      const totals = await nft.getTotals(29);
      expect(totals._totalShares).to.be.equal(93 + 81);
    });

    it("nftId2 4rd, StakeAndEvolve 5000", async () => {
      await nft.connect(nftMinter2).stakeAndEvolve(nftId2, amount(5000));
      const nftInfo = await nft.getNftInfo(nftId2);
      expect(nftInfo._staked).to.be.equal(amount(20000));
      expect(nftInfo._shares).to.be.equal(50 + 43);
      expect(nftInfo._tier).to.be.equal(2);
      expect(nftInfo._level).to.be.equal(25);
    });

    it("Check 1, total shares after 29 months", async () => {
      const totals = await nft.getTotals(29);
      expect(totals._totalShares).to.be.equal(93 + 93);
    });
  });

  describe("GenesisNftUnstaking", () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;
    let nftMinter3: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;
    let nftId3: number;

    before(async () => {
      accounts = await ethers.getSigners();

      nftMinter1 = accounts[0];
      nftMinter2 = accounts[1];
      nftMinter3 = accounts[2];

      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await distribution.setWalletClaimable([nftMinter1.address], [5000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [20000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [70000], [0], [0], [0]);
      await mineDays(12, network);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 5000, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 20000, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 60000, 0, 0, chainId));
      await mineDays(365, network);
      const amountStake = amount(10000);
      await nft.connect(nftMinter1).stake(nftId1, amountStake);
      await nft.connect(nftMinter2).stake(nftId2, amountStake);
      await nft.connect(nftMinter3).stake(nftId3, amountStake);
    });

    describe("Unstake every month or second month solo", () => {
      it("Check state after minting nftId1", async () => {
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(15000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check state after minting nftId2", async () => {
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(30000));
        expect(nftInfo._shares).to.be.equal(50 + 55);
        expect(nftInfo._level).to.be.equal(30);
        expect(nftInfo._tier).to.be.equal(2);
      });

      it("Check state after minting nftId3", async () => {
        const nftInfo = await nft.getNftInfo(nftId3);
        expect(nftInfo._staked).to.be.equal(amount(70000));
        expect(nftInfo._shares).to.be.equal(50 + 129);
        expect(nftInfo._level).to.be.equal(50);
        expect(nftInfo._tier).to.be.equal(4);
      });

      it("Check Totals at month 12", async () => {
        const totals = await nft.getTotals(12);
        expect(totals._totalShares).to.be.equal(3 * 50 + 13 + 55 + 129);
        expect(totals._totalBalance).to.be.equal(amount(115000));
        expect(totals._minimumBalance).to.be.equal(amount(85000));
      });

      it("1st Unstake 1000", async () => {
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(14000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 12", async () => {
        const totals = await nft.getTotals(12);
        expect(totals._totalShares).to.be.equal(3 * 50 + 13 + 55 + 129);
        expect(totals._totalBalance).to.be.equal(amount(114000));
        expect(totals._minimumBalance).to.be.equal(amount(85000));
      });

      it("2st Unstake 5000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(13000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 14", async () => {
        const totals = await nft.getTotals(14);
        expect(totals._totalShares).to.be.equal(3 * 50 + 13 + 55 + 129);
        expect(totals._totalBalance).to.be.equal(amount(113000));
        expect(totals._minimumBalance).to.be.equal(amount(113000));
      });

      it("3st Unstake 5000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(12000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 16", async () => {
        const totals = await nft.getTotals(16);
        expect(totals._totalShares).to.be.equal(3 * 50 + 13 + 55 + 129);
        expect(totals._totalBalance).to.be.equal(amount(112000));
        expect(totals._minimumBalance).to.be.equal(amount(112000));
      });

      it("4st Unstake 5000", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(11000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 17", async () => {
        const totals = await nft.getTotals(17);
        expect(totals._totalShares).to.be.equal(3 * 50 + 13 + 55 + 129);
        expect(totals._totalBalance).to.be.equal(amount(111000));
        expect(totals._minimumBalance).to.be.equal(amount(111000));
      });
      it("5st Unstake 10000", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(10000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });
    });

    describe("Unstake every month or second month, two people, not simulatenously", () => {
      let nftMinter1: SignerWithAddress;
      let nftMinter2: SignerWithAddress;

      let nftId1: number;
      let nftId2: number;

      before(async () => {
        const accounts = await ethers.getSigners();
        nftMinter1 = accounts[3];
        nftMinter2 = accounts[4];
        workToken = await regenerateWorkToken(accounts, accounts[0].address);
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 11;
        distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
        nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
        await distribution.setWalletClaimable([nftMinter1.address], [5000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [20000], [0], [0], [0]);
        await mineDays(12, network);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 5000, 0, 0, chainId));
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 20000, 0, 0, chainId));
        await mineDays(365 * 2, network);
        const amountStake = amount(20000);
        await nft.connect(nftMinter1).stake(nftId1, amountStake);
        await nft.connect(nftMinter2).stake(nftId2, amountStake);
      });

      it("Check state after minting, nftId1", async () => {
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(25000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check state after minting, nftId2", async () => {
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(40000));
        expect(nftInfo._shares).to.be.equal(50 + 55);
        expect(nftInfo._level).to.be.equal(30);
        expect(nftInfo._tier).to.be.equal(2);
      });

      it("Check Totals at month 24", async () => {
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(65000));
        expect(totals._minimumBalance).to.be.equal(amount(25000));
      });

      it("nftId1 1st, unstake 1000", async () => {
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(24000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 24 again", async () => {
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(64000));
        expect(totals._minimumBalance).to.be.equal(amount(25000));
      });

      it("nftId2 1st, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(39000));
        expect(nftInfo._shares).to.be.equal(50 + 55);
        expect(nftInfo._level).to.be.equal(30);
        expect(nftInfo._tier).to.be.equal(2);
      });

      it("Check Totals at month 26 again", async () => {
        const totals = await nft.getTotals(26);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(63000));
        expect(totals._minimumBalance).to.be.equal(amount(63000));
      });

      it("nftId1 2nd, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(23000));
      });

      it("Check Totals at month 28 again", async () => {
        const totals = await nft.getTotals(28);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(62000));
        expect(totals._minimumBalance).to.be.equal(amount(62000));
      });

      it("nftId2 2nd, Unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(38000));
      });

      it("Check Totals at month 30 again", async () => {
        const totals = await nft.getTotals(30);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(61000));
        expect(totals._minimumBalance).to.be.equal(amount(61000));
      });

      it("nftId1 3rd, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(22000));
      });

      it("Check Totals at month 32 again", async () => {
        const totals = await nft.getTotals(32);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(60000));
        expect(totals._minimumBalance).to.be.equal(amount(60000));
      });

      it("nftId2 3rd, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(37000));
      });

      it("Check Totals at month 34 again", async () => {
        const totals = await nft.getTotals(34);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(59000));
        expect(totals._minimumBalance).to.be.equal(amount(59000));
      });

      it("nftId1 4rd, unstake 1000", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(21000));
      });

      it("Check Totals at month 35 again", async () => {
        const totals = await nft.getTotals(35);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(58000));
        expect(totals._minimumBalance).to.be.equal(amount(58000));
      });

      it("nftId2 4rd, unstake 1000", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(36000));
      });

      it("Check Totals at month 36 again", async () => {
        const totals = await nft.getTotals(36);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(57000));
        expect(totals._minimumBalance).to.be.equal(amount(57000));
      });
    });

    describe("Unstake every month or second month, two people, simulatenously", () => {
      let nftMinter1: SignerWithAddress;
      let nftMinter2: SignerWithAddress;

      let nftId1: number;
      let nftId2: number;

      before(async () => {
        const accounts = await ethers.getSigners();
        nftMinter1 = accounts[3];
        nftMinter2 = accounts[4];
        workToken = await regenerateWorkToken(accounts, accounts[0].address);
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 11;
        distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
        nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
        await distribution.setWalletClaimable([nftMinter1.address], [5000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [20000], [0], [0], [0]);
        await mineDays(12, network);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 5000, 0, 0, chainId));
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 20000, 0, 0, chainId));
        await mineDays(365 * 2, network);
        const amountStake = amount(20000);
        await nft.connect(nftMinter1).stake(nftId1, amountStake);
        await nft.connect(nftMinter2).stake(nftId2, amountStake);
      });

      it("nftId1 1st, unstake 1000", async () => {
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(24000));
        expect(nftInfo._shares).to.be.equal(50 + 13);
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
      });

      it("Check Totals at month 24", async () => {
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(64000));
        expect(totals._minimumBalance).to.be.equal(amount(25000));
      });

      it("nftId2 1st, unstake 1000", async () => {
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(39000));
        expect(nftInfo._shares).to.be.equal(50 + 55);
        expect(nftInfo._level).to.be.equal(30);
        expect(nftInfo._tier).to.be.equal(2);
      });

      it("Check Totals at month 24 again", async () => {
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(63000));
        expect(totals._minimumBalance).to.be.equal(amount(25000));
      });

      it("nftId1 2nd, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(23000));
      });

      it("Check Totals at month 26", async () => {
        const totals = await nft.getTotals(26);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(62000));
        expect(totals._minimumBalance).to.be.equal(amount(62000));
      });

      it("nftId2 2nd, Unstake 1000", async () => {
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(38000));
      });

      it("Check Totals at month 26 again", async () => {
        const totals = await nft.getTotals(26);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(61000));
        expect(totals._minimumBalance).to.be.equal(amount(61000));
      });

      it("nftId1 3rd, unstake 1000", async () => {
        await mineDays(30 * 2, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(22000));
      });

      it("Check Totals at month 28", async () => {
        const totals = await nft.getTotals(28);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(60000));
        expect(totals._minimumBalance).to.be.equal(amount(60000));
      });

      it("nftId2 3rd, unstake 1000", async () => {
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(37000));
      });

      it("Check Totals at month 28 again", async () => {
        const totals = await nft.getTotals(28);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(59000));
        expect(totals._minimumBalance).to.be.equal(amount(59000));
      });

      it("nftId1 4rd, unstake 1000", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(21000));
      });

      it("Check Totals at month 29", async () => {
        const totals = await nft.getTotals(29);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(58000));
        expect(totals._minimumBalance).to.be.equal(amount(58000));
      });

      it("nftId2 4rd, unstake 1000", async () => {
        await nft.connect(nftMinter2).unstake(nftId2, amount(1000));
        const nftInfo = await nft.getNftInfo(nftId2);
        expect(nftInfo._staked).to.be.equal(amount(36000));
      });

      it("Check Totals at month 29", async () => {
        const totals = await nft.getTotals(29);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
        expect(totals._totalBalance).to.be.equal(amount(57000));
        expect(totals._minimumBalance).to.be.equal(amount(57000));
      });
    });

    describe("Unstake in combination with stake and evolve", () => {
      let nftMinter1: SignerWithAddress;
      let nftMinter2: SignerWithAddress;

      let nftId1: number;
      let nftId2: number;

      before(async () => {
        const accounts = await ethers.getSigners();
        nftMinter1 = accounts[3];
        nftMinter2 = accounts[4];
        workToken = await regenerateWorkToken(accounts, accounts[0].address);
        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 11;
        distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
        nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
        await distribution.setWalletClaimable([nftMinter1.address], [5000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [20000], [0], [0], [0]);
        await mineDays(12, network);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 5000, 0, 0, chainId));
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 20000, 0, 0, chainId));
        await mineDays(365 * 2, network);
        const amountStake = amount(20000);
        await nft.connect(nftMinter1).stake(nftId1, amountStake);
        await nft.connect(nftMinter2).stake(nftId2, amountStake);
      });

      it("In the same month first stake/unstake a few times, start with stake", async () => {
        const nftInfoBefore = await nft.getNftInfo(nftId1);
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        const nftInfoAfter = await nft.getNftInfo(nftId1);
        expect(nftInfoBefore).to.be.eql(nftInfoAfter);
        expect(nftInfoAfter._staked).to.be.equal(amount(25000));
        expect(nftInfoAfter._level).to.be.equal(10);
        expect(nftInfoAfter._tier).to.be.equal(0);
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
      });

      it("In the same month first stake/unstake a few times, start with unstake", async () => {
        const nftInfoBefore = await nft.getNftInfo(nftId1);
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(5000));
        await nft.connect(nftMinter1).stake(nftId1, amount(5000));
        const nftInfoAfter = await nft.getNftInfo(nftId1);
        expect(nftInfoBefore).to.be.eql(nftInfoAfter);
        expect(nftInfoAfter._staked).to.be.equal(amount(25000));
        expect(nftInfoAfter._level).to.be.equal(10);
        expect(nftInfoAfter._tier).to.be.equal(0);
        const totals = await nft.getTotals(24);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
      });

      it("In the next month first stake 5 times and then unstake 5 times", async () => {
        await mineDays(30 * 1, network);
        const nftInfoBefore = await nft.getNftInfo(nftId1);
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfoAfter = await nft.getNftInfo(nftId1);
        expect(nftInfoBefore).to.be.eql(nftInfoAfter);
        expect(nftInfoAfter._staked).to.be.equal(amount(25000));
        expect(nftInfoAfter._level).to.be.equal(10);
        expect(nftInfoAfter._tier).to.be.equal(0);
        const totals = await nft.getTotals(25);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
      });

      it("In the next month first unstake 5 times and then stake 5 times", async () => {
        await mineDays(30 * 1, network);
        const nftInfoBefore = await nft.getNftInfo(nftId1);
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        await nft.connect(nftMinter1).stake(nftId1, amount(1000));
        const nftInfoAfter = await nft.getNftInfo(nftId1);
        expect(nftInfoBefore).to.be.eql(nftInfoAfter);
        expect(nftInfoAfter._staked).to.be.equal(amount(25000));
        expect(nftInfoAfter._level).to.be.equal(10);
        expect(nftInfoAfter._tier).to.be.equal(0);
        const totals = await nft.getTotals(26);
        expect(totals._totalShares).to.be.equal(2 * 50 + 13 + 55);
      });

      it("In a month evolve, stake and unstake.", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).evolveTier(nftId1);
        await nft.connect(nftMinter1).stake(nftId1, amount(6000));
        await nft.connect(nftMinter1).unstake(nftId1, amount(1000));
        const nftInfoAfter = await nft.getNftInfo(nftId1);
        expect(nftInfoAfter._staked).to.be.equal(amount(30000));
        expect(nftInfoAfter._level).to.be.equal(30);
        expect(nftInfoAfter._tier).to.be.equal(2);
        const totals = await nft.getTotals(27);
        expect(totals._totalShares).to.be.equal(2 * 50 + 55 + 55);
      });
    });

    describe("Unstake in combination with in combination with stake and destroy", () => {
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

      before(async () => {
        const accounts = await ethers.getSigners();
        nftMinter1 = accounts[3];
        nftMinter2 = accounts[4];
        nftMinter3 = accounts[5];
        nftMinter4 = accounts[6];
        nftMinter5 = accounts[7];
        workToken = await regenerateWorkToken(accounts, accounts[0].address);

        const startTime = (await ethers.provider.getBlock("latest")).timestamp + 14;
        distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
        nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
        await distribution.setWalletClaimable([nftMinter1.address], [0], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter2.address], [60000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter3.address], [80000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter4.address], [110000], [0], [0], [0]);
        await distribution.setWalletClaimable([nftMinter5.address], [150000], [0], [0], [0]);
        await mineDays(12, network);
        ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
        ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 60000, 0, 0, chainId));
        ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 80000, 0, 0, chainId));
        ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter4, 110000, 0, 0, chainId));
        ({ nftId: nftId5 } = await mintNft(network, nft, workToken, nftMinter5, 150000, 0, 0, chainId));
        await mineDays(365 * 2, network);
        const amountStake = amount(20000);
        await nft.connect(nftMinter1).stake(nftId1, amountStake);
        await nft.connect(nftMinter2).stake(nftId2, amountStake);
        await nft.connect(nftMinter3).stake(nftId3, amountStake);
        await nft.connect(nftMinter4).stake(nftId4, amountStake);
        await nft.connect(nftMinter5).stake(nftId5, amountStake);
      });

      // stake a lot total goes up, then destroy total goes down, but dont decrease min.
      it("In the same month first stake in nftId1, and destroy nftId5, and then unstake from nftId1", async () => {
        // stake
        await nft.connect(nftMinter1).stake(nftId1, amount(20000));
        const nftInfo1 = await nft.getNftInfo(nftId1);
        expect(nftInfo1._staked).to.be.equal(amount(40000));
        expect(nftInfo1._level).to.be.equal(10);
        expect(nftInfo1._tier).to.be.equal(0);
        const expectedTotal1 = 40000 + 80000 + 100000 + 130000 + 170000;
        const expectedMin1 = 0 + 60000 + 80000 + 110000 + 150000;
        const totals1 = await nft.getTotals(24);
        expect(totals1._totalShares).to.be.equal(5 * 50 + 13 + 129 + 180 + 242 + 320);
        expect(totals1._totalBalance).to.be.equal(amount(expectedTotal1));
        expect(totals1._minimumBalance).to.be.equal(amount(expectedMin1));

        // destroy nft 5
        await nft.connect(nftMinter5).destroyNft(nftId5);
        const nftInfo2 = await nft.getNftInfo(nftId1);
        expect(nftInfo2._staked).to.be.equal(amount(40000));
        expect(nftInfo2._level).to.be.equal(10);
        expect(nftInfo2._tier).to.be.equal(0);
        const expectedTotal2 = 40000 + 80000 + 100000 + 130000;
        const expectedMin2 = 0 + 60000 + 80000 + 110000;
        const totals2 = await nft.getTotals(24);
        expect(totals2._totalShares).to.be.equal(4 * 50 + 13 + 129 + 180 + 242);
        expect(totals2._totalBalance).to.be.equal(amount(expectedTotal2));
        expect(totals2._minimumBalance).to.be.equal(amount(expectedMin2));
        // unstake
        await nft.connect(nftMinter1).unstake(nftId1, amount(10000));
        const nftInfo3 = await nft.getNftInfo(nftId1);
        expect(nftInfo3._staked).to.be.equal(amount(30000));
        expect(nftInfo3._level).to.be.equal(10);
        expect(nftInfo3._tier).to.be.equal(0);
        const expectedTotal3 = 30000 + 80000 + 100000 + 130000;
        const expectedMin3 = 0 + 60000 + 80000 + 110000;
        const totals3 = await nft.getTotals(24);
        expect(totals3._totalShares).to.be.equal(4 * 50 + 13 + 129 + 180 + 242);
        expect(totals3._totalBalance).to.be.equal(amount(expectedTotal3));
        expect(totals3._minimumBalance).to.be.equal(amount(expectedMin3));
      });

      it("One month later, unstake a bit more and see total and min go down", async () => {
        await mineDays(30 * 1, network);
        await nft.connect(nftMinter1).unstake(nftId1, amount(10000));
        const nftInfo = await nft.getNftInfo(nftId1);
        expect(nftInfo._staked).to.be.equal(amount(20000));
        expect(nftInfo._level).to.be.equal(10);
        expect(nftInfo._tier).to.be.equal(0);
        const expectedTotal = 20000 + 80000 + 100000 + 130000;
        const expectedMin = 20000 + 80000 + 100000 + 130000;
        const totals = await nft.getTotals(25);
        expect(totals._totalShares).to.be.equal(4 * 50 + 13 + 129 + 180 + 242);
        expect(totals._totalBalance).to.be.equal(amount(expectedTotal));
        expect(totals._minimumBalance).to.be.equal(amount(expectedMin));
      });

      it("One month later, destroy nftId4, total and min goes down,then stake in nftId 1total goes up, and unstake a little then total goes down min stays the same", async () => {
        await mineDays(30 * 1, network);
        // destroy nft4
        await nft.connect(nftMinter4).destroyNft(nftId4);
        const nftInfo1 = await nft.getNftInfo(nftId4);
        expect(nftInfo1._staked).to.be.equal(amount(0));
        expect(nftInfo1._level).to.be.equal(0);
        // expect(nftInfo1._tier).to.be.equal(0);
        // console.log("4");
        const staked1 = await nft.getStaked(nftId4, 26);
        expect(staked1[0]).to.be.equal(0);
        expect(staked1[1]).to.be.equal(0);

        const expectedTotal1 = 20000 + 80000 + 100000;
        const expectedMin1 = 20000 + 80000 + 100000;
        const totals1 = await nft.getTotals(26);
        expect(totals1._totalShares).to.be.equal(3 * 50 + 13 + 129 + 180);
        expect(totals1._totalBalance).to.be.equal(amount(expectedTotal1));
        expect(totals1._minimumBalance).to.be.equal(amount(expectedMin1));

        // stake nft 1
        await nft.connect(nftMinter1).stake(nftId1, amount(20000));
        const nftInfo2 = await nft.getNftInfo(nftId1);
        expect(nftInfo2._staked).to.be.equal(amount(40000));
        expect(nftInfo2._level).to.be.equal(10);
        expect(nftInfo2._tier).to.be.equal(0);
        const expectedTotal2 = 40000 + 80000 + 100000;
        const expectedMin2 = 20000 + 80000 + 100000;
        const totals2 = await nft.getTotals(26);
        expect(totals2._totalShares).to.be.equal(3 * 50 + 13 + 129 + 180);
        expect(totals2._totalBalance).to.be.equal(amount(expectedTotal2));
        expect(totals2._minimumBalance).to.be.equal(amount(expectedMin2));

        // unstake nft1
        await nft.connect(nftMinter1).unstake(nftId1, amount(10000));
        const nftInfo3 = await nft.getNftInfo(nftId1);
        expect(nftInfo3._staked).to.be.equal(amount(30000));
        expect(nftInfo3._level).to.be.equal(10);
        expect(nftInfo3._tier).to.be.equal(0);
        const expectedTotal3 = 30000 + 80000 + 100000;
        const expectedMin3 = 20000 + 80000 + 100000;
        const totals3 = await nft.getTotals(26);
        expect(totals3._totalShares).to.be.equal(3 * 50 + 13 + 129 + 180);
        expect(totals3._totalBalance).to.be.equal(amount(expectedTotal3));
        expect(totals3._minimumBalance).to.be.equal(amount(expectedMin3));
      });

      it("One month later, destroy nftId3, total and min goes down,then stake in nftId 1total goes up, and unstake a more then total goes down and min goes down", async () => {
        await mineDays(30 * 1, network);
        // destroy nft4
        await nft.connect(nftMinter3).destroyNft(nftId3);
        const nftInfo1 = await nft.getNftInfo(nftId4);
        expect(nftInfo1._staked).to.be.equal(amount(0));
        expect(nftInfo1._level).to.be.equal(0);
        const staked1 = await nft.getStaked(nftId4, 26);
        expect(staked1[0]).to.be.equal(0);
        expect(staked1[1]).to.be.equal(0);

        const expectedTotal1 = 30000 + 80000;
        const expectedMin1 = 30000 + 80000;
        const totals1 = await nft.getTotals(27);
        expect(totals1._totalShares).to.be.equal(2 * 50 + 13 + 129);
        expect(totals1._totalBalance).to.be.equal(amount(expectedTotal1));
        expect(totals1._minimumBalance).to.be.equal(amount(expectedMin1));

        // stake nft 1
        await nft.connect(nftMinter1).stake(nftId1, amount(20000));
        const nftInfo2 = await nft.getNftInfo(nftId1);
        expect(nftInfo2._staked).to.be.equal(amount(50000));
        expect(nftInfo2._level).to.be.equal(10);
        expect(nftInfo2._tier).to.be.equal(0);
        const expectedTotal2 = 50000 + 80000;
        const expectedMin2 = 30000 + 80000;
        const totals2 = await nft.getTotals(27);
        expect(totals2._totalShares).to.be.equal(2 * 50 + 13 + 129);
        expect(totals2._totalBalance).to.be.equal(amount(expectedTotal2));
        expect(totals2._minimumBalance).to.be.equal(amount(expectedMin2));

        // unstake nft1
        await nft.connect(nftMinter1).unstake(nftId1, amount(25000));
        const nftInfo3 = await nft.getNftInfo(nftId1);
        expect(nftInfo3._staked).to.be.equal(amount(25000));
        expect(nftInfo3._level).to.be.equal(10);
        expect(nftInfo3._tier).to.be.equal(0);
        const expectedTotal3 = 25000 + 80000;
        const expectedMin3 = 25000 + 80000;
        const totals3 = await nft.getTotals(27);
        expect(totals3._totalShares).to.be.equal(2 * 50 + 13 + 129);
        expect(totals3._totalBalance).to.be.equal(amount(expectedTotal3));
        expect(totals3._minimumBalance).to.be.equal(amount(expectedMin3));
      });
    });
  });
});
