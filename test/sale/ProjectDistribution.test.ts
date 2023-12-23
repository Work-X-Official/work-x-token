import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { amount, big } from "../util/helpers.util";
import { ProjectDistribution, WorkToken } from "../../typings";
import { regenerateProjectDistribution } from "../util/sale-distribution.util";
import { BigNumber } from "ethers";

// this test requires the "initialDate: "2023-12-05 10:10:00 AM"," to be commented in, in hardhat.config.ts
describe.only("ProjectDistribution", function () {
  let distribution: ProjectDistribution;
  let accounts: SignerWithAddress[];
  let workToken: WorkToken;

  const startTime = 1701771000;

  const far = (value: BigNumber): number => {
    return Number(ethers.utils.formatEther(value.div(1000))) * 1000;
  };

  const testBalanceZero = async (account: SignerWithAddress, total: number) => {
    const balance = await distribution.balance(account.address);
    expect(balance._claimable).to.equal(big(0));
    expect(balance._claimed).to.equal(big(0));
    expect(balance._vested).to.equal(big(0));
    expect(balance._total).to.equal(amount(total));
  };

  const testBalanceZeroAll = async () => {
    await testBalanceZero(accounts[0], 12000000);
    await testBalanceZero(accounts[1], 9500000);
    await testBalanceZero(accounts[2], 15000000);
    await testBalanceZero(accounts[3], 5000000);
    await testBalanceZero(accounts[4], 2500000);
    await testBalanceZero(accounts[5], 2500000);
    await testBalanceZero(accounts[6], 2500000);
    await testBalanceZero(accounts[7], 5000000);
  };

  const testVestedAmount = async (account: SignerWithAddress, days: number) => {
    const balance = await distribution.balance(account.address);
    const vested = await distribution.vestedTokens(account.address);
    const expected = big(days * 60 * 60 * 24).lte(balance._period)
      ? balance._total.mul(days * 60 * 60 * 24).div(balance._period)
      : balance._total;
    expect(vested).to.equal(expected);
  };

  const testVestedAll = async (days: number) => {
    for (let i = 0; i < 8; i++) {
      await testVestedAmount(accounts[i], days);
    }
  };

  const testClaimableAmount = async (account: SignerWithAddress, days: number) => {
    const balance = await distribution.balance(account.address);
    const claimed = await distribution.claimedTokens(account.address);
    const vested = await distribution.vestedTokens(account.address);
    const claimable2 = vested.sub(claimed);
    const claimable = await distribution.claimableTokens(account.address);
    expect(claimable2).to.equal(claimable);
    const expected = big(days * 60 * 60 * 24).lte(balance._period)
      ? balance._total.mul(days * 60 * 60 * 24).div(balance._period)
      : balance._total;
    //console.log(account.address + " claimable after " + days + " days", far(claimable));
    expect(claimable2).to.equal(expected.sub(claimed));
  };

  const testClaimableAll = async (days: number) => {
    for (let i = 0; i < 8; i++) {
      await testClaimableAmount(accounts[i], days);
    }
  };

  const testClaim = async (account: SignerWithAddress, days: number) => {
    const balance = await distribution.balance(account.address);
    const oneBlockAmount = balance._total.mul(1).div(balance._period);
    const claimedBefore = await distribution.claimedTokens(account.address);
    const claimableBefore = await distribution.claimableTokens(account.address);
    await distribution.connect(account).claimTokens();
    const claimedAfter = await distribution.claimedTokens(account.address);
    console.log(account.address + " claimed", far(claimedAfter));
    const expectedClaimAfter = big(days * 60 * 60 * 24).lte(balance._period)
      ? claimedBefore.add(claimableBefore).add(oneBlockAmount)
      : claimedBefore.add(claimableBefore);
    expect(claimedAfter).to.equal(expectedClaimAfter);
    const claimableAfter = await distribution.claimableTokens(account.address);
    expect(claimableAfter).to.equal(big(0));
  };

  const testClaimAll = async (days: number) => {
    for (let i = 0; i < 8; i++) {
      await testClaim(accounts[i], days);
    }
  };

  this.beforeAll(async () => {
    accounts = await ethers.getSigners();
    workToken = (await (await ethers.getContractFactory("WorkToken")).deploy()) as WorkToken;
    distribution = await regenerateProjectDistribution(workToken, accounts);
    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
    await network.provider.send("evm_mine");
  });

  describe("Start", () => {
    describe("Vested Tokens", () => {
      it("Should return the 0 for all types", async () => {
        await testVestedAll(0);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the 0 for all types", async () => {
        await testClaimableAll(0);
      });
    });

    describe("Balance", () => {
      it("Should return 0 balance for all types", async () => {
        await testBalanceZeroAll();
      });
    });
  });

  describe("After 1 days", () => {
    const days = 1;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });
  });

  describe("After 25 days", () => {
    const days = 25;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    // describe("Claim Tokens", () => {
    //   it("Should return the correct amounts for all types", async () => {
    //     await testClaimAll();
    //   });
    // });
  });

  describe("After 90 days", () => {
    const days = 90;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    // describe("Claim Tokens", () => {
    //   it("Should return the correct amounts for all types", async () => {
    //     console.log("Claiming after " + days + " days");
    //     await testClaimAll();
    //   });
    // });
  });

  describe("After 365 days", () => {
    const days = 365;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    // describe("Claim Tokens", () => {
    //   it("Should return the correct amounts for all types", async () => {
    //     console.log("Claiming after " + days + " days");
    //     await testClaimAll();
    //   });
    // });
  });

  describe("After 730 days", () => {
    const days = 730;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    // describe("Claim Tokens", () => {
    //   it("Should return the correct amounts for all types", async () => {
    //     console.log("Claiming after " + days + " days");
    //     await testClaimAll();
    //   });
    // });
  });

  describe("After 1460 days", () => {
    const days = 1460;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    describe("Claim Tokens", () => {
      it("Should return the correct amounts for all types", async () => {
        console.log("Claiming after " + days + " days");
        await testClaimAll(days);
      });
    });
  });

  describe("After 1825 days", () => {
    const days = 1825;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    // describe("Claim Tokens", () => {
    //   it("Should return the correct amounts for all types", async () => {
    //     console.log("Claiming after " + days + " days");
    //     await testClaimAll(days);
    //   });
    // });
  });

  describe("After 18250 days", () => {
    const days = 18250;
    before(async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [startTime + 60 * 60 * 24 * days]);
      await network.provider.send("evm_mine");
    });

    describe("Vested Tokens", () => {
      it("Should return the correct Vested amounts for all types", async () => {
        await testVestedAll(days);
      });
    });

    describe("Claimable Tokens", () => {
      it("Should return the correct Claimable amounts for all types", async () => {
        await testClaimableAll(days);
      });
    });

    describe("Claim Tokens", () => {
      it("Should return the correct amounts for all types", async () => {
        console.log("Claiming after " + days + " days");
        await testClaimAll(days);
      });
    });
  });
});
