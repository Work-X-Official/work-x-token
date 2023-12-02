import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers, network } from "hardhat";
import { ERC20, Sale } from "../../typings";
import { big, expectToRevert, generateCodeSignature, getImpersonateAccounts } from "../util/helpers.util";
import { approveToken, balanceOf, sendTokens } from "../util/worktoken.util";

describe("Sale", function () {
  let signerImpersonated: SignerWithAddress;
  let stablecoin: ERC20;
  let stablecoinName: string;
  let stablecoinDecimals: number;
  let sale: Sale;
  let accounts: SignerWithAddress[];
  let roundLimits: BigNumber[];
  let poolLimit: BigNumber;
  let investAmount: BigNumber;

  const targetDecimals = big(36);

  before(async function () {
    const acc = await getImpersonateAccounts(network);
    signerImpersonated = await ethers.getSigner(acc.signerImpersonatedAddress);
    stablecoin = await ethers.getContractAt("ERC20", acc.stablecoinAddress);
    stablecoinDecimals = await stablecoin.decimals();
    stablecoinName = await stablecoin.name();
    accounts = await ethers.getSigners();
    investAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
    await sendTokens(network, signerImpersonated, accounts, stablecoinDecimals, stablecoin);
    await deploySale();
    poolLimit = await sale.MAXIMUM_POOL_ALLOWANCE();
    roundLimits = await Promise.all([
      sale.rounds(0).then(r => r.maximum),
      sale.rounds(1).then(r => r.maximum),
      sale.rounds(2).then(r => r.maximum),
    ]);
  });

  it("revert if trying to deploy with invalid accepted tokens format", async () => {
    await expectToRevert(
      regenerateSale(accounts[0].address, accounts[1].address, ["1", "2"], [stablecoin.address]),
      "Sale: Invalid accepted tokens length",
    );
  });

  describe("Rounds", () => {
    it("revert if trying to enable an invalid round", async () => {
      await expectToRevert(sale.enableRound(4, true), "Sale: Invalid round");
    });

    it("enable the round only for the owner", async () => {
      await expectToRevert(sale.connect(accounts[1]).enableRound(1, true), "Ownable: caller is not the owner");
      expect((await sale.rounds(1)).active).to.be.false;
      await sale.enableRound(1, true);
      expect((await sale.rounds(1)).active).to.be.true;
    });

    it("revert if trying to enable/disable a round that already has this state", async () => {
      await expectToRevert(sale.enableRound(1, true), "Sale: Round already has this state");
      await expectToRevert(sale.enableRound(2, false), "Sale: Round already has this state");
    });

    it("disable the round only for the owner", async () => {
      await expectToRevert(sale.connect(accounts[1]).enableRound(1, false), "Ownable: caller is not the owner");
      expect((await sale.rounds(1)).active).to.be.true;
      await sale.enableRound(1, false);
      expect((await sale.rounds(1)).active).to.be.false;
    });

    it("revert if trying to invest in invalid round", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[0], sale.address);
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0),
        "Sale: Round is not active",
      );
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 1),
        "Sale: Round is not active",
      );
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 2),
        "Sale: Round is not active",
      );
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 3),
        "Sale: Round is not active",
      );
      await Promise.all([
        sale.enableRound(0, true),
        sale.enableRound(1, true),
        sale.enableRound(2, true),
        approveToken(network, stablecoin, accounts[0], sale.address),
      ]);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 1);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 2);
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 3),
        "Sale: Round is not active",
      );
    });

    it("revert if trying to invest 0", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await expectToRevert(
        sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, 0, 0),
        "Sale: You can't invest 0 tokens",
      );
    });

    it("revert if not using round numbers", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await expectToRevert(
        sale.connect(accounts[2]).investWithCode(code, signature, stablecoinName, 1, 0),
        "Sale: Only round numbers are accepted",
      );
    });

    it("rebalance rounds only if called by the owner", async () => {
      await regenerateSale();
      const newLimit = utils.parseUnits("1", 36);
      await expectToRevert(
        sale.connect(accounts[1]).rebalanceRoundLimit(0, newLimit),
        "Ownable: caller is not the owner",
      );

      await sale.rebalanceRoundLimit(0, newLimit);
      await sale.rebalanceRoundLimit(1, newLimit);
      await sale.rebalanceRoundLimit(2, newLimit);

      expect((await sale.rounds(0)).maximum.toHexString()).to.eq(newLimit.toHexString());
      expect((await sale.rounds(1)).maximum.toHexString()).to.eq(newLimit.toHexString());
      expect((await sale.rounds(2)).maximum.toHexString()).to.eq(newLimit.toHexString());
    });

    it("revert if trying to rebalance an invalid round", async () => {
      await regenerateSale();
      await expectToRevert(sale.rebalanceRoundLimit(5, investAmount), "Sale: Invalid round");
    });

    it("revert if trying to rebalance lower than the current invested amount", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[0], sale.address);

      await sale.enableRound(0, true);
      await sale.enableRound(1, true);
      await sale.enableRound(2, true);
      await sale.investWithCode(code, signature, stablecoinName, investAmount, 0);
      await sale.investWithCode(code, signature, stablecoinName, investAmount, 1);
      await sale.investWithCode(code, signature, stablecoinName, investAmount, 2);

      await expectToRevert(
        sale.rebalanceRoundLimit(0, investAmount.sub(0)),
        "Sale: The new maximum must be higher or equal than the total invested",
      );
      await expectToRevert(
        sale.rebalanceRoundLimit(0, investAmount.sub(1)),
        "Sale: The new maximum must be higher or equal than the total invested",
      );
      await expectToRevert(
        sale.rebalanceRoundLimit(0, investAmount.sub(2)),
        "Sale: The new maximum must be higher or equal than the total invested",
      );
    });

    it("revert if trying to rebalance over the maximum rebalance allowed", async () => {
      await regenerateSale();

      const roundLimit1 = roundLimits[0].mul(2);
      const roundLimit2 = roundLimits[1].mul(2);
      const roundLimit3 = roundLimits[2].mul(2);
      await sale.rebalanceRoundLimit(0, roundLimit1);
      await sale.rebalanceRoundLimit(1, roundLimit2);
      await sale.rebalanceRoundLimit(2, roundLimit3);

      await expectToRevert(
        sale.rebalanceRoundLimit(0, roundLimit1.add(1)),
        "Sale: Cannot rebalance over the maximum rebalance limit",
      );
      await expectToRevert(
        sale.rebalanceRoundLimit(1, roundLimit2.add(1)),
        "Sale: Cannot rebalance over the maximum rebalance limit",
      );
      await expectToRevert(
        sale.rebalanceRoundLimit(2, roundLimit3.add(1)),
        "Sale: Cannot rebalance over the maximum rebalance limit",
      );
    });
  });

  describe("Invited", () => {
    before(async () => {
      await regenerateSale();
    });

    it("revert the invest if round is not active", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await expectToRevert(
        sale.investWithCode(code, signature, stablecoinName, investAmount, 1),
        "Sale: Round is not active",
      );
    });

    it("invest if round active using the correct code & signature", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[0], sale.address);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0);

      expect(normalizeAmount(await sale.roundsTotalInvestments(0)).toHexString()).to.eq(investAmount.toHexString());
      expect(normalizeAmount((await sale.pools(0, accounts[0].address)).amount).toHexString()).to.eq(
        investAmount.toHexString(),
      );
      expect(normalizeAmount(await sale.investments(0, accounts[0].address)).toHexString()).to.eq(
        investAmount.toHexString(),
      );
    });

    it("revert if trying to use an invalid code & sig", async () => {
      const { code, signature } = await generateCodeSignature(accounts[1]);
      await expectToRevert(
        sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0),
        "Sale: Invalid signature",
      );
    });

    it("revert if another wallet tries to use the same code & signature that another wallet used", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, investAmount, 0);
      await expectToRevert(
        sale.connect(accounts[2]).investWithCode(code, signature, stablecoinName, investAmount, 0),
        "Sale: This code was already used by a different address",
      );
    });

    it("revert if trying to use an invalid token", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[3], sale.address);
      await expectToRevert(
        sale.connect(accounts[3]).investWithCode(code, signature, "INVALID", investAmount, 0),
        "Sale: Invalid token/token not accepted",
      );
    });

    it("revert if trying to invest without approving the token first", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await expectToRevert(
        sale.connect(accounts[5]).investWithCode(code, signature, stablecoinName, investAmount, 0),
        "Sale: Cannot transfer from the token to the target",
      );
    });

    it("invest a second time without the code & signature as pool owner if already invested", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[4], sale.address);
      await sale.connect(accounts[4]).investWithCode(code, signature, stablecoinName, investAmount, 0);
      await sale.connect(accounts[4]).investWithoutCode(stablecoinName, investAmount, 0);

      expect(normalizeAmount(await sale.roundsTotalInvestments(0)).toHexString()).to.eq(
        investAmount.mul(4).toHexString(),
      );
      expect(normalizeAmount(await (await sale.pools(0, accounts[4].address)).amount).toHexString()).to.eq(
        investAmount.mul(2).toHexString(),
      );
      expect(normalizeAmount(await await sale.investments(0, accounts[4].address)).toHexString()).to.eq(
        investAmount.mul(2).toHexString(),
      );
      await expectToRevert(
        sale.connect(accounts[5]).investWithoutCode(stablecoinName, investAmount, 0),
        "Sale: You need to invest with an invitation first",
      );
    });

    it("invest a second time without the code & signature as private pool joiner if already invested", async () => {
      await regenerateSale();
      const sig1 = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await sale.connect(accounts[1]).investWithCode(sig1.code, sig1.signature, stablecoinName, investAmount, 0);
      const poolBefore = (await sale.pools(0, accounts[1].address)).amount;
      const sig2 = await generateCodeSignature(accounts[1]);
      await expectToRevert(
        sale.connect(accounts[2]).investWithoutCode(stablecoinName, investAmount, 0),
        "Sale: You need to invest with an invitation first",
      );
      await sale
        .connect(accounts[2])
        .investPrivatePool(accounts[1].address, sig2.code, sig2.signature, stablecoinName, investAmount, 0);
      await sale.connect(accounts[2]).investWithoutCode(stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[1].address)).amount;
      expect(poolBefore.mul(3).toHexString()).to.eq(poolAfter.toHexString());
    });

    it("invest a second time without the code & signature as public pool joiner if already invested", async () => {
      await regenerateSale();
      await sale.enableRound(0, true);
      const sig1 = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await sale.connect(accounts[1]).investWithCode(sig1.code, sig1.signature, stablecoinName, investAmount, 0);
      const poolBefore = (await sale.pools(0, accounts[1].address)).amount;
      await sale.connect(accounts[1]).openPool(0, true);
      await generateCodeSignature(accounts[1]);
      await expectToRevert(
        sale.connect(accounts[2]).investWithoutCode(stablecoinName, investAmount, 0),
        "Sale: You need to invest with an invitation first",
      );
      await sale.connect(accounts[2]).investPublicPool(accounts[1].address, stablecoinName, investAmount, 0);
      await sale.connect(accounts[2]).investWithoutCode(stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[1].address)).amount;
      expect(poolBefore.mul(3).toHexString()).to.eq(poolAfter.toHexString());
    });

    it("invest up to the maximum pool limit for each round", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await Promise.all([
        sale.enableRound(0, true),
        sale.enableRound(1, true),
        sale.enableRound(2, true),
        approveToken(network, stablecoin, accounts[1], sale.address),
      ]);

      await sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, normalizeAmount(poolLimit), 0);
      await sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, normalizeAmount(poolLimit), 1);
      await sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, normalizeAmount(poolLimit), 2);
      await expectToRevert(
        sale
          .connect(accounts[1])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 0),
        "Sale: Pool maximum allowance reached",
      );
      await expectToRevert(
        sale
          .connect(accounts[1])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 1),
        "Sale: Pool maximum allowance reached",
      );
      await expectToRevert(
        sale
          .connect(accounts[1])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 2),
        "Sale: Pool maximum allowance reached",
      );
    });

    it("invest up to the maximum round allowance per round", async () => {
      await regenerateSale();
      await Promise.all([sale.enableRound(0, true), sale.enableRound(1, true), sale.enableRound(2, true)]);
      const sigMap = {} as {
        [addr: string]: { code: string; signature: string };
      };

      const fillUpRound = async (roundLimit: BigNumber, round: number) => {
        let invested = BigNumber.from(0);
        let accNo = 1;

        while (invested.lt(roundLimit)) {
          await approveToken(network, stablecoin, accounts[accNo], sale.address);

          let sig = await generateCodeSignature(accounts[0]);

          if (!sigMap[accounts[accNo].address]) {
            sigMap[accounts[accNo].address] = sig;
          } else {
            sig = sigMap[accounts[accNo].address];
          }

          const amount = roundLimit.sub(invested).lt(poolLimit) ? roundLimit.sub(invested) : poolLimit;
          await sale
            .connect(accounts[accNo])
            .investWithCode(sig.code, sig.signature, stablecoinName, normalizeAmount(amount), round);
          invested = invested.add(amount);
          accNo++;
        }
        await approveToken(network, stablecoin, accounts[accNo], sale.address);

        let sig = await generateCodeSignature(accounts[0]);

        if (!sigMap[accounts[accNo].address]) {
          sigMap[accounts[accNo].address] = sig;
        } else {
          sig = sigMap[accounts[accNo].address];
        }

        await expectToRevert(
          sale
            .connect(accounts[accNo])
            .investWithCode(
              sig.code,
              sig.signature,
              stablecoinName,
              ethers.utils.parseUnits("1", stablecoinDecimals),
              0,
            ),
          "Sale: Round maximum allowance reached",
        );
      };

      await fillUpRound(roundLimits[0], 0);
      await fillUpRound(roundLimits[1], 1);
      await fillUpRound(roundLimits[2], 2);

      expect((await sale.roundsTotalInvestments(0)).toHexString()).to.eq(roundLimits[0].toHexString());
      expect((await sale.roundsTotalInvestments(1)).toHexString()).to.eq(roundLimits[1].toHexString());
      expect((await sale.roundsTotalInvestments(2)).toHexString()).to.eq(roundLimits[2].toHexString());

      const { code, signature } = await generateCodeSignature(accounts[0]);

      await expectToRevert(
        sale
          .connect(accounts[0])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 0),
        "Sale: Round maximum allowance reached",
      );

      await expectToRevert(
        sale
          .connect(accounts[0])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 1),
        "Sale: Round maximum allowance reached",
      );

      await expectToRevert(
        sale
          .connect(accounts[0])
          .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 2),
        "Sale: Round maximum allowance reached",
      );
    });

    it("transfer the tokens to the correct wallet when investing", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);

      await Promise.all([sale.enableRound(0, true), approveToken(network, stablecoin, accounts[0], sale.address)]);

      const balanceBefore = await balanceOf(stablecoin, accounts[1].address);
      await sale.investWithCode(code, signature, stablecoinName, investAmount, 0);
      const balanceAfter = await balanceOf(stablecoin, accounts[1].address);
      expect(balanceAfter.sub(balanceBefore).toHexString()).to.eq(investAmount.toHexString());
    });
  });

  describe("Pools", () => {
    before(async () => {
      await regenerateSale();
    });

    it("revert if trying using a private invitation of a pool owner that did not invest first", async () => {
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      const { code, signature } = await generateCodeSignature(accounts[1]);

      await expectToRevert(
        sale
          .connect(accounts[2])
          .investPrivatePool(accounts[1].address, code, signature, stablecoinName, investAmount, 0),
        "Sale: This pool does not exist",
      );
    });

    it("revert if using a invalid private pool invitation code/signature", async () => {
      const inv1 = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await sale.connect(accounts[1]).investWithCode(inv1.code, inv1.signature, stablecoinName, investAmount, 0);

      const inv2 = await generateCodeSignature(accounts[3]);
      await expectToRevert(
        sale
          .connect(accounts[2])
          .investPrivatePool(accounts[1].address, inv2.code, inv2.signature, stablecoinName, investAmount, 0),
        "Sale: Invalid invitation codes",
      );
    });

    it("invest in a pool if the wallet has a private pool invitation", async () => {
      await regenerateSale();
      const inv1 = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await sale.connect(accounts[1]).investWithCode(inv1.code, inv1.signature, stablecoinName, investAmount, 0);
      const inv2 = await generateCodeSignature(accounts[1]);
      const poolBefore = (await sale.pools(0, accounts[1].address)).amount;
      await sale
        .connect(accounts[2])
        .investPrivatePool(accounts[1].address, inv2.code, inv2.signature, stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[1].address)).amount;
      expect(normalizeAmount(poolAfter).toHexString()).to.eq(
        normalizeAmount(poolBefore).add(investAmount).toHexString(),
      );
    });

    it("revert if trying to invest in another pool", async () => {
      await regenerateSale();
      const inv1 = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      await approveToken(network, stablecoin, accounts[3], sale.address);
      await sale.connect(accounts[1]).investWithCode(inv1.code, inv1.signature, stablecoinName, investAmount, 0);
      const inv2 = await generateCodeSignature(accounts[1]);
      const poolBefore = (await sale.pools(0, accounts[1].address)).amount;
      await sale
        .connect(accounts[2])
        .investPrivatePool(accounts[1].address, inv2.code, inv2.signature, stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[1].address)).amount;
      expect(normalizeAmount(poolAfter).toHexString()).to.eq(
        normalizeAmount(poolBefore).add(investAmount).toHexString(),
      );
      const inv3 = await generateCodeSignature(accounts[0]);
      await sale.connect(accounts[3]).investWithCode(inv3.code, inv3.signature, stablecoinName, investAmount, 0);
      const inv4 = await generateCodeSignature(accounts[3]);
      await expectToRevert(
        sale
          .connect(accounts[2])
          .investPrivatePool(accounts[3].address, inv4.code, inv4.signature, stablecoinName, investAmount, 0),
        "Sale: This code was already used by a different address",
      );
    });

    it("revert investing in your own pool as a pool owner", async () => {
      await regenerateSale();
      const inv1 = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await sale.connect(accounts[1]).investWithCode(inv1.code, inv1.signature, stablecoinName, investAmount, 0);
      const inv2 = await generateCodeSignature(accounts[1]);
      await expectToRevert(
        sale
          .connect(accounts[1])
          .investPrivatePool(accounts[1].address, inv2.code, inv2.signature, stablecoinName, investAmount, 0),
        "Sale: This code was already used by a different address",
      );
    });

    it("revert investing in another pool as a pool owner", async () => {
      await regenerateSale();
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await approveToken(network, stablecoin, accounts[2], sale.address);
      const inv1 = await generateCodeSignature(accounts[0]);
      await sale.connect(accounts[1]).investWithCode(inv1.code, inv1.signature, stablecoinName, investAmount, 0);
      const inv2 = await generateCodeSignature(accounts[0]);
      await sale.connect(accounts[2]).investWithCode(inv2.code, inv2.signature, stablecoinName, investAmount, 0);
      const inv3 = await generateCodeSignature(accounts[2]);
      await expectToRevert(
        sale
          .connect(accounts[1])
          .investPrivatePool(accounts[2].address, inv3.code, inv3.signature, stablecoinName, investAmount, 0),
        "Sale: This code was already used by a different address",
      );
    });

    it("invest multiple times using the same private pool", async () => {
      const { code, signature } = await generateCodeSignature(accounts[1]);
      await approveToken(network, stablecoin, accounts[3], sale.address);
      const poolBefore = (await sale.pools(0, accounts[1].address)).amount;
      await sale
        .connect(accounts[3])
        .investPrivatePool(accounts[1].address, code, signature, stablecoinName, investAmount, 0);
      await sale
        .connect(accounts[3])
        .investPrivatePool(accounts[1].address, code, signature, stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[1].address)).amount;
      expect(normalizeAmount(poolAfter).toHexString()).to.eq(
        normalizeAmount(poolBefore).add(investAmount.mul(2)).toHexString(),
      );
    });

    it("revert if another wallets tries to use the same private pool invitation", async () => {
      await approveToken(network, stablecoin, accounts[4], sale.address);
      await approveToken(network, stablecoin, accounts[5], sale.address);
      const inv = await generateCodeSignature(accounts[1]);
      await sale
        .connect(accounts[4])
        .investPrivatePool(accounts[1].address, inv.code, inv.signature, stablecoinName, investAmount, 0);
      await expectToRevert(
        sale
          .connect(accounts[5])
          .investPrivatePool(accounts[1].address, inv.code, inv.signature, stablecoinName, investAmount, 0),
        "Sale: This code was already used by a different address",
      );
    });

    it("revert if trying to invest using the public pool function in an on opened pool", async () => {
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await approveToken(network, stablecoin, accounts[0], sale.address);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0);
      await expectToRevert(
        sale.connect(accounts[1]).investPublicPool(accounts[0].address, stablecoinName, investAmount, 0),
        "Sale: The pool is not publicly open",
      );
    });

    it("close an opened pool", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[0], sale.address);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0);
      await sale.openPool(0, true);
      expect((await sale.pools(0, accounts[0].address)).unrestricted).to.be.true;
      await sale.openPool(0, false);
      expect((await sale.pools(0, accounts[0].address)).unrestricted).to.be.false;
    });

    it("revert if trying to open/close a pool that already has this state", async () => {
      await regenerateSale();

      const { code, signature } = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[0], sale.address);
      await sale.connect(accounts[0]).investWithCode(code, signature, stablecoinName, investAmount, 0);

      await sale.openPool(0, true);
      await sale.openPool(1, true);
      await sale.openPool(2, true);

      await expectToRevert(sale.openPool(0, true), "Sale: The pool already has this state");
      await expectToRevert(sale.openPool(1, true), "Sale: The pool already has this state");
      await expectToRevert(sale.openPool(2, true), "Sale: The pool already has this state");

      await sale.openPool(0, false);
      await sale.openPool(1, false);
      await sale.openPool(2, false);

      await expectToRevert(sale.openPool(0, false), "Sale: The pool already has this state");
      await expectToRevert(sale.openPool(1, false), "Sale: The pool already has this state");
      await expectToRevert(sale.openPool(2, false), "Sale: The pool already has this state");
    });

    it("revert if trying to open an un-existent pool", async () => {
      await expectToRevert(sale.connect(accounts[1]).openPool(0, true), "Sale: Address does not own a pool");
    });

    it("open a pool for anyone if caller is the owner", async () => {
      await regenerateSale();

      await expectToRevert(
        sale.connect(accounts[1]).openPoolForAddress(accounts[0].address, 0, true),
        "Ownable: caller is not the owner",
      );

      const { code, signature } = await generateCodeSignature(accounts[0]);
      await sale.enableRound(0, true);
      await approveToken(network, stablecoin, accounts[1], sale.address);
      await sale.connect(accounts[1]).investWithCode(code, signature, stablecoinName, investAmount, 0);

      expect((await sale.pools(0, accounts[1].address)).unrestricted).to.be.false;

      await sale.connect(accounts[0]).openPoolForAddress(accounts[1].address, 0, true);

      expect((await sale.pools(0, accounts[1].address)).unrestricted).to.be.true;
    });

    it("revert if trying to invest in a public pool which does not exist", async () => {
      await expectToRevert(
        sale.investPublicPool(accounts[6].address, stablecoinName, investAmount, 0),
        "Sale: This pool does not exist",
      );
    });

    it("invest in if a public pool is open without code & sig", async () => {
      await approveToken(network, stablecoin, accounts[5], sale.address);
      await approveToken(network, stablecoin, accounts[6], sale.address);
      const inv = await generateCodeSignature(accounts[0]);
      await sale.connect(accounts[5]).investWithCode(inv.code, inv.signature, stablecoinName, investAmount, 0);
      await sale.connect(accounts[5]).openPool(0, true);
      const poolBefore = (await sale.pools(0, accounts[5].address)).amount;
      await sale.connect(accounts[6]).investPublicPool(accounts[5].address, stablecoinName, investAmount, 0);
      const poolAfter = (await sale.pools(0, accounts[5].address)).amount;
      expect(normalizeAmount(poolAfter).toHexString()).to.eq(
        normalizeAmount(poolBefore).add(investAmount).toHexString(),
      );
    });
  });

  describe("Balance", () => {
    before(async () => {
      await regenerateSale();
    });

    it("invest into all rounds and returned balances are correct", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);

      await Promise.all([
        sale.enableRound(0, true),
        sale.enableRound(1, true),
        sale.enableRound(2, true),
        approveToken(network, stablecoin, accounts[1], sale.address),
      ]);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 0);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("2", stablecoinDecimals), 1);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("3", stablecoinDecimals), 2);

      const total = await sale.connect(accounts[1]).getInvestorTotalAllocation(accounts[1].address);

      for (let idx = 0; idx < total[0].length; idx++) {
        expect(normalizeAmount(total[0][idx])).to.be.equal(
          ethers.utils.parseUnits((idx + 1).toString(), stablecoinDecimals),
        );
      }
    });

    it("invest into all rounds multiple times and returned balances are correct", async () => {
      await regenerateSale();
      const { code, signature } = await generateCodeSignature(accounts[0]);

      await Promise.all([
        sale.enableRound(0, true),
        sale.enableRound(1, true),
        sale.enableRound(2, true),
        approveToken(network, stablecoin, accounts[1], sale.address),
      ]);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 0);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("2", stablecoinDecimals), 1);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("3", stablecoinDecimals), 2);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("1", stablecoinDecimals), 0);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("2", stablecoinDecimals), 1);

      await sale
        .connect(accounts[1])
        .investWithCode(code, signature, stablecoinName, ethers.utils.parseUnits("3", stablecoinDecimals), 2);

      const total = await sale.connect(accounts[1]).getInvestorTotalAllocation(accounts[1].address);

      for (let idx = 0; idx < total[0].length; idx++) {
        expect(normalizeAmount(total[0][idx])).to.be.equal(
          ethers.utils.parseUnits(((idx + 1) * 2).toString(), stablecoinDecimals),
        );
      }
    });
  });

  const deploySale = async (
    signer = accounts[0].address,
    wallet = accounts[0].address,
    tokenNames = ["USDT"],
    tokenAddresses = [stablecoin.address],
  ) => {
    const factory = await ethers.getContractFactory("Sale");
    try {
      sale = await factory.deploy(signer, wallet, tokenNames, tokenAddresses);
    } catch (error) {
      console.log("error", error);
    }
    await sale.deployed();
  };

  const regenerateSale = async (
    signer = accounts[0].address,
    wallet = accounts[1].address,
    tokenNames = [stablecoinName],
    tokenAddresses = [stablecoin.address],
  ) => {
    const factory = await ethers.getContractFactory("Sale");
    sale = (await factory.deploy(signer, wallet, tokenNames, tokenAddresses)) as Sale;
  };

  const normalizeAmount = (
    amount: BigNumber,
    sourceDecimals: BigNumber = BigNumber.from(stablecoinDecimals),
  ): BigNumber => {
    return amount.div(BigNumber.from(10).pow(targetDecimals.sub(sourceDecimals)));
  };
});
