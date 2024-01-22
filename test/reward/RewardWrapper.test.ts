import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { GenesisNft, WorkToken, TokenDistribution, RewardTokens, RewardWrapper, RewardShares } from "../../typings";
import { ethers, network } from "hardhat";
import { amount, big, mineDays } from "../util/helpers.util";
import { regenerateContracts } from "../util/contract.util";
import { mintNft } from "../util/nft.util";
import { config } from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { REWARDS_SHARES } from "../../tasks/constants/reward.constants";
import { REWARDS_TOKENS } from "../../tasks/constants/reward.constants";
import { claimAndVerifyStaked, getClaimable } from "../util/reward.util";

config();

chai.use(solidity);

describe("RewardWrapper", () => {
  let nft: GenesisNft;
  let accounts: SignerWithAddress[];

  let nftMinter1: SignerWithAddress;
  let nftMinter2: SignerWithAddress;

  let nftId1: number;
  let nftId2: number;

  let workToken: WorkToken;
  let distribution: TokenDistribution;
  let rewardTokens: RewardTokens;
  let rewardShares: RewardShares;
  let rewardWrapper: RewardWrapper;

  let chainId: number;

  before(async () => {
    accounts = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    nftMinter1 = accounts[3];
    nftMinter2 = accounts[4];

    const startTime = (await ethers.provider.getBlock("latest")).timestamp + 35;
    ({ workToken, distribution, nft, rewardTokens, rewardShares, rewardWrapper } = await regenerateContracts(
      accounts,
      accounts[0].address,
      startTime,
    ));

    await distribution.setWalletClaimable([nftMinter2.address], [50000], [0], [0], [0]);

    await rewardTokens.approve(nft.address, amount(1000000));
    await rewardShares.approve(nft.address, amount(1000000));

    await rewardTokens.setRewardWrapper(rewardWrapper.address);
    await rewardShares.setRewardWrapper(rewardWrapper.address);

    ({ nftId: nftId1 } = await mintNft(network, nft, workToken, nftMinter1, 0, 0, 0, chainId));
    ({ nftId: nftId2 } = await mintNft(network, nft, workToken, nftMinter2, 50000, 0, 0, chainId));
    await mineDays(22, network);
    await mineDays(30, network);
  });

  describe("Test setRewarders", () => {
    it("Should revert if not owner", async () => {
      await expect(rewardWrapper.connect(accounts[1]).setRewarders([rewardTokens.address])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Function getRewarders should be empty", async () => {
      const rewards = await rewardWrapper.getRewarders();
      expect(rewards.length).to.be.equal(0);
    });

    it("Should set rewards with one value", async () => {
      await rewardWrapper.setRewarders([rewardTokens.address]);
      const rewards = await rewardWrapper.getRewarders();
      expect(rewards.length).to.be.equal(1);
      expect(rewards[0]).to.be.equal(rewardTokens.address);
    });

    it("Should set rewards with two values", async () => {
      await rewardWrapper.setRewarders([rewardTokens.address, rewardShares.address]);
      const rewards = await rewardWrapper.getRewarders();
      expect(rewards.length).to.be.equal(2);
      expect(rewards[0]).to.be.equal(rewardTokens.address);
      expect(rewards[1]).to.be.equal(rewardShares.address);
    });
  });

  describe("Test claim", () => {
    it("Should revert if not the owner of that nft id", async () => {
      await expect(rewardWrapper.connect(nftMinter2).claim(nftId1)).to.be.revertedWith("NftNotOwned");
    });

    it("When only having shares, claim claims only claimable from shares and increase nft staked", async () => {
      const { rewardSharesClaimable, rewardTokensClaimable } = await getClaimable(rewardTokens, rewardShares, nftId1);

      const rewardSharesReward = amount(REWARDS_SHARES[0])
        .mul(big(51))
        .div(big(51 + 154));

      expect(rewardSharesClaimable).to.equal(rewardSharesReward);
      expect(rewardTokensClaimable).to.equal(0);

      await claimAndVerifyStaked(rewardWrapper, nft, nftId1, nftMinter1, rewardSharesReward);
    });

    it("When having shares and tokens staked, claim claims claimable from shares and from tokens staked", async () => {
      const { rewardSharesClaimable, rewardTokensClaimable } = await getClaimable(rewardTokens, rewardShares, nftId2);

      const rewardSharesReward = amount(REWARDS_SHARES[0])
        .mul(big(154))
        .div(big(51 + 154));
      const rewardTokensReward = amount(REWARDS_TOKENS[0]);

      expect(rewardSharesClaimable).to.equal(rewardSharesReward);
      expect(rewardTokensClaimable).to.equal(rewardTokensReward);

      const nftStakedExpected = rewardSharesReward.add(rewardTokensReward).add(amount(50000));

      await claimAndVerifyStaked(rewardWrapper, nft, nftId2, nftMinter2, nftStakedExpected);
    });
  });
});
