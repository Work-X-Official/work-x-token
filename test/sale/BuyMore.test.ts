import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { config } from "dotenv";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { CONSTANTS } from "../constants";
import { expectToRevert } from "../util/helpers.util";
import { BuyMore } from "../../typings";
import { solidity } from "ethereum-waffle";
import { approveToken, sendToken } from "../util/worktoken.util";

config();

chai.use(solidity);

describe("BuyMore", function () {
  let buyMore: BuyMore;

  let accounts: SignerWithAddress[];
  const targetDecimals: BigNumber = BigNumber.from(36);

  const regenerateBuyMore = async (
    wallet = "0xaaaaD8F4c7c14eC33E5a7ec605D4608b5bB410fD",
    tokenNames = ["BUSD"],
    tokenAddresses = [CONSTANTS.BUSD],
  ) => {
    const factory = await ethers.getContractFactory("BuyMore");

    buyMore = (await factory.deploy(wallet, tokenNames, tokenAddresses)) as BuyMore;
    await buyMore.deployed();
  };

  const deNormalizeAmount = (
    amount: BigNumber,
    sourceDecimals: BigNumber = BigNumber.from(CONSTANTS.BUSD_DECIMALS),
  ): BigNumber => {
    return amount.div(BigNumber.from(10).pow(targetDecimals.sub(sourceDecimals)));
  };

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

    await regenerateBuyMore();
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

    it("invest 3 time and returned total balance is correct", async () => {
      await regenerateBuyMore();
      const token = await ethers.getContractAt("ERC20", CONSTANTS.BUSD);
      await approveToken(network, token, accounts[1], buyMore.address);

      await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("1", CONSTANTS.BUSD_DECIMALS));
      await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("2", CONSTANTS.BUSD_DECIMALS));
      await buyMore.connect(accounts[1]).buyMore("BUSD", ethers.utils.parseUnits("3", CONSTANTS.BUSD_DECIMALS));

      const total = await buyMore.connect(accounts[1]).getTotalAllocation(accounts[1].address);

      expect(deNormalizeAmount(total)).to.be.equal(ethers.utils.parseUnits("6", CONSTANTS.BUSD_DECIMALS));
    });
  });
});
