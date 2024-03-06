# Setup Rewards

## Steps to setup reward contracts

### Deploying

1. Compile contracts and generate types:
   - `yarn compile`
   - `yarn typechain`
2. Deploy _RewardToken.sol_ contract and _RewardShares.sol_ contracts.
   - `yarn hardhat rewardtokens:deploy --network [network]`
   - `yarn hardhat rewardshares:deploy --network [network]`
3. Copy the reward token address and reward shares address to _reward.constants.ts_ file.
4. Deploy _RewardWrapper.sol_ contract with the new reward token and reward shares address.
   - `yarn hardhat rewardwrapper:deploy --network [network]`
5. Copy the reward wrapper address to _reward.constants.ts_ file.

### Further Setup

1. In _rewardLevelShares.ts_ call the task to fill the levelShares mapping, which maps from shares to levels.
   - `yarn hardhat reward:levelshares --network [network]`
2. In _rewardFund.ts_ call the task to fund the reward contracts with WORK tokens, check if the sender has enough WORK to do this, and check if the funding amounts are correct.
   - `yarn hardhat reward:fund --network [network]`
3. In _rewardApprove.ts_ call the task, it calls approve on the reward contracts, which increases the allowance of the nft contract to spend the WORK tokens form the reward contracts.

   - `yarn hardhat reward:approve --network [network]`

4. In _rewardRoles.ts_ , call the task to set the rewarders in the nft contract, here it is set in the nft contract which reward contracts can call the reward function on the nft.

   - `yarn hardhat nft:rewarder:set --network [network]`

5. In _rewardRoles.ts_ , call the task to specify in the rewarder contracts, which contract is the reward wrapper contract, needed because this allows the wrapper contract to call the claim function in these rewarder contracts.

   - `yarn hardhat reward:wrapper:set --network [network]`

6. In _rewardRoles.ts_ , call the task to specify in the reward wrapper contract the array of of rewarder contracts, needed so the wrapper knows which rewarder contracts to call the claim function on.
   - `yarn hardhat wrapper:rewarder:set--network [network]`
