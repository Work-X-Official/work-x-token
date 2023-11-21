import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, GenesisNftData, ERC20, TokenDistribution } from "../../typings";
import { big, expectToRevert, getImpersonateAccounts, mineDays, monthsToSeconds } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { DAILY_STAKING_ALLOWANCE } from "../constants";
import { Voucher, approveGenesisNft, nftLockTimeByStake, mintNft, nftMintVoucherGenerateLocal } from "../util/nft.util";
import {
  MIN_TOKEN_STAKING,
  VESTING_LENGHT_BUY_MORE_MONTHS,
  VESTING_LENGHT_PRESALE_MONTHS,
  VESTING_LENGHT_PRIVATE_MONTHS,
  VESTING_LENGHT_SEED_MONTHS,
} from "../../tasks/constants/sale.constants";
import { approveToken, approveWorkToken, balanceOf, sendTokens } from "../util/worktoken.util";
import {
  Investment,
  calculateAmountBoughtTotal,
  calculateBuyMoreTokenBalance,
  seed1kInv,
  seed251Inv,
  workBought,
  zeroInv,
} from "../util/sale.util";
import { maxLockLength } from "../util/distribution.util";

config();

chai.use(solidity);

/**
 * @todo
 * - [x] Test if stake and stakeAndEvolve emit events
 * - [x] Test if stakeAndEvolve automatically evolves the tier
 * - [x] Test new locktime calculation
 */

