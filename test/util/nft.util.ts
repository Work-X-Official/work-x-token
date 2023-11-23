import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { GenesisNft, WorkToken } from "../../typings";
import { Network } from "hardhat/types/runtime";
import { amount } from "./helpers.util";
import { ATTRIBUTES } from "../constants";
import { approveWorkToken } from "./worktoken.util";
import { Investment, calculateAmountBoughtTotal, calculateBuyMoreTokenBalance } from "./sale.util";
import { MIN_TOKEN_STAKING, VESTING_LENGHT_BUY_MORE_MONTHS } from "../../tasks/constants/sale.constants";
import { avgMonthsVest, maxLockLength } from "./distribution.util";

interface nftIds {
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
  chainId: number,
): Promise<nftIds> => {
  const voucher = await nftMintVoucherGenerateLocal(
    account.address,
    stakingAmount,
    ["Male", "Yellow", "Founder"],
    chainId,
    nft.address,
    lockPeriod,
  );

  const tokenId = (await nft.nftIdCounter()) + 1;

  try {
    await expect(
      await nft
        .connect(account)
        .mintNft(
          account.address,
          voucher.voucherId,
          0,
          voucher.lockPeriod,
          amount(stakingAmount),
          voucher.imageUri,
          ethers.utils.formatBytes32String(voucher.encodedAttributes),
          voucher.voucherSignature,
        ),
    )
      .to.emit(nft, "Transfer")
      .withArgs(ethers.constants.AddressZero, account.address, tokenId);
  } catch (error) {
    console.error("Error minting NFT");
    console.error(error);
  }

  expect(await nft.ownerOf(tokenId)).to.be.equal(account.address);
  const _tokenIdInfoAtMonth = await nft.getNftInfoAtMonth(tokenId, 0);
  expect(_tokenIdInfoAtMonth.staked).to.be.equal(amount(stakingAmount));
  expect(_tokenIdInfoAtMonth.minimumStaked).to.be.equal(amount(stakingAmount));

  await approveWorkToken(network, workToken, account, nft.address);

  return {
    nftId: tokenId,
    voucherId: voucher.voucherId,
  };
};

export type Voucher = {
  voucherId: number;
  walletAddress: string;
  amountToStake: number;
  amountToNotVest: number;
  lockPeriod: number;
  imageUri: string;
  encodedAttributes: string;
  voucherSignature: string;
};

export const nftMintVoucherGenerateLocal = async (
  walletAddress: string,
  stake: number,
  chosenAttributes: string[],
  chainId: number,
  nftContractAddress: string,
  lockPeriod: number,
): Promise<Voucher> => {
  const encodedAttributes = encodeAttributes(chosenAttributes);
  const voucherId = Math.floor(Math.random() * 10000);
  const imageUri = "https://content.workx.io/images/metamask_gold.png";
  const signature = await createSignatureMint(
    voucherId,
    0,
    walletAddress,
    amount(stake),
    lockPeriod,
    imageUri,
    encodedAttributes,
    chainId,
    nftContractAddress,
  );
  const voucherObject = {
    voucherId: voucherId,
    walletAddress: walletAddress,
    amountToStake: stake,
    lockPeriod: lockPeriod,
    imageUri: imageUri,
    encodedAttributes: encodedAttributes,
    voucherSignature: signature,
  } as Voucher;
  return voucherObject;
};

function createSignatureMint(
  voucherId: number,
  type: number,
  account: string,
  amountToStake: BigNumber,
  lockPeriod: number,
  imageUri: string,
  encodedAttributes: string,
  chainId: number,
  nftContractAddress: string,
): Promise<string> {
  const domain = {
    name: "Work X Genesis NFT",
    version: "1.0.0",
    chainId: chainId,
    verifyingContract: nftContractAddress,
  };

  const types = {
    NFT: [
      { name: "voucherId", type: "uint16" },
      { name: "type", type: "uint16" },
      { name: "lockPeriod", type: "uint64" },
      { name: "account", type: "address" },
      { name: "amountToStake", type: "uint256" },
      { name: "imageUri", type: "string" },
      { name: "encodedAttributes", type: "bytes32" },
    ],
  };

  const value = {
    voucherId: voucherId,
    type: type,
    lockPeriod: lockPeriod,
    account: account,
    amountToStake: amountToStake,
    imageUri: imageUri,
    encodedAttributes: ethers.utils.formatBytes32String(encodedAttributes),
  };
  if (process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER === undefined) {
    throw new Error("Please set the PRIVATE_KEY_NFT_VOUCHER_SIGNER environment variable");
  }
  const privateKey = process.env.PRIVATE_KEY_NFT_VOUCHER_SIGNER as string;
  const signer = new ethers.Wallet(privateKey);

  return signer._signTypedData(domain, types, value);
}

function encodeAttributes(attributesValues: string[]): string {
  const arrayOfIndices = [];
  const attributeIndexofSexArray = ATTRIBUTES.sex.indexOf(attributesValues[0]);
  arrayOfIndices.push(attributeIndexofSexArray);
  const attributeIndexofSkinColorArray = ATTRIBUTES.skinColor.indexOf(attributesValues[1]);
  arrayOfIndices.push(attributeIndexofSkinColorArray);
  const attributeIndexofProfessionArray = ATTRIBUTES.profession.indexOf(attributesValues[2]);
  arrayOfIndices.push(attributeIndexofProfessionArray);
  const resultingArr = arrayOfIndices.map(num => num.toString().padStart(2, "0"));
  const attributesString = resultingArr.join("");
  return attributesString;
}

export const approveGenesisNft = async (
  network: Network,
  token: GenesisNft,
  tokenId: number,
  account: SignerWithAddress,
  sender: string,
) => {
  await token.connect(account).approve(sender, tokenId);
  await network.provider.send("evm_mine");
};

export function nftLockTimeByStake(stakingAmount: number, investment: Investment): number {
  const { seed, priv, pre, preDisc, buyMore } = investment;
  const allInvestedZero = seed === 0 && priv === 0 && pre === 0 && preDisc === 0 && buyMore === 0;
  const onlyBuyMoreNonZero = seed === 0 && priv === 0 && pre === 0 && preDisc === 0 && buyMore !== 0;
  if (!allInvestedZero) {
    if (!onlyBuyMoreNonZero) {
      const minMonths = avgMonthsVest(investment);
      const maxMonths = maxLockLength(minMonths);
      const buyMoreTokens = calculateBuyMoreTokenBalance(buyMore);
      const boughtTotal = calculateAmountBoughtTotal(investment);
      const minToken = boughtTotal < MIN_TOKEN_STAKING ? boughtTotal : MIN_TOKEN_STAKING + buyMoreTokens;
      if (stakingAmount < minToken) throw new Error("Staking amount is too low");
      if (stakingAmount > boughtTotal) throw new Error("Staking amount is more than bought");
      const saleTotal = boughtTotal - buyMoreTokens;
      const val = saleTotal === minToken ? 1 : (stakingAmount - minToken) / (saleTotal - minToken);
      return minMonths - (minMonths - maxMonths) * val;
    } else {
      return VESTING_LENGHT_BUY_MORE_MONTHS;
    }
  } else {
    return 0;
  }
}
