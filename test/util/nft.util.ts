import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { GenesisNft, WorkToken } from "../../typings";
import { Network } from "hardhat/types/runtime";
import { amount } from "./helpers.util";
import { approveWorkToken } from "./worktoken.util";
import { Investment, calculateAmountBoughtTotal, calculateBuyMoreTokenBalance } from "./sale.util";
import { MIN_TOKEN_STAKING, VESTING_LENGHT_BUY_MORE_MONTHS } from "../../tasks/constants/sale.constants";
import { avgMonthsVest, maxLockLength } from "./distribution.util";

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

  const tokenId = (await nft.nftIdCounter()) + 1;

  try {
    await expect(
      await nft
        .connect(account)
        .mintNft(
          account.address,
          voucher.voucherId,
          type,
          voucher.lockPeriod,
          amount(stakingAmount),
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
  voucherSignature: string;
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

export const mintNftMany = async (
  network: Network,
  nft: GenesisNft,
  workToken: WorkToken,
  accounts: SignerWithAddress[],
  nftMintQuantity: number,
  type: number,
  chainId: number,
): Promise<NftIds[]> => {
  const nftIds: NftIds[] = [];
  const nftCountCurrent = await nft.nftIdCounter();
  for (let i = 0; i < nftMintQuantity; i++) {
    const nftId = await mintNft(network, nft, workToken, accounts[i + nftCountCurrent], 0, 0, type, chainId);
    nftIds.push(nftId);
  }
  return nftIds;
};
