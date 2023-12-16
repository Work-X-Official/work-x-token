import { Network } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { GenesisNft, WorkToken } from "../../typings";
import { amount } from "../../test/util/helpers.util";

interface NftIds {
  nftId: number;
  voucherId: number;
}

export const mintNft = async (
  network: Network,
  nft: GenesisNft,
  workToken: WorkToken,
  account: SignerWithAddress,
  stakingAmount: number,
  lockPeriod: number,
  type: number,
  chainId: number,
): Promise<NftIds> => {
  const voucher = await nftMintVoucherGenerateLocal(
    account.address,
    stakingAmount,
    nft.address,
    lockPeriod,
    type,
    chainId,
  );

  const tokenId = await nft.nftIdCounter();

  try {
    await expect(
      await nft
        .connect(account)
        .mintNft(voucher.voucherId, type, voucher.lockPeriod, amount(stakingAmount), voucher.voucherSignature),
    )
      .to.emit(nft, "Transfer")
      .withArgs(ethers.constants.AddressZero, account.address, tokenId);
  } catch (error) {
    console.error("Error minting NFT");
    console.error(error);
  }

  expect(await nft.ownerOf(tokenId)).to.be.equal(account.address);
  const _tokenIdInfoAtMonth = await nft.getStaked(tokenId, 0);
  expect(_tokenIdInfoAtMonth[0]).to.be.equal(amount(stakingAmount));
  expect(_tokenIdInfoAtMonth[1]).to.be.equal(amount(stakingAmount));

  return {
    nftId: tokenId,
    voucherId: voucher.voucherId,
  };
};

export const nftMintVoucherGenerateLocal = async (
  walletAddress: string,
  stake: number,
  nftContractAddress: string,
  lockPeriod: number,
  type: number,
  chainId: number,
): Promise<Voucher> => {
  const voucherId = Math.floor(Math.random() * 10000);
  const signature = await createSignatureMint(
    voucherId,
    type,
    walletAddress,
    amount(stake),
    lockPeriod,
    nftContractAddress,
    chainId,
  );
  const voucherObject = {
    voucherId: voucherId,
    walletAddress: walletAddress,
    amountToStake: stake,
    lockPeriod: lockPeriod,
    voucherSignature: signature,
  } as Voucher;
  return voucherObject;
};

export type Voucher = {
  voucherId: number;
  walletAddress: string;
  amountToStake: number;
  amountToNotVest: number;
  lockPeriod: number;
  voucherSignature: string;
};

function createSignatureMint(
  voucherId: number,
  type: number,
  account: string,
  amountToStake: BigNumber,
  lockPeriod: number,
  nftContractAddress: string,
  chainId: number,
): Promise<string> {
  const domain = {
    name: "Work X Genesis NFT",
    version: "1.0.0",
    chainId: chainId,
    verifyingContract: nftContractAddress,
  };

  const types = {
    NFT: [
      { name: "voucherId", type: "uint256" },
      { name: "type", type: "uint256" },
      { name: "lockPeriod", type: "uint256" },
      { name: "account", type: "address" },
      { name: "amountToStake", type: "uint256" },
    ],
  };

  const value = {
    voucherId: voucherId,
    type: type,
    lockPeriod: lockPeriod,
    account: account,
    amountToStake: amountToStake,
  };

  if (process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER === undefined) {
    throw new Error("Please set the PRIVATE_KEY_NFT_VOUCHER_SIGNER environment variable");
  }
  const privateKey = process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string;
  const signer = new ethers.Wallet(privateKey);

  return signer._signTypedData(domain, types, value);
}
