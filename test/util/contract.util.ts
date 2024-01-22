import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  WorkToken,
  TokenDistribution,
  GenesisNft,
  RewardShares,
  RewardTokens,
  RewardWrapper,
  RewardLevels,
} from "../../typings";
import { regenerateTokenDistribution } from "./distribution.util";
import { regenerateNft, getVoucherSigner } from "./nft.util";
import { regenerateWorkToken } from "./worktoken.util";
import {
  regenerateRewardLevels,
  regenerateRewardShares,
  regenerateRewardTokens,
  regenerateRewardWrapper,
} from "./reward.util";

export const regenerateContracts = async (
  accounts: SignerWithAddress[],
  minter = accounts[0].address,
  startTimeDistribution: number,
): Promise<{
  workToken: WorkToken;
  distribution: TokenDistribution;
  nft: GenesisNft;
  rewardShares: RewardShares;
  rewardTokens: RewardTokens;
  rewardLevels: RewardLevels;
  rewardWrapper: RewardWrapper;
}> => {
  const workToken = await regenerateWorkToken(accounts, minter);
  const distribution = await regenerateTokenDistribution(startTimeDistribution, workToken, accounts[0]);
  const nft = await regenerateNft(accounts[0], workToken, distribution, getVoucherSigner().address);
  const rewardShares = await regenerateRewardShares(accounts[0], workToken, nft);
  const rewardTokens = await regenerateRewardTokens(accounts[0], workToken, nft);
  const rewardLevels = await regenerateRewardLevels(accounts[0], workToken, nft);
  const rewardWrapper = await regenerateRewardWrapper(accounts[0], nft, []);
  return {
    workToken,
    distribution,
    nft,
    rewardShares,
    rewardTokens,
    rewardLevels,
    rewardWrapper,
  };
};