describe("GenesisNft", () => {
  let nft: GenesisNft;
  let nftData: GenesisNftData;
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
    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    await regenerateWorkToken();
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 6;
    await regenerateTokenDistribution(startTime);
    await regenerateNft();
    ({ nftId: nftId1, voucherId: voucherId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, chainId));
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

      it("Should return 2/3 of full vesting when you stake all your tokens but it is less then the minimum requirement.", () => {
        const smallInvestment: Investment = { ...zeroInv, seed: 50, seedPool: 50 };
        const amountTokensBought = calculateAmountBoughtTotal(smallInvestment);
        expect(amountTokensBought).to.be.below(MIN_TOKEN_STAKING);

        const lockTimeSeed = nftLockTimeByStake(amountTokensBought, smallInvestment);
        expect(lockTimeSeed).to.equal(VESTING_LENGHT_SEED_MONTHS * (2 / 3));
      });

      it("Should return full vesting when the minimum requirement plus all buyMore tokens are staked.", () => {
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

    it("Check if the image uri is stored correctly tokenIdToImageUri", async () => {
      expect((await nft.nft(nftId1)).imageUri).to.equal("https://content.workx.io/images/metamask_gold.png");
    });

    it("Check if the encodedAttributes are stored correctly tokenIdToEncodedAttributes", async () => {
      expect((await nft.nft(nftId1)).encodedAttributes).to.equal(ethers.utils.formatBytes32String("000100"));
    });
  });

  describe("Stake into the NFT", async () => {
    it("Try to stake un-approved ERC20 tokens", async () => {
      await expect(nft.stake(nftId1, 5575)).to.be.reverted;
    });

    it("Stake into the NFT, increasing contract balance and updating mapping", async () => {
      await approveWorkToken(network, workToken, nftMinter1, nft.address);
      const oldcontractERC20Balance = await balanceOf(workToken, nft.address);
      expect(await nft.getLevel(nftId1)).to.equal(big(0));
      expect(await nft.getTier(nftId1)).to.equal(big(0));
      expect(await nft.getStaked(nftId1)).to.equal(big(0));
      // the multiplier for level 0 is 0.1, but we used it times 10 to get rid of the decimals
      // The base multiplier is 2 * 10, so the total multiplier is 2.1
      const shares = await nft.calculateTokenIdShares(nftId1);
      expect(shares).to.be.equal(51);
      await mineDays(10, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(2500));
      expect(await nft.getTier(nftId1)).to.equal(big(0));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(4));
      expect(await nft.getStaked(nftId1)).to.equal(amount(2500));
      const newContractERC20Balance = await balanceOf(workToken, nft.address);
      expect(newContractERC20Balance > oldcontractERC20Balance).to.be.true;
    });
  });

  describe("Increasing the Level of the NFT", async () => {
    it("Testing staking and lvl increase", async () => {
      await mineDays(12, network);
      await nft.connect(nftMinter1).stake(nftId1, amount(3075));
      // There should be now 2500+3075=5575 #oftokensStaked in token 1.
      expect(await nft.getLevel(nftId1)).to.be.equal(big(9));
      // Get the multiplier for this token with calculateTokenIdShares it should be 11 (1.1 *10 to get rid of the fraction) for level 9,
      expect(await nft.calculateTokenIdShares(nftId1)).to.be.equal(big(61));
    });

    it("Test increasing Tier", async () => {
      // Only go to a higer level when increasing a Tier,
      await mineDays(978, network);
      expect(await nft.getTier(nftId1)).to.equal(big(0));
      await nft.connect(nftMinter1).stake(nftId1, amount(2500));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(10));
      // Current amount is 5575 + 2500 = 8075
      await nft.connect(nftMinter1).evolveTier(nftId1);
      expect(await nft.getTier(nftId1)).to.equal(big(1));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(13));
      // Current Amount is 5575 + 2500 + 25000 = 33075
      await nft.connect(nftMinter1).stake(nftId1, amount(25000));
      expect(await nft.getTier(nftId1)).to.equal(big(1));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(20));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      expect(await nft.getTier(nftId1)).to.equal(big(3));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(34));
      // Current Amount is 5575 + 2500 + 25000 + 125000 = 158075
      await nft.connect(nftMinter1).stake(nftId1, amount(125000));
      expect(await nft.getTier(nftId1)).to.equal(big(3));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(40));
      await nft.connect(nftMinter1).evolveTier(nftId1);
      expect(await nft.getTier(nftId1)).to.equal(big(8));
      expect(await nft.getLevel(nftId1)).to.be.equal(big(80));
    });

    // it("Test if aggregateInfo returns all values correctly", async () => {
    //   const tokenInfo = await nft.aggregateInfo(nftId1);
    //   expect(tokenInfo[0]).to.equal(amount(158075));
    //   expect(tokenInfo[1]).to.equal(amount(136219));
    //   expect(tokenInfo[2]).to.equal(big(370));
    //   expect(tokenInfo[3]).to.equal(big(80));
    //   expect(tokenInfo[4]).to.equal(big(8));
    // });

    it("Test if getTotals returns all values correctly", async () => {
      const totalInfo = await nft.getTotals(await nft.getCurrentMonth());
      expect(totalInfo._totalShares).to.equal(big(370));
      expect(totalInfo._totalBalance).to.equal(amount(158075));
    });
  });

  describe("Destroy NFT and unstake tokens", async () => {
    let ownerNft2: SignerWithAddress;
    let ownerNft3: SignerWithAddress;
    let nftId2: number;
    before(async () => {
      ownerNft2 = accounts[1];
      ownerNft3 = accounts[2];

      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 9;
      await regenerateTokenDistribution(startTime);
      await regenerateNft();

      await mintNft(network, nft, workToken, nftMinter1, 158075, 0, chainId);
      const lockPeriod = monthsToSeconds(nftLockTimeByStake(5000, seed1kInv));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, ownerNft2, 5000, lockPeriod, chainId));
      await mineDays(11, network);
      await nft.connect(ownerNft2).stake(nftId2, amount(3075));
      expect(await nft.getStaked(nftId2)).to.equal(amount(8075));
      await mintNft(network, nft, workToken, ownerNft3, 0, 0, chainId);
    });

    it("Destroying NFT you are not the owner of", async () => {
      await expectToRevert(nft.connect(ownerNft3).destroyNft(nftId2), "GenesisNft: You are not the owner of this NFT!");
    });

    it("Destroying unapproved NFT", async () => {
      await expectToRevert(
        nft.connect(ownerNft2).destroyNft(nftId2),
        "GenesisNft: This contract is not allowed to burn this NFT",
      );
    });

    it("Approving the NFT of another person", async () => {
      await expectToRevert(
        approveGenesisNft(network, nft, nftId2, signerImpersonated, nft.address),
        "ERC721: approve caller is not token owner or approved for all",
      );
    });

    it("Destroying the NFT of another person", async () => {
      await approveGenesisNft(network, nft, nftId2, ownerNft2, nft.address);
      await expectToRevert(nft.destroyNft(nftId2), "GenesisNft: You are not the owner of this NFT!");
    });

    it("Try destroying NFT within time lock and expect revert", async () => {
      await approveGenesisNft(network, nft, nftId2, accounts[1], nft.address);
      await expectToRevert(
        nft.connect(accounts[1]).destroyNft(nftId2),
        "GenesisNft: The NFT is still time-locked, so you can not destroy it yet",
      );
    });

    it("Destroy NFT and fix tokens", async () => {
      await approveGenesisNft(network, nft, nftId2, accounts[1], nft.address);
      expect(await nft.ownerOf(nftId2)).to.equal(accounts[1].address);
      // In total the amount staked in the contract is 158075 + 8075 = 166150
      const workTokenBalance = await balanceOf(workToken, accounts[1].address);
      // mine some more because they are a lot longer locked now with the lockfunctions, how long this in the future we have to mine depends on the locktime, this is tested in the distribution functions
      await mineDays(600, network);
      const staked = await nft.getStaked(nftId2);
      console.log("staked", staked.toString());
      await nft.connect(accounts[1]).destroyNft(nftId2);
      await expectToRevert(nft.ownerOf(nftId2), "ERC721: invalid token ID");
      expect(await nft.getStaked(nftId2)).to.equal(big(0));
      // what is left in the contract is: 166150-8075= 158075
      expect(await balanceOf(workToken, nft.address)).to.equal(amount(158075));
      expect(await balanceOf(workToken, accounts[1].address)).to.equal(workTokenBalance.add(amount(8075)));
    });

    // test if the nft is destroyed. and make sure you that calling destroy again will revert.
    it("Make sure you cannot destroy it again", async () => {
      await expectToRevert(nft.connect(accounts[1]).destroyNft(nftId2), "ERC721: invalid token ID");
    });

    // make sure that after destroying you cannot call unstake anymore.
    it("Make sure you cannot unstake anymore after destroying", async () => {
      await expectToRevert(nft.connect(accounts[1]).unstake(nftId2, 0), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(accounts[1]).unstake(nftId2, 1), "ERC721: invalid token ID");
      await expectToRevert(nft.connect(accounts[1]).unstake(nftId2, amount(250)), "ERC721: invalid token ID");
    });
  });

  describe("Staking allowance", async () => {
    let ownerNft4: SignerWithAddress;
    let nftId4: number;
    before(async () => {
      ownerNft4 = accounts[4];
      const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await distribution.startDistribution(timestamp);
      ({ nftId: nftId4 } = await mintNft(network, nft, workToken, ownerNft4, 0, 0, chainId));
    });

    it("Try staking more than approved on the first day", async () => {
      await expectToRevert(
        nft.connect(ownerNft4).stake(nftId4, amount(300)),
        "GenesisNft: The amount you want to stake is more than the total allowance",
      );
    });

    it("Be able to stake full amount on the first day, but not more, then stake again the second day", async () => {
      await nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE));
      await expectToRevert(
        nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE)),
        "GenesisNft: The amount you want to stake is more than the total allowance",
      );
      await mineDays(1, network);
      await nft.connect(ownerNft4).stake(nftId4, amount(DAILY_STAKING_ALLOWANCE));
    });

    it("Wait 15 days and be able to stake i.e. 10 days of daily allowance and have 5 left", async () => {
      // 15 days
      await mineDays(15, network);
      expect(await nft.getStakingAllowance(nftId4)).to.equal(amount(15 * DAILY_STAKING_ALLOWANCE));
      await nft.connect(ownerNft4).stake(nftId4, amount(10 * DAILY_STAKING_ALLOWANCE));
      expect(await nft.getStakingAllowance(nftId4)).to.equal(amount(5 * DAILY_STAKING_ALLOWANCE));
      expect(await nft.getLevel(nftId4)).to.equal(big(6));
    });

    it("Now lvl 6, wait 5 days and the allowance has accumulated", async () => {
      await mineDays(5, network);
      expect(await nft.getStakingAllowance(nftId4)).to.equal(amount(10 * DAILY_STAKING_ALLOWANCE));
      await nft.connect(ownerNft4).stake(nftId4, amount(10 * DAILY_STAKING_ALLOWANCE));
      expect(await nft.getStakingAllowance(nftId4)).to.equal(big(0));
    });
  });

  describe("Unstake when the NFT is at max level", async () => {
    let ownerNft5: SignerWithAddress;
    let nftId5: number;
    before(async () => {
      ownerNft5 = accounts[5];
      const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await distribution.startDistribution(timestamp);
      const lockPeriod = monthsToSeconds(nftLockTimeByStake(251, seed251Inv));
      ({ nftId: nftId5 } = await mintNft(network, nft, workToken, ownerNft5, 251, lockPeriod, chainId));
      await mineDays(1000, network);
    });

    // 1. failing to unstake when you are not max level
    it("Fail to unstake when the NFT is not max level", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(DAILY_STAKING_ALLOWANCE));
      // failing to unstake at lvl zero.
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(DAILY_STAKING_ALLOWANCE)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
      // stake more and become lvl 2.
      await nft.connect(ownerNft5).stake(nftId5, amount(511));
      // currently staked 250+294+512 = 1056
      // will fail to unstake at level 2.
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(DAILY_STAKING_ALLOWANCE)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });
    // 2. failing to unstake exact maximum amount + 1 when you are max level.
    it("Fail to unstake exact maximum amount + 1 when the NFT is max level", async () => {
      // we will stake extra to become lvl 10 with 5580 staked tokens
      await nft.connect(ownerNft5).stake(nftId5, amount(5024));
      expect(await nft.getStaked(nftId5)).to.equal(amount(6080));
      // With 6080 tokens you are still lvl 10, so 6369 - 5580 = 789 tokens are allowed to unstake.
      // Fail to unstake 790 tokens.
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(501)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Unstake maximum possible amount, which retains the max level", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(10);
      expect(await nft.getStaked(nftId5)).to.equal(amount(6080));
      await nft.connect(ownerNft5).unstake(nftId5, amount(500));
      expect(await nft.getLevel(nftId5)).to.eq(10);
      expect(await nft.getStaked(nftId5)).to.equal(amount(5580));
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, 1),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    // 4. upgrade Tier, go from level 10, to lvl zero.
    it("upgrade Tier, go from level 10, tier 0 to lvl 10 tier 1", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(10);
      expect(await nft.getTier(nftId5)).to.eq(0);
      await network.provider.send("evm_increaseTime", [1 * 86400]);
      await network.provider.send("evm_mine");
      await nft.connect(ownerNft5).stake(nftId5, amount(162));
      //staked 5742
      await nft.connect(ownerNft5).unstake(nftId5, amount(25));
      //staked 5717
      await nft.connect(ownerNft5).evolveTier(nftId5);
      expect(await nft.getLevel(nftId5)).to.eq(10);
      expect(await nft.getTier(nftId5)).to.eq(1);
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(10)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    // 5. Stake more, upgrade tier, try the same tests 2 & 3 &  at lvl 20.
    it("Stake more, upgrade tier, failing to unstake exact maximum amount + 1 when you are lvl20", async () => {
      // 30 * 80 = 2400, staking this
      await nft.connect(ownerNft5).connect(ownerNft5).stake(nftId5, amount(6000));
      // Now we have staked 2400+2290 = 4690
      expect(await nft.getStaked(nftId5)).to.equal(amount(11717));
      // 30 * 87 = 2610, staking this
      await nft.connect(ownerNft5).stake(nftId5, amount(6510));
      // Now we have staked 2290+2400+2610= 7300
      expect(await nft.getStaked(nftId5)).to.equal(amount(18227));
      // Now we are lvl 20, we need to keep 5615 to stay lvl 20, so we can unstake 7300-5615=1685
      // So unstaking 1686 will fail.
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(4208)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Unstake exact maximum amount, so you still stay in max level20", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(20);
      expect(await nft.getStaked(nftId5)).to.equal(amount(18227));
      await nft.connect(ownerNft5).unstake(nftId5, amount(4207));
      expect(await nft.getLevel(nftId5)).to.eq(20);
      expect(await nft.getStaked(nftId5)).to.equal(amount(14020));
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, 1),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Upgrade tier, you still stay in max level20, but go the next tier", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(20);
      expect(await nft.getTier(nftId5)).to.eq(1);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      expect(await nft.getLevel(nftId5)).to.eq(20);
      expect(await nft.getTier(nftId5)).to.eq(2);
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(10)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Stake more, upgrade tier to 7, failing to unstake exact maximum amount + 1 when you are lvl80", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(125000));
      // increasing to the last tier
      expect(await nft.getTier(nftId5)).to.eq(2);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      expect(await nft.getTier(nftId5)).to.eq(7);
      expect(await nft.getLevel(nftId5)).to.eq(76);
      await nft.connect(ownerNft5).stake(nftId5, amount(14062));
      expect(await nft.getStaked(nftId5)).to.equal(amount(153082));
      // Now we have staked 14020 + 14062 + 125000 = 153082
      // Now we are lvl 80, we need to keep 152720 to stay lvl 80, so we can unstake 153082-152720=362
      // So unstaking 363 will fail.
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, amount(363)),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Unstake maximum surplus, so the NFT will stay max level 80", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(80);
      expect(await nft.getStaked(nftId5)).to.equal(amount(153082));
      await nft.connect(ownerNft5).unstake(nftId5, amount(362));
      expect(await nft.getLevel(nftId5)).to.eq(80);
      expect(await nft.getStaked(nftId5)).to.equal(amount(152720));
    });

    it("Upgrade the tier, while the NFT is max level 80", async () => {
      expect(await nft.getLevel(nftId5)).to.eq(80);
      expect(await nft.getTier(nftId5)).to.eq(7);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      expect(await nft.getLevel(nftId5)).to.eq(80);
      expect(await nft.getTier(nftId5)).to.eq(8);
      await expectToRevert(
        nft.connect(ownerNft5).unstake(nftId5, 10),
        "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier",
      );
    });

    it("Do not go to a higher level when staking more in the last tier + lvl 80", async () => {
      await nft.connect(ownerNft5).stake(nftId5, amount(50000));
      expect(await nft.getLevel(nftId5)).to.eq(80);
      expect(await nft.getTier(nftId5)).to.eq(8);
      await nft.connect(ownerNft5).evolveTier(nftId5);
      expect(await nft.getTier(nftId5)).to.eq(8);
    });
  });

  describe("Testing one time voucher use", async () => {
    let voucher: Voucher;
    let tokenIdsOwned: BigNumber[];
    let nftId6: number;
    let ownerNft6: SignerWithAddress;
    let ownerNft7: SignerWithAddress;

    before(async () => {
      ownerNft6 = accounts[6];
      ownerNft7 = accounts[7];
      voucher = await nftMintVoucherGenerateLocal(
        ownerNft6.address,
        0,
        0,
        ["Male", "Yellow", "Founder"],
        chainId,
        nft.address,
        0,
      );
    });

    it("Check that the account has not minted any NFT yet", async () => {
      expect(await nft.accountMinted(ownerNft6.address)).to.equal(0);
      tokenIdsOwned = await nft.getIdsFromWallet(ownerNft6.address);
      expect(tokenIdsOwned.length).to.equal(0);
    });

    it("Check that the voucher works and is set to used", async () => {
      const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await distribution.startDistribution(currentBlockTimestamp);
      nftId6 = (await nft.nftIdCounter()) + 1;
      await expect(
        await nft
          .connect(ownerNft6)
          .mintNft(
            ownerNft6.address,
            voucher.voucherId,
            0,
            amount(0),
            amount(0),
            voucher.lockPeriod,
            voucher.imageUri,
            ethers.utils.formatBytes32String(voucher.encodedAttributes),
            voucher.voucherSignature,
          ),
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.constants.AddressZero, ownerNft6.address, nftId6);
      expect(await nft.accountMinted(ownerNft6.address)).to.equal(1);
      const _nft = await nft.nft(nftId6);
      expect(_nft.voucherId).to.equal(voucher.voucherId);
    });

    it("Check that the voucher cannot be used again", async () => {
      await expectToRevert(
        nft
          .connect(ownerNft7)
          .mintNft(
            ownerNft6.address,
            voucher.voucherId,
            0,
            amount(0),
            amount(0),
            voucher.lockPeriod,
            voucher.imageUri,
            ethers.utils.formatBytes32String(voucher.encodedAttributes),
            voucher.voucherSignature,
          ),
        "GenesisNft: This account already minted an NFT",
      );
    });

    it("Check that the amount of nft owned increased by exactly 1", async () => {
      const tokenIdsOwnedAfter = await nft.getIdsFromWallet(nftMinter1.address);
      expect(tokenIdsOwnedAfter.length).to.equal(tokenIdsOwned.length + 1);
    });
  });

  describe("Shares", async () => {
    let nftMinter7: SignerWithAddress;
    let nftMinter8: SignerWithAddress;
    let nftMinter9: SignerWithAddress;

    before(async () => {
      nftMinter7 = accounts[7];
      nftMinter8 = accounts[8];
      nftMinter9 = accounts[9];
      await regenerateNft();
    });

    it("Set up NFT 1", async () => {
      await mintNft(network, nft, workToken, nftMinter7, 0, 0, chainId);
    });

    it("Pre-condition check, the current month is 0, the token id shares and total shares are equal, to the shares of tokenId 1", async () => {
      expect(await nft.getCurrentMonth()).to.be.equal(0);
      // 1 for level 0 & 5 for base stake
      expect(await nft.getShares(1)).to.be.equal(51);
      expect((await nft.getTotals(0))._totalShares).to.be.equal(51);
    });

    it("10 days later, tokenId 2 is minted and received by the nftMinter8", async () => {
      await mineDays(10, network);
      await mintNft(network, nft, workToken, nftMinter8, 0, 0, chainId);
    });

    it("The updateShares is updated correctly, the current month is 0, the shares of id 1 and 2 are equal and total shares are equal to the shares of 1 + 2", async () => {
      expect(await nft.getCurrentMonth()).to.be.equal(0);
      // 1 for level 0 & 5 for base stake
      expect(await nft.getShares(1)).to.be.equal(big(51));
      expect((await nft.getTotals(0))._totalShares).to.be.equal(big(51 + 51));
    });

    it("1 month later, the current month is 1, the shares of id 1 is 6, now we will stake 10k tokens, and update the shares to 18", async () => {
      await mineDays(30, network);
      expect(await nft.getCurrentMonth()).to.be.equal(1);
      expect(await nft.getShares(1)).to.be.equal(big(51));
      await approveToken(network, workToken, nftMinter7, nft.address);
      await mineDays(30, network);
      await nft.connect(nftMinter7).stake(1, amount(10000));
      // 5 from base and 13 from level 10, (not higher because we did not evolve tier)
      expect(await nft.getShares(1)).to.be.equal(big(63));
    });

    it("The total shares at month 2 is now 102", async () => {
      expect((await nft.getTotals(1))._totalShares).to.be.equal(big(102));
    });

    it("The total shares at month 3 is now 114", async () => {
      expect((await nft.getTotals(2))._totalShares).to.be.equal(big(114));
    });

    it("NFT 2 will become level 10, like NFT 1 and then NFT 2 will be destroyed", async () => {
      await approveToken(network, workToken, nftMinter8, nft.address);
      await mineDays(40, network);
      await nft.connect(nftMinter8).stake(2, amount(10000));
      expect((await nft.getTotals(3))._totalShares).to.be.equal(big(126));

      await approveGenesisNft(network, nft, 2, nftMinter8, nft.address);
      await nft.connect(nftMinter8).destroyNft(2);
      expect((await nft.getTotals(3))._totalShares).to.be.equal(big(63));
      expect(await nft.getShares(1)).to.be.equal(big(63));
      expect(await nft.getShares(2)).to.be.equal(big(0));
    });

    it("Two months later, the current month is 5 and nft 3 will be minted with 0 tokens making the total tokens 114", async () => {
      await mineDays(60, network);
      await mintNft(network, nft, workToken, nftMinter9, 0, 0, chainId);
      expect(await nft.getCurrentMonth()).to.be.equal(5);
      expect((await nft.getTotals(5))._totalShares).to.be.equal(big(114));
    });

    it("two months later, the current month is 7 and nft 1 will be destroyed, the total shares will be 21", async () => {
      await mineDays(60, network);
      await approveGenesisNft(network, nft, 1, nftMinter7, nft.address);
      await nft.connect(nftMinter7).destroyNft(1);
      expect(await nft.getCurrentMonth()).to.be.equal(7);
      expect((await nft.getTotals(7))._totalShares).to.be.equal(big(51));
    });
  });

  //test if the looping back works till zero and is then broken.
  describe("Update Shares, no mint in the first month and then mint", async () => {
    before(async () => {
      await regenerateWorkToken();
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 6;
      await regenerateTokenDistribution(startTime);
      await regenerateNft();
    });

    describe("Minting after two months", async () => {
      it("Setup 1 NFT after two months", async () => {
        await mineDays(60, network);
        await mintNft(network, nft, workToken, nftMinter1, 0, 0, chainId);
      });

      it("The updateShares is updated correctly, the current month is 2, the shares of id 1 51", async () => {
        expect(await nft.getCurrentMonth()).to.be.equal(2);
        // 1 for level 0 + 5 for base stake for investing 1k
        expect(await nft.getShares(1)).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(0))._totalShares).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(1))._totalShares).to.be.equal(ethers.BigNumber.from(51));
        expect((await nft.getTotals(2))._totalShares).to.be.equal(ethers.BigNumber.from(51));
      });
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
    await workToken.mint(accounts[0].address, amount(250000));
    await workToken.mint(accounts[1].address, amount(250000));
    await workToken.mint(accounts[2].address, amount(250000));
    await workToken.mint(accounts[3].address, amount(250000));
    await workToken.mint(accounts[4].address, amount(250000));
    await workToken.mint(accounts[5].address, amount(250000));
    await workToken.mint(accounts[6].address, amount(250000));
    await workToken.mint(accounts[7].address, amount(250000));
    await workToken.mint(accounts[8].address, amount(250000));
    await workToken.mint(accounts[9].address, amount(250000));

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

  /*****************************************************************************
   * The following tests are commented out because they test private functions *

  describe("Private Functions: Update monthly staking balances for a tokenId", async () => {
    before(async () => {
      tokenId = await mintNft(network, nft, workToken, nftMinter1, 1000, chainId);
      const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await tokenDistribution.startDistribution(timestamp);
    });

    it("Increase in month 0, minimum stays initial staking amount and current staked adds amount", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, true, amount(1000), 0);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 0)).to.be.equal(amount(2000));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 0)).to.be.equal(amount(1000));
    });

    it("Decrease in month 0, minimum stays initial staking amount and current staked decreases amount", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(500), 0);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 0)).to.be.equal(amount(1500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 0)).to.be.equal(amount(1000));
    });

    it("In month 1, start with an increase, minimum should be the last value from month 0, and tokens should increase", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, true, amount(1000), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(2500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 1)).to.be.equal(amount(1500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 1)).to.be.equal(
        await nft.getTokenIdToTokensAtMonth(tokenId, 0),
      );
    });

    it("in month 1, perform a lot of differen increase and decreases and check if the tokens and minimum is correct", async () => {
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(2500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 1)).to.be.equal(amount(1500));
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, true, amount(1000), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(3500));
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(750), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(2750));
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(750), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(2000));
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, true, amount(2000), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(4000));
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(3000), 1);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 1)).to.be.equal(amount(1000));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 1)).to.be.equal(amount(1000));
    });

    it("In month 2, Start with a decrease and the amount and both minimum and balances should both be the same new lower amount", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(500), 2);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 2)).to.be.equal(amount(500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 2)).to.be.equal(amount(500));
    });

    it("In month 2, increase after initial decrease, the balance should increase and the minimum should stay the same", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, true, amount(1000), 2);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 2)).to.be.equal(amount(1500));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 2)).to.be.equal(amount(500));
    });

    it("Skip two months and in month 4, we start with a decrease of 500 to see if it works with skipped months", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(500), 4);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 4)).to.be.equal(amount(1000));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 4)).to.be.equal(amount(1000));
    });

    it("in month 4, try to decrease more than the current balance, it should revert", async () => {
      await expect(
        nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(2000), 4),
      ).to.be.revertedWith("You are trying to unstake more than the total staked in this nft!");
    });

    it("decrease the full balance, will happen with destroy method, and end up with 0", async () => {
      await nft.connect(nftMinter1)._updateMonthlyStakingBalancesForATokenId(tokenId, false, amount(1000), 4);
      expect(await nft.getTokenIdToTokensAtMonth(tokenId, 4)).to.be.equal(amount(0));
      expect(await nft.getTokenIdToMinimumTokensAtMonth(tokenId, 4)).to.be.equal(amount(0));
    });
  });
   *****************************************************************************/
});
