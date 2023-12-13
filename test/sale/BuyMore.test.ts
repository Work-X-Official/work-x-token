import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { config } from "dotenv";
import { ethers, network } from "hardhat";
import { CONSTANTS } from "../constants";
import { amount, expectToRevert } from "../util/helpers.util";
import { BuyMore } from "../../typings";
import { solidity } from "ethereum-waffle";
import { approveToken, sendToken } from "../util/worktoken.util";
import { deNormalizeAmount, regenerateBuyMore } from "../util/sale.util";

config();

chai.use(solidity);

describe.skip("BuyMore", function () {
  let buyMore: BuyMore;

  let accounts: SignerWithAddress[];

  before(async function () {
    this.timeout(60 * 1000);
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://bsc-dataseed.binance.org/ ",
          },
        },
      ],
    });

    accounts = await ethers.getSigners();

    const impersonatingAccount = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [impersonatingAccount],
    });
    const token = await ethers.getContractAt("ERC20", CONSTANTS.BUSD);
    const signerImpersonate = await ethers.getSigner(impersonatingAccount);
    for (let i = 0; i < 7; i++) {
      await sendToken(network, signerImpersonate, accounts[i].address, ethers.utils.parseEther("800000"), token);
    }

    buyMore = await regenerateBuyMore();
  });

  it("revert if trying to deploy with invalid accepted tokens format", async () => {
    const wallet = accounts[1].address;
    const tokenNames = ["BUSD", "FBUSD"];
    const tokenAddresses = [CONSTANTS.BUSD];
    await expectToRevert(
      regenerateBuyMore(wallet, tokenNames, tokenAddresses),
      "BuyMore: Invalid accepted tokens length",
    );
  });

  describe("Balance", () => {
    before(async () => {
      await regenerateBuyMore();
    });

    it("invest 3 times and the returned total balance is correct", async () => {
      await regenerateBuyMore();
      const token = await ethers.getContractAt("ERC20", CONSTANTS.BUSD);
      await approveToken(network, token, accounts[1], buyMore.address);

      await expect(
        await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("1", CONSTANTS.BUSD_DECIMALS)),
      )
        .to.emit(buyMore, "BoughtMore")
        .withArgs(accounts[1].address, amount(1));
      await expect(
        await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("2", CONSTANTS.BUSD_DECIMALS)),
      )
        .to.emit(buyMore, "BoughtMore")
        .withArgs(accounts[1].address, amount(2));
      await expect(
        await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("3", CONSTANTS.BUSD_DECIMALS)),
      )
        .to.emit(buyMore, "BoughtMore")
        .withArgs(accounts[1].address, amount(3));

      const total = await buyMore.connect(accounts[1]).getTotalAllocation(accounts[1].address);

      expect(deNormalizeAmount(total)).to.be.equal(ethers.utils.parseUnits("6", CONSTANTS.BUSD_DECIMALS));
    });
  });
});
