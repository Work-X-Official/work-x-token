import { BigNumber, Contract, ethers } from "ethers";
import { ERC20, IERC20, WorkToken } from "../../typings";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Network } from "hardhat/types";

export const approveWorkToken = async (
  network: Network,
  token: WorkToken,
  account: SignerWithAddress,
  sender: string,
) => {
  const approveAmount = ethers.constants.MaxUint256.toString();

  const allowance = await (token as IERC20).allowance(account.address, sender);

  if (approveAmount === allowance.toString()) {
    return;
  } else {
    try {
      await (token as IERC20).connect(account).approve(sender, approveAmount);
    } catch (error) {
      console.log("approving ", error);
    }
    try {
      await network.provider.send("evm_mine");
    } catch (error) {
      console.log("mining ", error);
      console.log("error", error);
    }
  }
};

export const approveToken = async (network: Network, token: ERC20, account: SignerWithAddress, sender: string) => {
  const approveAmount = ethers.constants.MaxUint256.toString();

  const allowance = await (token as IERC20).allowance(account.address, sender);

  if (approveAmount === allowance.toString()) {
    return;
  } else {
    try {
      await (token as IERC20).connect(account).approve(sender, approveAmount);
    } catch (error) {
      console.log("approving ", error);
    }
    try {
      await network.provider.send("evm_mine");
    } catch (error) {
      console.log("mining ", error);
      console.log("error", error);
    }
  }
};

export const sendTokens = async (
  network: Network,
  sender: SignerWithAddress,
  receivers: SignerWithAddress[],
  decimals: number,
  token: Contract,
) => {
  for (let i = 0; i < 8; i++) {
    await sendToken(network, sender, receivers[i].address, ethers.utils.parseUnits("10000000", decimals), token);
  }
};

export const sendToken = async (
  network: Network,
  sender: SignerWithAddress,
  receiver: string,
  amount: BigNumber,
  token: Contract,
) => {
  try {
    const contract = token as IERC20;

    await contract.connect(sender).transfer(receiver, amount);
  } catch (error) {
    console.log("send trouble");
    console.log("error", error);
  }

  try {
    await network.provider.send("evm_mine");
  } catch (error) {
    console.log("mining ", error);
    console.log("error", error);
  }
};

export const balanceOf = async (token: IERC20, address: string): Promise<BigNumber> => {
  return token.balanceOf(address);
};
