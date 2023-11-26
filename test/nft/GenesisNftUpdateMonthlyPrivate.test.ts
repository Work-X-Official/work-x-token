import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, GenesisNftData, ERC20, TokenDistribution, GenesisNftAttributes } from "../../typings";
import { getImpersonateAccounts } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { amount } from "../util/helpers.util";
import { mintNft } from "../util/nft.util";
import { sendTokens } from "../util/worktoken.util";

config();

chai.use(solidity);

/*
 * THESE TESTS REQUIRE GenesisNft._updateMonthly TO BE PUBLIC (for test purposes only)
 * The tests are commented out to avoid typing errors, you can move the bottom comment bar up to enable the tests after making _updateMonthly public
 */

describe.skip("GenesisNftUpdateMonthlyPrivate", () => {
  let nft: GenesisNft;
  let nftData: GenesisNftData;
  let nftAttributes: GenesisNftAttributes;
  let signerImpersonated: SignerWithAddress;
  let stablecoin: ERC20;
  let stablecoinDecimals: number;
  let accounts: SignerWithAddress[];
  let nftMinter1: SignerWithAddress;
  let nftVoucherSigner: Wallet;
  let distribution: TokenDistribution;
  let workToken: WorkToken;
  let chainId: number;

  before(async () => {
    const acc = await getImpersonateAccounts(network);
    chainId = (await ethers.provider.getNetwork()).chainId;
    signerImpersonated = await ethers.getSigner(acc.signerImpersonatedAddress);
    stablecoin = await ethers.getContractAt("ERC20", acc.stablecoinAddress);
    stablecoinDecimals = await stablecoin.decimals();
    accounts = await ethers.getSigners();

    nftMinter1 = accounts[3];
    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    await regenerateWorkToken();
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 6;
    await regenerateTokenDistribution(startTime);
    await regenerateNft();
    await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId);
  });

  const regenerateNft = async (): Promise<GenesisNft> => {
    nftAttributes = await (await ethers.getContractFactory("GenesisNftAttributes", signerImpersonated)).deploy();
    nftData = await (
      await ethers.getContractFactory("GenesisNftData", signerImpersonated)
    ).deploy(nftAttributes.address);
    nft = await (
      await ethers.getContractFactory("GenesisNft", signerImpersonated)
    ).deploy(
      "Work X Genesis NFT",
      "Work X Genesis NFT",
      workToken.address,
      distribution.address,
      nftData.address,
      nftVoucherSigner.address,
    );
    await nft.deployed();
    await workToken.grantRole(await workToken.MINTER_ROLE(), nft.address);
    return nft;
  };

  const regenerateWorkToken = async (minter = accounts[0].address): Promise<boolean> => {
    workToken = await (await ethers.getContractFactory("WorkToken")).deploy();
    await workToken.grantRole(await workToken.MINTER_ROLE(), minter);
    for (let i = 0; i < 10; i++) {
      await workToken.mint(accounts[i].address, amount(250000));
    }
    await workToken.mint(accounts[3].address, amount(2000000));
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
    await distribution.grantRole(await distribution.NFT_ROLE(), nft.address);
  };

  /*****************************************************************************
   * The following tests are commented out because they test _updateMonthly    *
   * If you want to use them uncomment them and make _updateMonthly public     *


  describe("Private Functions: Update monthly staking balances for a tokenId", async () => {
    let nftMinter1: SignerWithAddress;

    let nftId1: number;

    before(async () => {
      nftMinter1 = accounts[1];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 9;
      await regenerateTokenDistribution(startTime);
      await regenerateNft();
      await mintNft(network, nft, workToken, nftMinter1, 1000, 0, 0, chainId);
    });

    it("Increase in month 0, minimum nft stays initial staking amount and current staked adds amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 0);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(2000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("Decrease in month 0, minimum stays initial staking amount and current staked decreases amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 0);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(1500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("In month 1, start with an increase, minimum should be the last value from month 0, and tokens should increase", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      const nftInfoMonthPrev = await nft.getNftInfoAtMonth(nftId1, 0);

      expect(nftInfoMonth.minimumStaked).to.be.equal(nftInfoMonthPrev.staked);
    });

    it("in month 1, perform a lot of differen increase and decreases and check if the staked and minimum is correct", async () => {
      let nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);

      nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(3500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2750));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(2000), 1);
      nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(4000));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(3000), 1);
      nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("In month 2, Start with a decrease and both minimum and staked should both be the same new lower value", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 2);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
    });

    it("In month 2, increase after initial decrease, the staked should increase and the minimum should stay the same", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 2);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(1500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
    });
    // test for extra two things that go wrong.
    it("Skip two months and in month 4, we start with a decrease of 500 to see if it works with skipped months", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 4);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("in month 4, try to decrease more than the current balance, it should revert", async () => {
      await expect(nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(2000), 4)).to.be.revertedWith(
        "GenesisNft: You are trying to unstake more than the total staked in this nft!",
      );
    });

    it("decrease the full balance, will happen with destroy method, and end up with 0", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(1000), 4);
      const nftInfoMonth = await nft.getNftInfoAtMonth(nftId1, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(0));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
    });
  });

  describe("Private Functions: Update monthly staking balances, total and minimum", async () => {
    let nftMinter1: SignerWithAddress;
    let nftId1: number;

    before(async () => {
      nftMinter1 = accounts[1];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 9;
      await regenerateTokenDistribution(startTime);
      await regenerateNft();
      await mintNft(network, nft, workToken, nftMinter1, 1000, 0, 0, chainId);
    });

    it("Totals, Increase in month 0, minimum stays initial staking amount and current staked adds amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 0);
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(2000));
      expect(totals._minimumBalance).to.be.equal(amount(1000));
    });

    it("Totals, Decrease in month 0, minimum stays initial staking amount and current staked decreases amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 0);
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(1500));
      expect(totals._minimumBalance).to.be.equal(amount(1000));
    });

    it("Totals, In month 1, start with an increase, minimum should be the last value from month 0, and tokens should increase", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2500));
      expect(totals._minimumBalance).to.be.equal(amount(1500));

      const totalsPrev = await nft.getTotals(0);
      expect(totals._minimumBalance).to.be.equal(totalsPrev._totalBalance);
    });

    it("Totals, In month 1, perform a lot of differen increase and decreases and check if the staked and minimum is correct", async () => {
      let totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2500));
      expect(totals._minimumBalance).to.be.equal(amount(1500));
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);

      totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(3500));
      expect(totals._minimumBalance).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2750));
      expect(totals._minimumBalance).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2000));
      expect(totals._minimumBalance).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(2000), 1);
      totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(4000));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(3000), 1);
      totals = await nft.getTotals(1);
      expect(totals._minimumBalance).to.be.equal(amount(1000));
    });

    it("Totals, In month 2, Start with a decrease and both minimum and staked should both be the same new lower value", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 2);
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(500));
      expect(totals._minimumBalance).to.be.equal(amount(500));
    });

    it("Totals, In month 2, increase after initial decrease, the staked should increase and the minimum should stay the same", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 2);
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(1500));
      expect(totals._minimumBalance).to.be.equal(amount(500));
    });

    it("Totals, Skip two months and in month 4, we start with a decrease of 500 to see if it works with skipped months", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 4);
      const totals = await nft.getTotals(4);
      expect(totals._totalBalance).to.be.equal(amount(1000));
      expect(totals._minimumBalance).to.be.equal(amount(1000));
    });

    it("Totals, In month 4, try to decrease more than the current balance, it should revert", async () => {
      await expect(nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(2000), 4)).to.be.revertedWith(
        "GenesisNft: You are trying to unstake more than the total staked in this nft!",
      );
    });
  });
     *****************************************************************************/
});
