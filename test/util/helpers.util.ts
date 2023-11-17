import { expect } from "chai";
import { Signer, ethers } from "ethers";
import { Network } from "hardhat/types/runtime";

export type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

export const amount = (a: number) => ethers.utils.parseUnits(a.toString(), 18);
export const amountFromString = (a: string) => ethers.utils.parseUnits(a, 18);
export const big = (a: number) => ethers.BigNumber.from(a.toString());

export const mineDays = async (days: number, network: Network) => {
  await network.provider.send("evm_increaseTime", [60 * 60 * 24 * days]);
  await network.provider.send("evm_mine");
};

export const mineTime = async (time: number, network: Network) => {
  await network.provider.send("evm_increaseTime", [time]);
  await network.provider.send("evm_mine");
};

export const daysToSeconds = (days: number) => 60 * 60 * 24 * days;
export const monthsToSeconds = (months: number) => Math.round(daysToSeconds(monthsToDays(months)));
export const monthsToDays = (months: number) => (months * 365) / 12;
export const secondsToDays = (seconds: number) => seconds / (60 * 60 * 24);
export const daysToMonths = (days: number) => (days * 12) / 365;
export const secondsToMonths = (seconds: number) => Math.floor(seconds / 60 / 60 / 24 / 30);

export const expectToRevert = async (contractCall: Promise<unknown>, message: string) => {
  try {
    await contractCall;
  } catch (errors) {
    if (errors instanceof Error) {
      const m = errors.message
        .match(/VM Exception while processing transaction: reverted with reason string (.*)/)?.[1]
        .replace(/^'|'$/g, "")
        .trim();
      if (m === undefined) {
        expect.fail(`Failed with unexpected error ${errors}`);
      }
      expect(m).to.include(message);
      return;
    }
  }

  expect.fail("Function did not threw an error");
};

export const expectNotToRevertWith = async (
  contractCall: Promise<unknown>,
  message: string,
  acceptNotReverting: boolean = false,
) => {
  try {
    await contractCall;
  } catch (errors) {
    if (errors instanceof Error) {
      const m = errors.message
        .match(/VM Exception while processing transaction: reverted with reason string (.*)/)?.[1]
        .replace(/'/g, "")
        .trim();

      expect(m).to.not.eq(message);
      return;
    }
  }

  if (!acceptNotReverting) {
    expect.fail("Function did not threw an error");
  }
};

export const expectNotToRevert = async (contractCall: Promise<unknown>) => {
  try {
    await contractCall;
  } catch (errors) {
    expect.fail(`Expected to not fail but failed with ${errors}`);
  }
};

export const generateCodeSignature = async (account: Signer, code = Math.random().toString()) => {
  const codeHash = ethers.utils.solidityKeccak256(["string"], [code]);
  const signature = await account.signMessage(ethers.utils.arrayify(codeHash));

  return { code: codeHash, signature };
};
