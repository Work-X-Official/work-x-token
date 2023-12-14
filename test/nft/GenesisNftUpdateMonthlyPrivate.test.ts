import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { WorkToken, GenesisNft, ERC20, TokenDistribution } from "../../typings";
import { amount, getImpersonateAccounts } from "../util/helpers.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { Stake, mintNft, regenerateNft } from "../util/nft.util";
import { regenerateWorkToken, sendTokens } from "../util/worktoken.util";
import { regenerateTokenDistribution } from "../util/distribution.util";

config();

chai.use(solidity);

/*
 * THESE TESTS REQUIRE GenesisNft._updateMonthly TO BE PUBLIC (for test purposes only)
 * The tests are commented out to avoid typing errors, you can move the bottom comment bar up to enable the tests after making _updateMonthly public
 */

describe("GenesisNftUpdateMonthlyPrivate", () => {
  let nft: GenesisNft;
  let signerImpersonated: SignerWithAddress;
  let stablecoin: ERC20;
  let stablecoinDecimals: number;
  let accounts: SignerWithAddress[];
  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;
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
    nftMinter2 = accounts[4];
    if (!process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER) throw new Error("NFT_MESSAGE_SIGNER_PRIVATE_KEY not set");
    nftVoucherSigner = new ethers.Wallet(process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string).connect(ethers.provider);

    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    workToken = await regenerateWorkToken(accounts, accounts[0].address);
    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 7;
    distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
    nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
  });

  /*****************************************************************************
   * The following tests are commented out because they test _updateMonthly    *
   * If you want to use them uncomment them and make _updateMonthly public     *


  describe("Private Functions: Update monthly staking balances for a tokenId", async () => {
    let nftMinter1: SignerWithAddress;
    let nftId1: number;

    before(async () => {
      nftMinter1 = accounts[1];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 10;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [1000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [2000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 1000, 0, 0, chainId));
    });

    it("Increase in month 0, minimum nft stays initial staking amount and current staked adds amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 0);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(2000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("Decrease in month 0, minimum stays initial staking amount and current staked decreases amount", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 0);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(1500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("In month 1, start with an increase, minimum should be the last value from month 0, and tokens should increase", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      const nftInfoMonthPrev = await getNftInfoAtMonth(nftId1, 0);

      expect(nftInfoMonth.minimumStaked).to.be.equal(nftInfoMonthPrev.staked);
    });

    it("In month 1, perform a lot of differen increase and decreases and check if the staked and minimum is correct", async () => {
      let nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 1);

      nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(3500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2750));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(750), 1);
      nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(2000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(2000), 1);
      nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(4000));

      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(3000), 1);
      nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("In month 2, Start with a decrease and both minimum and staked should both be the same new lower value", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
    });

    it("In month 2, increase after initial decrease, the staked should increase and the minimum should stay the same", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(1000), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(1500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
    });
    it("Skip two months and in month 4, we start with a decrease of 500 to see if it works with skipped months", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 4);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
    });

    it("In month 4, try to decrease more than the current balance, it should revert", async () => {
      await expect(nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(2000), 4)).to.be.revertedWith(
        "UnstakeAmountNotAllowed",
      );
    });
    // cannot decrease full balance, because then getStaked will loop back till finding a month with a balance or hasWithdrawn is true.
    // With destroy this happens but by only calling the private function _updateMonthly hasWithdrawn is not set to true making the staked value return a wrong answer if unstaking everything.
    it("Decrease the full balance, and end up with 1", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(999), 4);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(1));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1));
    });
  });
  describe("Private Functions: Update monthly staking balances, total and minimum", async () => {
    let nftMinter1: SignerWithAddress;
    let nftId1: number;

    before(async () => {
      nftMinter1 = accounts[1];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 10;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter1.address], [1000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter2.address], [2000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 1000, 0, 0, chainId));
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
        "UnstakeAmountNotAllowed",
      );
    });
  });

  describe("More update monthly tests", async () => {
    let nftMinter1: SignerWithAddress;
    let nftMinter2: SignerWithAddress;
    let nftMinter3: SignerWithAddress;

    let nftId1: number;
    let nftId2: number;
    let nftId3: number;

    before(async () => {
      nftMinter1 = accounts[1];
      nftMinter2 = accounts[2];
      nftMinter3 = accounts[3];
      const startTime = (await ethers.provider.getBlock("latest")).timestamp + 10;
      distribution = await regenerateTokenDistribution(startTime, workToken, accounts[0]);
      await distribution.setWalletClaimable([nftMinter2.address], [1000], [0], [0], [0]);
      await distribution.setWalletClaimable([nftMinter3.address], [2000], [0], [0], [0]);
      nft = await regenerateNft(signerImpersonated, workToken, distribution, nftVoucherSigner.address);
      ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
      ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 1000, 0, 0, chainId));
      ({ nftId: nftId3 } = await mintNft(network, nft, workToken, nftMinter3, 2000, 0, 0, chainId));
    });
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

    it("In month 0, nft 1 will increase", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(100), 0);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(100));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3100));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });
    it("In month 0, nft 1 will decrease half", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(50), 0);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(50));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3050));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });
    it("In month 0, nft 1 will decrease 50 to 0", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(50), 0);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 0);
      expect(nftInfoMonth.staked).to.be.equal(amount(0));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(0);
      expect(totals._totalBalance).to.be.equal(amount(3000));
      expect(totals._minimumBalance).to.be.equal(amount(3000));
    });

    it("In month 1, nftMinter 2 unstakes 500", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(500), 1);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2500));
      expect(totals._minimumBalance).to.be.equal(amount(2500));
    });
    it("In month 1, nftMinter 3 unstakes 500", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(500), 1);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(1500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(2000));
      expect(totals._minimumBalance).to.be.equal(amount(2000));
    });
    it("In month 1, nftMinter 1 will add 5000", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(5000), 1);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 1);
      expect(nftInfoMonth.staked).to.be.equal(amount(5000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(0));
      const totals = await nft.getTotals(1);
      expect(totals._totalBalance).to.be.equal(amount(7000));
      expect(totals._minimumBalance).to.be.equal(amount(2000));
    });

    it("In month 2, nftMinter 1 will increase 2000", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(2000), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(7000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(5000));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(9000));
      expect(totals._minimumBalance).to.be.equal(amount(7000));
    });
    it("In month 2, nftMinter 1 will decrease 3000 which is more", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(3000), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(4000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4000));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(6000));
      expect(totals._minimumBalance).to.be.equal(amount(6000));
    });

    it("In month 2, nftMinter 2 will decrease 100", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(100), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(400));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(400));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(5900));
      expect(totals._minimumBalance).to.be.equal(amount(5900));
    });
    it("In month 2, nftMinter 3 will increase 3000", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, true, amount(3000), 2);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 2);
      expect(nftInfoMonth.staked).to.be.equal(amount(4500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1500));
      const totals = await nft.getTotals(2);
      expect(totals._totalBalance).to.be.equal(amount(8900));
      expect(totals._minimumBalance).to.be.equal(amount(5900));
    });
    it("In month 3, nftMinter1 will decrease 3000", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(3000), 3);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(1000));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(5900));
      expect(totals._minimumBalance).to.be.equal(amount(5900));
    });
    it("In month 3, nftMinter2 will increase 4000", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, true, amount(4000), 3);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 3);
      expect(nftInfoMonth.staked).to.be.equal(amount(4400));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(400));
      const totals = await nft.getTotals(3);
      expect(totals._totalBalance).to.be.equal(amount(9900));
      expect(totals._minimumBalance).to.be.equal(amount(5900));
    });
    it("In month 4, nftMinter3 will decrease 1000", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(1000), 4);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(3500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3500));
      const totals = await nft.getTotals(4);
      expect(totals._totalBalance).to.be.equal(amount(8900));
      expect(totals._minimumBalance).to.be.equal(amount(8900));
    });
    it("In month 4, nftMinter3 will increase 500", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, true, amount(500), 4);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 4);
      expect(nftInfoMonth.staked).to.be.equal(amount(4000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3500));
      const totals = await nft.getTotals(4);
      expect(totals._totalBalance).to.be.equal(amount(9400));
      expect(totals._minimumBalance).to.be.equal(amount(8900));
    });
    it("In month 5, nftMinter2 will decrease 500", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(500), 5);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(3900));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3900));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(8900));
      expect(totals._minimumBalance).to.be.equal(amount(8900));
    });
    it("In month 5, nftMinter2 will increase 1000", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, true, amount(1000), 5);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(4900));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3900));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(9900));
      expect(totals._minimumBalance).to.be.equal(amount(8900));
    });

    it("In month 5, nftMinter3 will decrease 500", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(500), 5);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 5);
      expect(nftInfoMonth.staked).to.be.equal(amount(3500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3500));
      const totals = await nft.getTotals(5);
      expect(totals._totalBalance).to.be.equal(amount(9400));
      expect(totals._minimumBalance).to.be.equal(amount(8400));
    });

    it("In month 6, nftMinter1 will decrease 900", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(900), 6);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 6);
      expect(nftInfoMonth.staked).to.be.equal(amount(100));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(100));
      const totals = await nft.getTotals(6);
      expect(totals._totalBalance).to.be.equal(amount(8500));
      expect(totals._minimumBalance).to.be.equal(amount(8500));
    });
    it("In month 7, nftMinter1 will increase 900", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, true, amount(900), 7);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 7);
      expect(nftInfoMonth.staked).to.be.equal(amount(1000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(100));
      const totals = await nft.getTotals(7);
      expect(totals._totalBalance).to.be.equal(amount(9400));
      expect(totals._minimumBalance).to.be.equal(amount(8500));
    });
    it("In month 7, nftMinter2 will increase 1000", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, true, amount(1100), 7);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 7);
      expect(nftInfoMonth.staked).to.be.equal(amount(6000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4900));
      const totals = await nft.getTotals(7);
      expect(totals._totalBalance).to.be.equal(amount(10500));
      expect(totals._minimumBalance).to.be.equal(amount(8500));
    });
    it("In month 7, nftMinter3 will increase 1500", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, true, amount(1500), 7);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 7);
      expect(nftInfoMonth.staked).to.be.equal(amount(5000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3500));
      const totals = await nft.getTotals(7);
      expect(totals._totalBalance).to.be.equal(amount(12000));
      expect(totals._minimumBalance).to.be.equal(amount(8500));
    });
    it("In month 8, nftMinter3 will decrease 900", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(900), 8);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 8);
      expect(nftInfoMonth.staked).to.be.equal(amount(4100));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4100));
      const totals = await nft.getTotals(8);
      expect(totals._totalBalance).to.be.equal(amount(11100));
      expect(totals._minimumBalance).to.be.equal(amount(11100));
    });
    it("In month 8, nftMinter2 will decrease 1000", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(1000), 8);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 8);
      expect(nftInfoMonth.staked).to.be.equal(amount(5000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(5000));
      const totals = await nft.getTotals(8);
      expect(totals._totalBalance).to.be.equal(amount(10100));
      expect(totals._minimumBalance).to.be.equal(amount(10100));
    });
    it("In month 8, nftMinter1 unstake 1500 should revert because only has 1000", async () => {
      await expect(nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(1500), 8)).to.be.revertedWith(
        "UnableToUnstakeAmount",
      );
    });
    it("In month 8, nftMinter1 unstakes 500", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(500), 8);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 8);
      expect(nftInfoMonth.staked).to.be.equal(amount(500));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(500));
      const totals = await nft.getTotals(8);
      expect(totals._totalBalance).to.be.equal(amount(9600));
      expect(totals._minimumBalance).to.be.equal(amount(9600));
    });
    it("In month 9, nftMinter1 unstakes 100", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(100), 9);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 9);
      expect(nftInfoMonth.staked).to.be.equal(amount(400));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(400));
      const totals = await nft.getTotals(9);
      expect(totals._totalBalance).to.be.equal(amount(9500));
      expect(totals._minimumBalance).to.be.equal(amount(9500));
    });
    it("In month 9, nftMinter2 unstakes 100", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(100), 9);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 9);
      expect(nftInfoMonth.staked).to.be.equal(amount(4900));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4900));
      const totals = await nft.getTotals(9);
      expect(totals._totalBalance).to.be.equal(amount(9400));
      expect(totals._minimumBalance).to.be.equal(amount(9400));
    });
    it("In month 9, nftMinter3 unstakes 100", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(100), 9);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 9);
      expect(nftInfoMonth.staked).to.be.equal(amount(4000));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4000));
      const totals = await nft.getTotals(9);
      expect(totals._totalBalance).to.be.equal(amount(9300));
      expect(totals._minimumBalance).to.be.equal(amount(9300));
    });
    it("In month 38, nftMinter1 unstakes 100", async () => {
      await nft.connect(nftMinter1)._updateMonthly(nftId1, false, amount(100), 38);
      const nftInfoMonth = await getNftInfoAtMonth(nftId1, 38);
      expect(nftInfoMonth.staked).to.be.equal(amount(300));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(300));
      const totals = await nft.getTotals(38);
      expect(totals._totalBalance).to.be.equal(amount(9200));
      expect(totals._minimumBalance).to.be.equal(amount(9200));
    });
    it("In month 39, nftMinter2 unstakes 100", async () => {
      await nft.connect(nftMinter2)._updateMonthly(nftId2, false, amount(100), 38);
      const nftInfoMonth = await getNftInfoAtMonth(nftId2, 38);
      expect(nftInfoMonth.staked).to.be.equal(amount(4800));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(4800));
      const totals = await nft.getTotals(38);
      expect(totals._totalBalance).to.be.equal(amount(9100));
      expect(totals._minimumBalance).to.be.equal(amount(9100));
    });
    it("In month 40, nftMinter3 unstakes 100", async () => {
      await nft.connect(nftMinter3)._updateMonthly(nftId3, false, amount(100), 38);
      const nftInfoMonth = await getNftInfoAtMonth(nftId3, 38);
      expect(nftInfoMonth.staked).to.be.equal(amount(3900));
      expect(nftInfoMonth.minimumStaked).to.be.equal(amount(3900));
      const totals = await nft.getTotals(38);
      expect(totals._totalBalance).to.be.equal(amount(9000));
      expect(totals._minimumBalance).to.be.equal(amount(9000));
    });
  });

  const getNftInfoAtMonth = async (nftId: number, month: number): Promise<Stake> => {
    const ret = await nft.getStaked(nftId, month);
    return {
      staked: ret[0],
      minimumStaked: ret[1],
    };
    };
     *****************************************************************************/
});
