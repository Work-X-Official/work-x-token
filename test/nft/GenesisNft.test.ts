import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import {
  WorkToken,
  GenesisNft,
  ERC20,
  TokenDistribution,
  GenesisNftAttributes,
  GenesisNftData,
  GenesisNft__factory,
} from "../../typings";
import { big, expectToRevert, getImpersonateAccounts, mineDays, monthsToSeconds } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { DAILY_STAKING_ALLOWANCE } from "../constants";
import {
  Voucher,
  approveGenesisNft,
  nftLockTimeByStake,
  mintNft,
  nftMintVoucherGenerateLocal,
  regenerateNft,
  getShares,
  getVoucherSigner,
} from "../util/nft.util";
import {
  MIN_TOKEN_STAKING,
  VESTING_LENGHT_BUY_MORE_MONTHS,
  VESTING_LENGHT_PRESALE_MONTHS,
  VESTING_LENGHT_PRIVATE_MONTHS,
  VESTING_LENGHT_SEED_MONTHS,
} from "../../tasks/constants/sale.constants";
import { approveToken, approveWorkToken, balanceOf, regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import {
  Investment,
  calculateAmountBoughtTotal,
  calculateBuyMoreTokenBalance,
  seed1kInv,
  seed251Inv,
  zeroInv,
} from "../util/sale.util";
import { maxLockLength, regenerateTokenDistribution } from "../util/distribution.util";
import { workBought } from "../../tasks/util/utils";

config();

chai.use(solidity);

describe.only("GenesisNft", () => {
  let nft: GenesisNft;
  let signerImpersonated: SignerWithAddress;
  let stablecoin: ERC20;
  let stablecoinDecimals: number;
  let accounts: SignerWithAddress[];
  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
  let nftMinter3: SignerWithAddress;
  let nftVoucherSigner: Wallet;
  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let nftId1: number;
  let voucherId1: number;
  let chainId: number;

  before(async () => {
    const acc = await getImpersonateAccounts(network);
    chainId = (await ethers.provider.getNetwork()).chainId;
    signerImpersonated = await ethers.getSigner(acc.signerImpersonatedAddress);
    stablecoin = await ethers.getContractAt("ERC20", acc.stablecoinAddress);
    stablecoinDecimals = await stablecoin.decimals();
    accounts = await ethers.getSigners();

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];
    nftMinter3 = accounts[5];
    nftVoucherSigner = getVoucherSigner();

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
    distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
  });

  describe("Deployment", async () => {
    //3
    it("Should be deployed to a properaddress", async () => {
      expect(nft.address).to.properAddress;
    });

    it("Should return correct name", async () => {
      expect(await nft.name()).to.equal("Work X Genesis NFT");
    });

    it("Should return the correct symbol", async () => {
      expect(await nft.symbol()).to.equal("Work X Genesis NFT");
    });
  });

  describe("Deployment Address errors", () => {
    let nftAttributes: GenesisNftAttributes;
    let nftData: GenesisNftData;
    let nftFactory: GenesisNft__factory;

    before(async () => {
      nftAttributes = await (await ethers.getContractFactory("GenesisNftAttributes", signerImpersonated)).deploy();
      nftData = await (
        await ethers.getContractFactory("GenesisNftData", signerImpersonated)
      ).deploy(nftAttributes.address);
      nftFactory = await ethers.getContractFactory("GenesisNft", signerImpersonated);
    });

    it("Should revert with Invalid Address error when the workToken address is 0x0", async () => {
      await expect(
        nftFactory.deploy(
          "Work X Genesis NFT",
          "Work X Genesis NFT",
          ethers.constants.AddressZero,
          distribution.address,
          nftData.address,
          signerImpersonated.address,
        ),
      ).to.be.revertedWith("AddressInvalid");
    });

    it("Should revert with Invalid Address error when the distribution address is 0x0", async () => {
      await expect(
        nftFactory.deploy(
          "Work X Genesis NFT",
          "Work X Genesis NFT",
          workToken.address,
          ethers.constants.AddressZero,
          nftData.address,
          signerImpersonated.address,
        ),
      ).to.be.revertedWith("AddressInvalid");
    });

    it("Should revert with Invalid Address error when the nftData address is 0x0", async () => {
      await expect(
        nftFactory.deploy(
          "Work X Genesis NFT",
          "Work X Genesis NFT",
          workToken.address,
          distribution.address,
          ethers.constants.AddressZero,
          signerImpersonated.address,
        ),
      ).to.be.revertedWith("AddressInvalid");
    });

    it("Should revert with Invalid Address error when the nftVoucherSigner address is 0x0", async () => {
      await expect(
        nftFactory.deploy(
          "Work X Genesis NFT",
          "Work X Genesis NFT",
          workToken.address,
          distribution.address,
          nftData.address,
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith("AddressInvalid");
    });
  });

  describe("Testing setStarttime", async () => {
    let startTimeNew = 0;

    it("Should revert when starttime is in the past", async () => {
      await expect(nft.setStartTime(0)).to.be.revertedWith("StartTimeInvalid");
    });

    it("Should be able to change the starttime to days from now", async () => {
      startTimeNew = (await ethers.provider.getBlock("latest")).timestamp + 10 * 86400;
      await nft.setStartTime(startTimeNew);
      expect(await nft.startTime()).to.equal(startTimeNew);
    });

    it("Mine 10 days, should not be able to change after start", async () => {
      await mineDays(10, network);
      await expect(nft.setStartTime(startTimeNew)).to.be.revertedWith("StartTimeInvalid");
    });
  });

  describe("Testing locktime calculations", async () => {
    describe("Testing calculateMaxLockLength", () => {
      it("Should return 0 when averageMonths is 0", () => {
        expect(maxLockLength(0)).to.equal(0);
      });

      it("Should return two-thirds of averageMonths when input is 1", () => {
        expect(maxLockLength(1)).to.be.closeTo(0.6667, 0.0001);
      });

      it("Should return two-thirds of averageMonths when input is 9", () => {
        expect(maxLockLength(9)).to.equal(6);
      });

      it("Should return two-thirds of averageMonths when input is 18", () => {
        expect(maxLockLength(18)).to.equal(12);
      });
    });

    describe("Testing calculateLockTimeByStake", () => {
      it("Should return 0 when all investments are 0", () => {
        const investment: Investment = {
          ...zeroInv,
        };
        expect(nftLockTimeByStake(1000, investment)).to.equal(0);
      });

      it("Should return full vesting lengths when you try to stake the minimum amount, and totalEligible is enough", () => {
        const lockTimeSeed = nftLockTimeByStake(MIN_TOKEN_STAKING, { ...zeroInv, seed: 5000, seedPool: 5000 });
        expect(lockTimeSeed).to.equal(VESTING_LENGHT_SEED_MONTHS);
        const lockTimePrivate = nftLockTimeByStake(MIN_TOKEN_STAKING, { ...zeroInv, priv: 5000, privPool: 5000 });
        expect(lockTimePrivate).to.equal(VESTING_LENGHT_PRIVATE_MONTHS);
        const lockTimePresale = nftLockTimeByStake(MIN_TOKEN_STAKING, { ...zeroInv, pre: 5000, prePool: 5000 });
        expect(lockTimePresale).to.equal(VESTING_LENGHT_PRESALE_MONTHS);
      });

      it("Should return 2/3 of full vesting length when you stake all your total amount of tokens bought", () => {
        const amountBoughtSeed = workBought(0, 5000, 5000, false);
        const seedInvestment: Investment = { ...zeroInv, seed: 5000, seedPool: 5000 };
        const lockTimeSeed = nftLockTimeByStake(amountBoughtSeed, seedInvestment);
        expect(lockTimeSeed).to.equal(VESTING_LENGHT_SEED_MONTHS * (2 / 3));

        const amountBoughtPrivate = workBought(1, 5000, 5000, false);
        const privatePoolInvestment: Investment = { ...zeroInv, priv: 5000, privPool: 5000 };
        const lockTimePrivate = nftLockTimeByStake(amountBoughtPrivate, privatePoolInvestment);
        expect(lockTimePrivate).to.equal(VESTING_LENGHT_PRIVATE_MONTHS * (2 / 3));

        const amountBoughtPresale = workBought(2, 5000, 5000, false);
        const presalePublicInvestment: Investment = { ...zeroInv, pre: 5000, prePool: 5000 };
        const lockTimePresale = nftLockTimeByStake(amountBoughtPresale, presalePublicInvestment);
        expect(lockTimePresale).to.equal(VESTING_LENGHT_PRESALE_MONTHS * (2 / 3));
      });

      it("Should return 2/3 of full vesting when you stake all your tokens but it is less then the minimum requirement", () => {
        const smallInvestment: Investment = { ...zeroInv, seed: 50, seedPool: 50 };
        const amountTokensBought = calculateAmountBoughtTotal(smallInvestment);
        expect(amountTokensBought).to.be.below(MIN_TOKEN_STAKING);

        const lockTimeSeed = nftLockTimeByStake(amountTokensBought, smallInvestment);
        expect(lockTimeSeed).to.equal(VESTING_LENGHT_SEED_MONTHS * (2 / 3));
      });

      it("Should return full vesting when the minimum requirement plus all buyMore tokens are staked", () => {
        const buyMoreTokens = calculateBuyMoreTokenBalance(1000);
        const investment: Investment = { ...zeroInv, priv: 10000, privPool: 10000, buyMore: 1000 };
        const lockTimeSeed = nftLockTimeByStake(buyMoreTokens + MIN_TOKEN_STAKING, investment);
        expect(lockTimeSeed).to.equal(VESTING_LENGHT_PRIVATE_MONTHS);
      });

      it("Should return exactly between 2/3 and full vesting when you stake the minimum requirement plus half of the tokens you have left, when you bought seed", () => {
        const amountBoughtSeed = workBought(0, 5000, 5000, false);
        const amountAboveMinimum = amountBoughtSeed - MIN_TOKEN_STAKING;
        const investment: Investment = { ...zeroInv, seed: 5000, seedPool: 5000 };
        const lockTimeSeed = nftLockTimeByStake(MIN_TOKEN_STAKING + amountAboveMinimum / 2, investment);
        const expectedLockTime = (VESTING_LENGHT_SEED_MONTHS * (2 / 3) + VESTING_LENGHT_SEED_MONTHS) / 2;
        expect(lockTimeSeed).to.equal(expectedLockTime);
      });

      it("Should return exactly between 2/3 and full vesting when you stake the minimum plus half of the tokens you have left, when you bought private and buyMore", () => {
        const boughtPrivate = workBought(1, 5000, 5000, false);
        const boughtBuyMore = calculateBuyMoreTokenBalance(1000);
        const minimum = MIN_TOKEN_STAKING + boughtBuyMore;
        const aboveMinimum = boughtPrivate - minimum;
        const investment: Investment = { ...zeroInv, priv: 5000, privPool: 5000, buyMore: 1000 };
        const lockTimeSeed = nftLockTimeByStake(minimum + aboveMinimum / 2, investment);
        const expectedLockTime = ((VESTING_LENGHT_PRIVATE_MONTHS * 2) / 3 + VESTING_LENGHT_PRIVATE_MONTHS) / 2;
        expect(lockTimeSeed).to.equal(expectedLockTime);
      });
    });

    it("Should return a VESTING_LENGHT_BUY_MORE_MONTHS when you only have buyMore tokens and stake those", () => {
      const buyMoreTokens = calculateBuyMoreTokenBalance(800);
      const buyMoreInvestment: Investment = { ...zeroInv, buyMore: 800 };
      expect(buyMoreTokens).to.be.equal(5000);

      const lockTimeSeedExample1 = nftLockTimeByStake(4000, buyMoreInvestment);
      expect(lockTimeSeedExample1).to.equal(VESTING_LENGHT_BUY_MORE_MONTHS);

      const lockTimeSeedExample2 = nftLockTimeByStake(5000, buyMoreInvestment);
      expect(lockTimeSeedExample2).to.equal(VESTING_LENGHT_BUY_MORE_MONTHS);
    });

    it("Should error when calculating a locktime for less than the minimum requirement and you are eliglbe for more", async () => {
      const seedInvestment: Investment = { ...zeroInv, seed: 5000, seedPool: 5000 };
      const amountTokensBought = calculateAmountBoughtTotal(seedInvestment);
      expect(amountTokensBought).to.be.above(MIN_TOKEN_STAKING);
      expect(() => nftLockTimeByStake(3000, seedInvestment)).to.throw();
    });

    it("Should error when calculating locktime for staking more than you eligible for", async () => {
      const seedInvestment: Investment = { ...zeroInv, seed: 5000, seedPool: 5000 };
      const amountTokensBought = calculateAmountBoughtTotal(seedInvestment);
      expect(() => nftLockTimeByStake(amountTokensBought + 1, seedInvestment)).to.throw();
    });
  });

  describe("Minting", async () => {
    it("Should revert on mint with an invalid signature", async () => {
      const failingSignature =
        "0x48e26ea2d47b73e8e058325bc0a1c29230d48b18ad04641394a678bf5dfc939b75603ffa49dc5973ca83433f3e07bc9816222a99511ef3047c441adadb8cbc1d1c";
      await expect(nft.connect(nftMinter1).mintNft(0, 0, 0, 0, failingSignature)).to.be.revertedWith(
        "SignatureInvalid",
      );
    });

    it("Should revert when trying to read the tokenURI of a non existing token", async () => {
      await expect(nft.tokenURI(1)).to.be.revertedWith("NftNotExists");
    });

    it("Mint an nft", async () => {
      ({ nftId: nftId1, voucherId: voucherId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      console.log("Minted nft with token id", nftId1);
      console.log("TokenURI:", await nft.tokenURI(nftId1));
    });

    it("The nft contract should have the MINTER_ROLE", async () => {
      expect(await workToken.hasRole(await workToken.MINTER_ROLE(), nft.address)).to.be.true;
    });

    it("Check if the getIdsFromOwner function works if it properly returns the tokenIds of the owner", async () => {
      expect((await nft.getIdsFromWallet(nftMinter1.address))[0]).to.equal(nftId1);
    });

    it("Check if the voucherIdToTokenId is properly updated", async () => {
      const _nft = await nft.nft(nftId1);
      expect(_nft.voucherId).to.equal(voucherId1);
    });
  });

  describe("Stake into the NFT", async () => {
    it("Try to stake un-approved ERC20 tokens", async () => {
      await expect(nft.stake(nftId1, 5575)).to.be.reverted;
    });

    it("Stake into the NFT, increasing contract balance and updating mapping", async () => {
      await approveWorkToken(network, workToken, nftMinter1, nft.address);
      const oldcontractERC20Balance = await balanceOf(workToken, nft.address);
      const nft1 = await nft.getNftInfo(nftId1);
      expect(nft1._level).to.equal(big(0));
      expect(nft1._tier).to.equal(big(0));
      expect(nft1._staked).to.equal(big(0));
      // the multiplier for level 0 is 0.1, but we used it times 10 to get rid of the decimals
      // The base multiplier is 2 * 10, so the total multiplier is 2.1

      const nftInfoMonth1 = await nft.getNftInfo(nftId1);
      expect(nftInfoMonth1._shares).to.be.equal(51);
      await mineDays(10, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(2500));
      const _nft = await nft.getNftInfo(nftId1);
      expect(_nft._tier).to.equal(big(0));
      expect(_nft._level).to.be.equal(big(4));
      expect(_nft._staked).to.equal(amount(2500));
      const newContractERC20Balance = await balanceOf(workToken, nft.address);
      expect(newContractERC20Balance > oldcontractERC20Balance).to.be.true;
    });
  });

  describe("Increasing the Level of the NFT", async () => {
    it("Testing staking and lvl increase", async () => {
      await mineDays(12, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(3075));
      // There should be now 2500+3075=5575 #oftokensStaked in token 1.
      const _nft = await nft.getNftInfo(nftId1);
      expect(_nft._level).to.be.equal(big(9));
      // Get the multiplier for this token with calculateTokenIdShares it should be 11 (1.1 *10 to get rid of the fraction) for level 9,
      const nftInfoMonth = await nft.getNftInfo(nftId1);
      expect(nftInfoMonth._shares).to.be.equal(big(61));
    });

    it("Test increasing Tier", async () => {
      // Only go to a higer level when increasing a Tier,
      await mineDays(978, network);
      const _nft1 = await nft.getNftInfo(nftId1);
      expect(_nft1._tier).to.equal(big(0));
      await nft.connect(nftMinter1).stake(nftId1, amount(2500));
      const _nft2 = await nft.getNftInfo(nftId1);
      expect(_nft2._level).to.be.equal(big(10));
      // Current amount is 5575 + 2500 = 8075
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const _nft3 = await nft.getNftInfo(nftId1);
      expect(_nft3._tier).to.equal(big(1));
      expect(_nft3._level).to.be.equal(big(13));
      // Current Amount is 5575 + 2500 + 25000 = 33075
      await nft.connect(nftMinter1).stake(nftId1, amount(25000));
      const _nft4 = await nft.getNftInfo(nftId1);
      expect(_nft4._tier).to.equal(big(1));
      expect(_nft4._level).to.be.equal(big(20));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const _nft5 = await nft.getNftInfo(nftId1);
      expect(_nft5._tier).to.equal(big(3));
      expect(_nft5._level).to.be.equal(big(34));
      // Current Amount is 5575 + 2500 + 25000 + 125000 = 158075
      await nft.connect(nftMinter1).stake(nftId1, amount(125000));
      const _nft6 = await nft.getNftInfo(nftId1);
      expect(_nft6._tier).to.equal(big(3));
      expect(_nft6._level).to.be.equal(big(40));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      const _nft7 = await nft.getNftInfo(nftId1);
      expect(_nft7._tier).to.equal(big(8));
      expect(_nft7._level).to.be.equal(big(80));
    });

    it("Test if getTotals returns all values correctly", async () => {
      const totalInfo = await nft.getTotals(await nft.getCurrentMonth());
      expect(totalInfo._totalShares).to.equal(big(370));
      expect(totalInfo._totalBalance).to.equal(amount(158075));
    });

    it("Test if we can stake unlimited tokens at level 80", async () => {
      const _nftBefore = await nft.getNftInfo(nftId1);
      expect(1000000).to.be.greaterThan(Number(ethers.utils.formatEther(_nftBefore._stakingAllowance)));
      await nft.connect(nftMinter1).stake(nftId1, amount(1000000));
      const _nftAfter = await nft.getNftInfo(nftId1);
      expect(_nftBefore._staked).to.equal(_nftAfter._staked.sub(amount(1000000)));
    });

    it("Test if getNftInfo returns all values correctly", async () => {
      const tokenInfo = await nft.getNftInfo(nftId1);
      expect(tokenInfo[0]).to.equal(amount(1158075));
      expect(tokenInfo[1]).to.equal(amount(0));
      expect(tokenInfo[2]).to.equal(big(370));
      expect(tokenInfo[3]).to.equal(big(80));
      expect(tokenInfo[4]).to.equal(big(8));
    });
  });

  describe("Destroy NFT and unstake tokens", async () => {
    let ownerNft2: SignerWithAddress;
    let ownerNft3: SignerWithAddress;
    let nftId2: number;
    let nftId3: number;

    let lockPeriod2: number;
    let lockPeriod3: number;

    before(async () => {
      ownerNft2 = accounts[1];
      ownerNft3 = accounts[2];

      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 12;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await distribution.setWalletClaimable([nftMinter1.address], [158075], [0], [0], [0]);
      await distribution.setWalletClaimable([ownerNft2.address], [10000], [0], [0], [0]);
      await distribution.setWalletClaimable([ownerNft3.address], [10000], [0], [0], [0]);
      await mineDays(12, network);
      await mintNft(network, nft, workToken, nftMinter1, 158075, 0, 0, chainId);
      lockPeriod2 = monthsToSeconds(nftLockTimeByStake(5000, seed1kInv));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, ownerNft2, 5000, lockPeriod2, 0, chainId));
      await mineDays(11, network);
      await nft.connect(ownerNft2).stake(nftId2, amount(3075));
      expect((await nft.getStaked(nftId2, await nft.getCurrentMonth()))[0]).to.equal(amount(8075));
      lockPeriod3 = monthsToSeconds(nftLockTimeByStake(6000, seed1kInv));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, ownerNft3, 6000, lockPeriod3, 0, chainId));
    });

    it("Check Nft 3 has staked more than Nft 2, while having the same investment, so it is earlier destroyable", async () => {
      expect(lockPeriod3 < lockPeriod2).to.be.true;
    });

    it("Destroying NFT you are not the owner of", async () => {
      await expect(nft.connect(ownerNft3).destroyNft(nftId2)).to.be.revertedWith("NftNotOwned");
    });

    it("Approving the NFT of another person", async () => {
      await expectToRevert(
        approveGenesisNft(network, nft, nftId2, signerImpersonated, nft.address),
        "ERC721: approve caller is not token owner or approved for all",
      );
    });

    it("Destroying the NFT of another person", async () => {
      await approveGenesisNft(network, nft, nftId2, ownerNft2, nft.address);
      await expect(nft.destroyNft(nftId2)).to.be.revertedWith("NftNotOwned");
    });

    it("Try destroying Nft 2 right before end lock period and expect revert", async () => {
      // The full period is 547.5 days, so we mine from day 11 to day 547, almost destroyable.
      await mineDays(536, network);
      expect(lockPeriod2).to.be.equal(monthsToSeconds(18));
      const currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp;
      const startTime = await nft.startTime();
      const lockedUntil = Number(startTime.add(lockPeriod2));
      expect(currentTimeStamp).to.be.lt(lockedUntil);
      await expect(nft.connect(ownerNft2).destroyNft(nftId2)).to.be.revertedWith("NftLocked");
    });

    it("Try destroying callStatic Nft 3 after 547 days, you staked more so you would already be destroyable", async () => {
      const currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp;
      const startTime = await distribution.startTime();
      const lockedUntil = Number(startTime.add(lockPeriod3));
      expect(currentTimeStamp).to.be.gt(lockedUntil);
      await nft.connect(ownerNft3).callStatic.destroyNft(nftId3);
    });

    it("Mine one more day and now lockperiod of Nft 2 is passed", async () => {
      await mineDays(1, network);
      const currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp;
      const startTime = await distribution.startTime();
      const lockedUntil = Number(startTime.add(lockPeriod2));
      expect(currentTimeStamp).to.be.gt(lockedUntil);
    });

    it("Destroy Nft 2 and refund tokens", async () => {
      expect(await nft.ownerOf(nftId2)).to.equal(ownerNft2.address);
      // In total the amount staked in the contract is 158075 + 6000 + 8075 = 172150
      const workTokenBalance = await balanceOf(workToken, ownerNft2.address);
      await nft.connect(ownerNft2).destroyNft(nftId2);
      await expectToRevert(nft.ownerOf(nftId2), "ERC721: invalid token ID");
      await expect(nft.connect(ownerNft3).destroyNft(nftId2)).to.be.revertedWith("ERC721: invalid token ID");
      // what is left in the contract is: 172150-8075 = 164075
      expect(await balanceOf(workToken, nft.address)).to.equal(amount(164075));
      expect(await balanceOf(workToken, ownerNft2.address)).to.equal(workTokenBalance.add(amount(8075)));
    });

    it("Destroy Nft 3 and refund tokens", async () => {
      expect(await nft.ownerOf(nftId3)).to.equal(ownerNft3.address);
      // In total the amount staked in the contract is 172150-8075 = 164075
      const workTokenBalance = await balanceOf(workToken, ownerNft3.address);
      await nft.connect(ownerNft3).destroyNft(nftId3);
      await expectToRevert(nft.ownerOf(nftId2), "ERC721: invalid token ID");
      await expect(nft.getStaked(nftId3, await nft.getCurrentMonth())).to.be.revertedWith("NftNotExists");
      // what is left in the contract is: 164075-6000 = 164075
      expect(await balanceOf(workToken, nft.address)).to.equal(amount(158075));
      expect(await balanceOf(workToken, ownerNft3.address)).to.equal(workTokenBalance.add(amount(6000)));
    });

    it("Make sure you cannot destroy it again", async () => {
      await expectToRevert(nft.connect(ownerNft2).destroyNft(nftId2), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft3).destroyNft(nftId3), "ERC721: invalid token ID");
    });

    it("Make sure you cannot unstake anymore after destroying", async () => {
      await expectToRevert(nft.connect(ownerNft2).unstake(nftId2, 0), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft2).unstake(nftId2, 1), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft2).unstake(nftId2, amount(250)), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft3).unstake(nftId3, 0), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft3).unstake(nftId3, 1), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(ownerNft3).unstake(nftId3, amount(250)), "ERC721: invalid token ID");
    });
  });

  describe("Staking allowance", async () => {
    let ownerNft4: SignerWithAddress;
    let nftId4: number;

    before(async () => {
      ownerNft4 = accounts[4];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, ownerNft4, 0, 0, 0, chainId));
    });

    it("Try staking more than approved on the first day", async () => {
      await expect(nft.connect(ownerNft4).stake(nftId4, amount(300))).to.be.revertedWith("AllowanceExceeded");
    });

    it("Be able to stake full amount on the first day, but not more, then stake again the second day", async () => {
      await nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE));
      await expect(nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE))).to.be.revertedWith(
        "AllowanceExceeded",
      );
      await mineDays(1, network);
      await nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE));
    });

    it("Wait 15 days and be able to stake i.e. 10 days of daily allowance and have 5 left", async () => {
      // 15 days
      await mineDays(15, network);

      const _nftBefore = await nft.getNftInfo(nftId4);
      expect(_nftBefore._stakingAllowance).to.equal(amount(15 * DAILY_STAKING_ALLOWANCE));
      await nft.connect(ownerNft4).stake(nftId4, amount(10 * DAILY_STAKING_ALLOWANCE));
      const _nftAfter = await nft.getNftInfo(nftId4);
      expect(_nftAfter._stakingAllowance).to.equal(amount(5 * DAILY_STAKING_ALLOWANCE));
      const _nft1 = await nft.getNftInfo(nftId4);
      expect(_nft1._level).to.equal(big(6));
    });

    it("Now lvl 6, wait 5 days and the allowance has accumulated", async () => {
      await mineDays(5, network);
      const _nftBefore = await nft.getNftInfo(nftId4);
      expect(_nftBefore._stakingAllowance).to.equal(amount(10 * DAILY_STAKING_ALLOWANCE));
      await nft.connect(ownerNft4).stake(nftId4, amount(10 * DAILY_STAKING_ALLOWANCE));
      const _nftAfter = await nft.getNftInfo(nftId4);
      expect(_nftAfter._stakingAllowance).to.equal(big(0));
    });
  });

  describe("Unstake when the NFT is at max level", async () => {
    let ownerNft5: SignerWithAddress;
    let nftId5: number;

    before(async () => {
      ownerNft5 = accounts[5];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 10;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await distribution.setWalletClaimable([ownerNft5.address], [251], [0], [0], [0]);
      await mineDays(12, network);
      const lockPeriod = monthsToSeconds(nftLockTimeByStake(251, seed251Inv));
      ({ nftId: nftId5 } = await mintNft(network, nft, workToken, ownerNft5, 251, lockPeriod, 0, chainId));
      await mineDays(1000, network);
    });

    // 1. failing to unstake when you are not max level
    it("Fail to unstake when the NFT is not max level", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(DAILY_STAKING_ALLOWANCE));
      // failing to unstake at lvl zero.
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(DAILY_STAKING_ALLOWANCE))).to.be.revertedWith(
        "UnstakeAmountNotAllowed",
      );
      // stake more and become lvl 2.
      await nft.connect(ownerNft5).stake(nftId5, amount(511));
      // currently staked 250+294+512 = 1056
      // will fail to unstake at level 2.
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(DAILY_STAKING_ALLOWANCE))).to.be.revertedWith(
        "UnstakeAmountNotAllowed",
      );
    });

    // 2. failing to unstake exact maximum amount + 1 when you are max level.
    it("Fail to unstake exact maximum amount + 1 when the NFT is max level", async () => {
      // we will stake extra to become lvl 10 with 5580 staked tokens
      await nft.connect(ownerNft5).stake(nftId5, amount(5024));
      expect((await nft.getStaked(nftId5, await nft.getCurrentMonth()))[0]).to.equal(amount(6080));
      // With 6080 tokens you are still lvl 10, so 6369 - 5580 = 789 tokens are allowed to unstake.
      // Fail to unstake 790 tokens.
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(501))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Unstake maximum possible amount, which retains the max level", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(10);
      expect(_nft1._staked).to.equal(amount(6080));
      await nft.connect(ownerNft5).unstake(nftId5, amount(500));
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(10);
      expect(_nft2._staked).to.equal(amount(5580));
      await expect(nft.connect(ownerNft5).unstake(nftId5, 1)).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    // 4. upgrade Tier, go from level 10, to lvl zero.
    it("upgrade Tier, go from level 10, tier 0 to lvl 10 tier 1", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(10);
      expect(_nft1._tier).to.eq(0);
      await network.provider.send("evm_increaseTime", [1 * 86400]);
      await network.provider.send("evm_mine");
      await nft.connect(ownerNft5).stake(nftId5, amount(162));
      //staked 5742
      await nft.connect(ownerNft5).unstake(nftId5, amount(25));
      //staked 5717
      await nft.connect(ownerNft5).evolveTier(nftId5);
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(10);
      expect(_nft2._tier).to.eq(1);

      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(10))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    // 5. Stake more, upgrade tier, try the same tests 2 & 3 &  at lvl 20.
    it("Stake more, upgrade tier, failing to unstake exact maximum amount + 1 when you are lvl20", async () => {
      // 30 * 80 = 2400, staking this
      await nft.connect(ownerNft5).connect(ownerNft5).stake(nftId5, amount(6000));
      // Now we have staked 2400+2290 = 4690
      expect((await nft.getStaked(nftId5, await nft.getCurrentMonth()))[0]).to.equal(amount(11717));
      // 30 * 87 = 2610, staking this
      await nft.connect(ownerNft5).stake(nftId5, amount(6510));
      // Now we have staked 2290+2400+2610= 7300
      expect((await nft.getStaked(nftId5, await nft.getCurrentMonth()))[0]).to.equal(amount(18227));
      // Now we are lvl 20, we need to keep 5615 to stay lvl 20, so we can unstake 7300-5615=1685
      // So unstaking 1686 will fail.
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(4208))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Unstake exact maximum amount, so you still stay in max level20", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(20);
      expect(_nft1._staked).to.equal(amount(18227));
      await nft.connect(ownerNft5).unstake(nftId5, amount(4207));
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(20);
      expect(_nft2._staked).to.equal(amount(14020));
      await expect(nft.connect(ownerNft5).unstake(nftId5, 1)).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Upgrade tier, you still stay in max level20, but go the next tier", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(20);
      expect(_nft1._tier).to.eq(1);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(20);
      expect(_nft2._tier).to.eq(2);
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(10))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Stake more, upgrade tier to 7, failing to unstake exact maximum amount + 1 when you are lvl80", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(125000));
      // increasing to the last tier
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._tier).to.eq(2);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._tier).to.eq(7);
      expect(_nft2._level).to.eq(76);
      await nft.connect(ownerNft5).stake(nftId5, amount(14062));
      const _nft3 = await nft.getNftInfo(nftId5);
      expect(_nft3._staked).to.equal(amount(153082));
      // Now we have staked 14020 + 14062 + 125000 = 153082
      // Now we are lvl 80, we need to keep 152720 to stay lvl 80, so we can unstake 153082-152720=362
      // So unstaking 363 will fail.
      await expect(nft.connect(ownerNft5).unstake(nftId5, amount(363))).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Unstake maximum surplus, so the NFT will stay max level 80", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(80);
      expect(_nft1._staked).to.equal(amount(153082));
      await nft.connect(ownerNft5).unstake(nftId5, amount(362));
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(80);
      expect(_nft2._staked).to.equal(amount(152720));
    });

    it("Upgrade the tier, while the NFT is max level 80", async () => {
      const _nft1 = await nft.getNftInfo(nftId5);
      expect(_nft1._level).to.eq(80);
      expect(_nft1._tier).to.eq(7);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      const _nft2 = await nft.getNftInfo(nftId5);
      expect(_nft2._level).to.eq(80);
      expect(_nft2._tier).to.eq(8);

      await expect(nft.connect(ownerNft5).unstake(nftId5, 10)).to.be.revertedWith("UnstakeAmountNotAllowed");
    });

    it("Do not go to a higher level when staking more in the last tier + lvl 80", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(50000));
      const _nft3 = await nft.getNftInfo(nftId5);
      expect(_nft3._level).to.eq(80);
      expect(_nft3._tier).to.eq(8);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      const _nft4 = await nft.getNftInfo(nftId5);
      expect(_nft4._tier).to.eq(8);
    });
  });

  describe("Testing one time voucher use", async () => {
    let voucher: Voucher;
    let tokenIdsOwnedBeforeMint: BigNumber[];
    let nftId6: number;
    let ownerNft6: SignerWithAddress;
    let ownerNft7: SignerWithAddress;

    before(async () => {
      ownerNft6 = accounts[6];
      ownerNft7 = accounts[7];

      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);
      voucher = await nftMintVoucherGenerateLocal(ownerNft6.address, 0, nft.address, 0, 0, chainId);
    });

    it("Check that the account has not minted any NFT yet", async () => {
      expect(await nft.accountMinted(ownerNft6.address)).to.equal(false);
      tokenIdsOwnedBeforeMint = await nft.getIdsFromWallet(ownerNft6.address);
      expect(tokenIdsOwnedBeforeMint.length).to.equal(0);
    });

    it("Check that the voucher works and is set to used", async () => {
      nftId6 = await nft.nftIdCounter();
      await expect(
        await nft
          .connect(ownerNft6)
          .mintNft(voucher.voucherId, 0, amount(0), voucher.lockPeriod, voucher.voucherSignature),
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.constants.AddressZero, ownerNft6.address, nftId6);
      expect(await nft.accountMinted(ownerNft6.address)).to.equal(true);
      const _nft = await nft.nft(nftId6);

      expect(_nft.voucherId).to.equal(voucher.voucherId);
    });

    it("Check that the voucher cannot be used again", async () => {
      await expect(
        nft.connect(ownerNft6).mintNft(voucher.voucherId, 0, 0, 0, voucher.voucherSignature),
      ).to.be.revertedWith("AccountMintedPreviously");
    });

    it("Check that the amount of nft owned increased by exactly 1", async () => {
      const tokenIdsOwnedAfterMint = await nft.getIdsFromWallet(ownerNft6.address);
      expect(tokenIdsOwnedAfterMint.length).to.equal(tokenIdsOwnedBeforeMint.length + 1);
    });
  });

  describe("Shares", async () => {
    let nftMinter7: SignerWithAddress;
    let nftMinter8: SignerWithAddress;
    let nftMinter9: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;
    let nftId3: number;
    let nftId4: number;

    let currentMonth: number;

    before(async () => {
      nftMinter7 = accounts[7];
      nftMinter8 = accounts[8];
      nftMinter9 = accounts[9];
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);

      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter7, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter8, 0, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter9, 0, 0, 0, chainId));
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    });

    it("Pre-condition check, the current month is 0, the NFTs each have 51 shares, the total shares is correct", async () => {
      expect(await nft.getCurrentMonth()).to.be.equal(0);
      expect(await getShares(0, nft)).to.be.equal(51);
      expect(await getShares(1, nft)).to.be.equal(51);
      expect(await getShares(2, nft)).to.be.equal(51);
      expect(await getShares(3, nft)).to.be.equal(51);
      expect((await nft.getTotals(0))._totalShares).to.be.equal(51 + 51 + 51 + 51);
    });

    it("The updateShares is updated correctly, the current month is 0, the shares of id 1 and 2 are equal and total shares are equal to the shares of 1 + 2", async () => {
      await mineDays(10, network);
      expect(await nft.getCurrentMonth()).to.be.equal(0);
      expect(await getShares(0, nft)).to.be.equal(big(51));
      expect(await getShares(1, nft)).to.be.equal(big(51));
      expect(await getShares(2, nft)).to.be.equal(big(51));
      expect(await getShares(3, nft)).to.be.equal(big(51));
      expect((await nft.getTotals(0))._totalShares).to.be.equal(51 + 51 + 51 + 51);
    });

    it("1 month later, the current month is 1, the shares of id 1 is 6, now we will stake 10k tokens, and update the shares to 18", async () => {
      await mineDays(30, network);
      expect(await nft.getCurrentMonth()).to.be.equal(1);
      await approveToken(network, workToken, nftMinter9, nft.address);
      await nft.connect(nftMinter9).stake(2, amount(10000));
      expect(await getShares(0, nft)).to.be.equal(big(51));
      expect(await getShares(1, nft)).to.be.equal(big(51));
      expect(await getShares(2, nft)).to.be.equal(big(63));
      expect(await getShares(3, nft)).to.be.equal(big(51));
      await mineDays(30, network);
      expect(await nft.getCurrentMonth()).to.be.equal(2);
      await approveToken(network, workToken, nftMinter7, nft.address);
      await nft.connect(nftMinter7).stake(0, amount(10000));
      expect(await getShares(0, nft)).to.be.equal(big(63));
      expect(await getShares(1, nft)).to.be.equal(big(51));
      expect(await getShares(2, nft)).to.be.equal(big(63));
      expect(await getShares(3, nft)).to.be.equal(big(51));
    });

    it("The total shares at month 2 is now 63 + 51 + 51", async () => {
      expect((await nft.getTotals(1))._totalShares).to.be.equal(63 + 51 + 51 + 51);
    });

    it("The total shares at month 3 is now 63 + 63 + 51", async () => {
      expect((await nft.getTotals(2))._totalShares).to.be.equal(63 + 63 + 51 + 51);
    });

    it("Nft 2 will become level 10, like NFT 1 and then NFT 2 will be destroyed", async () => {
      await mineDays(40, network);
      await approveToken(network, workToken, nftMinter8, nft.address);
      await nft.connect(nftMinter8).stake(1, amount(10000));
      expect((await nft.getTotals(3))._totalShares).to.be.equal(63 + 63 + 63 + 51);

      await nft.connect(nftMinter8).destroyNft(1);
      expect((await nft.getTotals(3))._totalShares).to.be.equal(63 + 63 + 51);
      expect(await getShares(0, nft)).to.be.equal(big(63));
      await expect(getShares(1, nft)).to.be.revertedWith("NftNotExists");
      expect(await getShares(2, nft)).to.be.equal(big(63));
    });

    it("Two months later, the current month is 5, total remains the same (tests looping back)", async () => {
      await mineDays(60, network);
      expect(await nft.getCurrentMonth()).to.be.equal(5);
      expect((await nft.getTotals(5))._totalShares).to.be.equal(63 + 63 + 51);
    });

    it("Two months later, the current month is 7 and nft 1 will be destroyed, the total shares will be 63", async () => {
      await mineDays(60, network);
      await nft.connect(nftMinter7).destroyNft(0);
      expect(await nft.getCurrentMonth()).to.be.equal(7);
      expect((await nft.getTotals(7))._totalShares).to.be.equal(63 + 51);
    });

    it("Calling stake should increase shares of the nft, if you are not max level", async () => {
      const nftSharesBefore = await getShares(nftId4, nft);
      await approveToken(network, workToken, nftMinter1, nft.address);
      await nft.connect(nftMinter1).stake(nftId4, amount(6580));
      const nftSharesAfter = await getShares(nftId4, nft);
      expect(nftSharesAfter).to.be.gt(nftSharesBefore);
    });

    it("Calling stake should not increase shares of the nft, if you are already at max level", async () => {
      const _nft1 = await nft.getNftInfo(nftId4);
      expect(_nft1._level).to.be.equal(10);
      await approveToken(network, workToken, nftMinter1, nft.address);
      await nft.connect(nftMinter1).stake(nftId4, amount(2000));
      const _nft2 = await nft.getNftInfo(nftId4);
      expect(_nft2._shares).to.be.equal(_nft1._shares);
    });

    it("Calling unstake should not decrease shares of the nft", async () => {
      const nftSharesBefore = await getShares(nftId4, nft);
      await nft.connect(nftMinter1).unstake(nftId4, amount(1000));
      const nftSharesAfter = await getShares(nftId4, nft);
      expect(nftSharesAfter).to.be.equal(nftSharesBefore);
    });

    it("Calling evolveTier should increase shares of the nft when it changes your lvl", async () => {
      const _nft1 = await nft.getNftInfo(nftId4);
      await nft.connect(nftMinter1).evolveTier(nftId4);
      const _nft2 = await nft.getNftInfo(nftId4);
      expect(_nft2._level).to.be.gt(_nft1._level);
      expect(_nft2._shares).to.be.gt(_nft1._shares);
    });

    it("Calling stake should increase shares total, if you are not max level", async () => {
      currentMonth = (await nft.getCurrentMonth()).toNumber();
      const totalSharesBefore = (await nft.getTotals(currentMonth))._totalShares;
      await approveToken(network, workToken, nftMinter1, nft.address);
      await nft.connect(nftMinter1).stake(nftId4, amount(11000));
      const totalSharesAfter = (await nft.getTotals(currentMonth))._totalShares;
      expect(totalSharesAfter).to.be.gt(totalSharesBefore);
    });

    it("Stake should not increase shares total, if you are already at max level", async () => {
      const _nft1 = await nft.getNftInfo(nftId4);
      expect(_nft1._level).to.be.equal(20);
      const totalSharesBefore = (await nft.getTotals(currentMonth))._totalShares;
      await approveToken(network, workToken, nftMinter1, nft.address);
      await nft.connect(nftMinter1).stake(nftId4, amount(2000));
      const totalSharesAfter = (await nft.getTotals(currentMonth))._totalShares;
      expect(totalSharesAfter).to.be.equal(totalSharesBefore);
    });

    it("Calling unstake should not decrease shares total", async () => {
      const totalSharesBefore = (await nft.getTotals(currentMonth))._totalShares;
      await nft.connect(nftMinter1).unstake(nftId4, amount(2000));
      const totalSharesAfter = (await nft.getTotals(currentMonth))._totalShares;
      expect(totalSharesAfter).to.be.equal(totalSharesBefore);
    });

    it("Calling evolveTier should increase shares total of the nft when it changes your lvl", async () => {
      const totalSharesBefore = (await nft.getTotals(currentMonth))._totalShares;
      const _nft1 = await nft.getNftInfo(nftId4);
      await nft.connect(nftMinter1).evolveTier(nftId4);
      const _nft2 = await nft.getNftInfo(nftId4);
      const totalSharesAfter = (await nft.getTotals(currentMonth))._totalShares;
      expect(_nft2._level).to.be.gt(_nft1._level);
      expect(totalSharesAfter).to.be.gt(totalSharesBefore);
    });
  });

  //test if the looping back works till zero and is then broken.
  describe("Update Shares, no mint in the first month and then mint", async () => {
    before(async () => {
      workToken = await regenerateWorkToken(accounts, accounts[0].address);
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 8;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);
    });

    describe("Minting after two months", async () => {
      it("Setup 1 NFT after two months", async () => {
        await mineDays(60, network);
        await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId);
      });

      it("The updateShares is updated correctly, the current month is 2, the shares of id 1 51", async () => {
        expect(await nft.getCurrentMonth()).to.be.equal(2);
        // 1 for level 0 + 5 for base stake for investing 1k
        expect(await getShares(0, nft)).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(0))._totalShares).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(1))._totalShares).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(2))._totalShares).to.be.equal(ethers.BigNumber.from(51));
      });
    });
  });

  describe("Testing setNftAttributes", async () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;
    let nftMinter3: SignerWithAddress;
    let nftMinter4: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;
    let nftId3: number;
    let nftId4: number;

    let attributes1: string;
    let attributes2: string;
    let attributes3: string;
    let attributes4: string;

    before(async () => {
      nftMinter1 = accounts[1];
      nftMinter2 = accounts[2];
      nftMinter3 = accounts[3];
      nftMinter4 = accounts[4];
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);

      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 0, 0, 0, chainId));
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, nftMinter4, 0, 0, 0, chainId));
    });

    it("The attributes are not set yet after minting", async () => {
      const nftInfo1 = await nft.nft(nftId1);
      attributes1 = nftInfo1.encodedAttributes;
      const nftInfo2 = await nft.nft(nftId2);
      attributes2 = nftInfo2.encodedAttributes;
      const nftInfo3 = await nft.nft(nftId3);
      attributes3 = nftInfo3.encodedAttributes;

      expect(attributes1).to.be.equal(ethers.utils.formatBytes32String(""));
      expect(attributes2).to.be.equal(ethers.utils.formatBytes32String(""));
      expect(attributes3).to.be.equal(ethers.utils.formatBytes32String(""));
    });

    it("setNftAttributes reverts when non contract owner calls it", async () => {
      const attributeToSet = "0x0104050a1e000000000000".concat("0".repeat(42));
      await expect(nft.connect(nftMinter1).setNftAttributes([nftId1], [attributeToSet])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("setNftAttributes can be correctly set with attributes for one nft", async () => {
      const attributeToSet = "0x0104050a1e000000000000".concat("0".repeat(42));
      await nft.setNftAttributes([nftId1], [attributeToSet]);
      const nftInfo1 = await nft.nft(nftId1);
      attributes1 = nftInfo1.encodedAttributes;
      expect(attributes1).to.be.equal(attributeToSet);
    });

    it("setNftAttributes can be correctly set for array of three nfts", async () => {
      const attributeToSet1 = "0x0101010101000000000000".concat("0".repeat(42));
      const attributeToSet2 = "0x0202020202000000000000".concat("0".repeat(42));
      const attributeToSet3 = "0x0303030303000000000000".concat("0".repeat(42));
      await nft.setNftAttributes([nftId1, nftId2, nftId3], [attributeToSet1, attributeToSet2, attributeToSet3]);

      const nftInfo1 = await nft.nft(nftId1);
      attributes1 = nftInfo1.encodedAttributes;
      const nftInfo2 = await nft.nft(nftId2);
      attributes2 = nftInfo2.encodedAttributes;
      const nftInfo3 = await nft.nft(nftId3);
      attributes3 = nftInfo3.encodedAttributes;
      const nftInfo4 = await nft.nft(nftId4);
      attributes4 = nftInfo4.encodedAttributes;

      expect(attributes1).to.be.equal(attributeToSet1);
      expect(attributes2).to.be.equal(attributeToSet2);
      expect(attributes3).to.be.equal(attributeToSet3);
      expect(attributes4).to.be.equal(ethers.utils.formatBytes32String(""));
    });

    it("The batch event is emitted that checks the correct tokenIds", async () => {
      const attributeToSet1 = "0x0101010101000000000000".concat("0".repeat(42));
      const attributeToSet2 = "0x0202020202000000000000".concat("0".repeat(42));
      const attributeToSet3 = "0x0303030303000000000000".concat("0".repeat(42));
      await nft.setNftAttributes([nftId1, nftId2, nftId3], [attributeToSet1, attributeToSet2, attributeToSet3]);

      const tx = await nft.setInitCompleted();
      await expect(tx).to.emit(nft, "BatchMetadataUpdate").withArgs(0, 999);
    });

    it("After InitCompleted setNftAttributes reverts", async () => {
      await nft.setInitCompleted();
      await expect(nft.setNftAttributes([nftId1], [attributes1])).to.be.revertedWith("InitHasCompleted");
    });
  });

  describe("Testing reward function", async () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;
    let rewarder: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;

    before(async () => {
      nftMinter1 = accounts[1];
      nftMinter2 = accounts[2];
      nftMinter3 = accounts[3];
      rewarder = accounts[4];
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      await mineDays(12, network);

      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 0, 0, 0, chainId));
    });

    it("Should revert when reward function when account without Reward role calls it", async () => {
      await expect(nft.connect(nftMinter1).reward(nftId1, 1)).to.be.revertedWith("RewarderRoleNotPresent");
    });

    it("Should revert when non-owner calls setRewarder role", async () => {
      await expect(nft.connect(nftMinter1).setRewarder(rewarder.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Rewarder correctly does not have the role", async () => {
      expect(await nft.isRewarder(rewarder.address)).to.be.equal(false);
    });

    it("Owner should be able to correctly set the rewarder role", async () => {
      await nft.setRewarder(rewarder.address, true);
      expect(await nft.isRewarder(rewarder.address)).to.be.equal(true);
    });

    it("Should emit RewarderSet event for the rewarder and its state", async () => {
      const tx = await nft.setRewarder(rewarder.address, true);
      await expect(tx).to.emit(nft, "RewarderSet").withArgs(rewarder.address, true);
    });

    it("Should revert when trying to reward an non-existent tokenId", async () => {
      await expect(nft.connect(rewarder).reward(100, 1)).to.be.revertedWith("NftNotExists");
    });

    it("Should revert Reward function when not yet approved", async () => {
      await expect(nft.connect(rewarder).reward(nftId1, 1)).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Reward should correctly update the rewarder staked/shares/level", async () => {
      await approveToken(network, workToken, rewarder, nft.address);
      await nft.connect(rewarder).reward(nftId1, amount(600));
      const staked = await nft.getStaked(nftId1, 0);
      expect(staked[0]).to.be.equal(amount(600));
      const nftInfo = await nft.getNftInfo(nftId1);
      expect(nftInfo._staked).to.be.equal(amount(600));
      expect(nftInfo._shares).to.be.equal(ethers.BigNumber.from(52));
      expect(nftInfo._level).to.be.equal(1);
      expect(nftInfo._tier).to.be.equal(0);
    });

    it("Reward should update all getNftInfo fields except the tier", async () => {
      await mineDays(30, network);
      const nftInfoBefore = await nft.getNftInfo(nftId2);
      expect(nftInfoBefore._stakingAllowance).to.be.equal(amount(294 * 30 + 294));
      expect(nftInfoBefore._tier).to.be.equal(0);
      await nft.connect(rewarder).reward(nftId2, amount(11000));
      const nftInfoAfter = await nft.getNftInfo(nftId2);
      expect(nftInfoAfter._stakingAllowance).to.be.equal(0);
      expect(nftInfoAfter._tier).to.be.equal(0);
      expect(nftInfoAfter._level).to.be.equal(10);
      expect(nftInfoAfter._shares).to.be.equal(ethers.BigNumber.from(63));
      expect(nftInfoAfter._staked).to.be.equal(amount(11000));
      const stakedMonth0 = (await nft.getStaked(nftId2, 0))[0];
      expect(stakedMonth0).to.be.equal(BigNumber.from(0));
      const stakedMonth1 = (await nft.getStaked(nftId2, 1))[0];
      expect(stakedMonth1).to.be.equal(amount(11000));
    });

    it("Should revert when trying to stake after a large reward", async () => {
      await expect(nft.connect(nftMinter2).stake(nftId2, amount(100))).to.be.revertedWith("AllowanceExceeded");
    });
  });
});
