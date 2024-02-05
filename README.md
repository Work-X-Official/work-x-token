# Work X

## Pre Requisites

Before running any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. Follow the example in `.env.example`.

Then, proceed with installing dependencies:

```sh
yarn
```

## Compile

Compile the smart contracts with Hardhat:

```sh
yarn compile
```

## Generate Types

Generate the smart contract types with TypeChain:

```sh
yarn typechain
```

## Lint Solidity

Lint the Solidity code:

```sh
yarn lint:sol
```

## Lint TypeScript

Lint the TypeScript code:

```sh
yarn lint:ts
```

## Test

```sh
yarn test
```

# Setup

## Steps to setup the Reward contracts

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

1. In _rewardFund.ts_ call the task to fund the reward contracts with WORK tokens, check if the sender has enough WORK to do this, and check if the funding amounts are correct.

   - `yarn hardhat reward:fund --network [network]`

2. In _rewardApprove.ts_ call the task, it calls approve on the reward contracts, which increases the allowance of the nft contract to spend the WORK tokens form the reward contracts.

   - `yarn hardhat reward:approve --network [network]`

3. In _rewardRoles.ts_ , call the task to set the rewarders in the nft contract, here it is set in the nft contract which reward contracts can call the reward function on the nft.

   - `yarn hardhat nft:rewarder:set --network [network]`

4. In _rewardRoles.ts_ , call the task to specify in the rewarder contracts, which contract is the reward wrapper contract, needed because this allows the wrapper contract to call the claim function in these rewarder contracts.

   - `yarn hardhat reward:wrapper:set --network [network]`

5. In _rewardRoles.ts_ , call the task to specify in the reward wrapper contract the array of of rewarder contracts, needed so the wrapper knows which rewarder contracts to call the claim function on.
   - `yarn hardhat wrapper:rewarder:set--network [network]`

# Documentation

## Contents

1. [Work X Token](#work-x-token)
2. [Genesis NFT](#genesis-nft)
   - [Contracts](#contracts)
   - [Minting](#minting)
     - [Introduction to Minting](#introduction-to-minting)
     - [Minting Functionality](#minting-functionality)
       - [Detailed Description of the Minting Mechanism](#detailed-description-of-the-minting-mechanism)
       - [Associated Functions](#associated-functions)
   - [Staking](#staking)
     - [Introduction to Staking](#introduction-to-staking)
     - [Staking Functionality](#staking-functionality)
       - [Detailed Explanation of Staking Mechanism](#detailed-explanation-of-staking-mechanism)
       - [Associated Functions](#associated-functions)
     - [Unstaking Functionality](#unstaking-functionality)
       - [Detailed Explanation of Unstaking Mechanism](#detailed-explanation-of-unstaking-mechanism)
       - [Associated Functions](#associated-functions)
     - [Destroying Functionality](#destroying-functionality)
       - [Detailed Explanation of Destroying](#detailed-explanation-of-destroying)
       - [Associated Functions](#associated-functions)
     - [Evolving Functionality](#evolving-functionality)
       - [Detailed Explanation of Evolving](#detailed-explanation-of-evolving)
       - [Associated Functions](#associated-functions)
     - [NFT Display](#nft-display)
       - [Displaying and Interacting with Staked NFTs](#displaying-and-interacting-with-staked-nfts)
       - [Associated Functions](#associated-functions)
   - [Rewarding System](#rewarding-system)
     - [Description Rewarding System](#description-rewarding-system)
     - [Reward Shares Calculation](#reward-shares-calculation)
       - [Factors Influencing Reward Size](#factors-influencing-reward-size)
       - [Associated Functions](#associated-functions)
     - [Reward Tokens Calculation](#reward-tokens-calculation)
       - [Factors Influencing Reward Size](#factors-influencing-reward-size-tokens)
       - [Associated Functions](#associated-functions)
     - [Claiming Rewards](#claiming-rewards)
       - [Process of Claiming Rewards](#process-of-claiming-rewards)
       - [Associated Functions](#associated-functions)

# Work X Token ($WORK)

- Contract: `WorkToken.sol`
- Description: The WorkToken contract features an ERC20 token with capped supply, burnable functionality, and role-based access control.

## Contract Specifications

- Inherits: `ERC20Capped`, `ERC20Burnable`, `AccessControl` from OpenZeppelin.
- Token Name: Work X Token.
- Token Symbol: WORK.
- Token Cap: 100 million WORK.

## Functionalities

### Initialization

- Functionality: Establishes initial settings and roles.
- Associated Functions:
  - `constructor`: Sets token name, symbol, cap, and grants `DEFAULT_ADMIN_ROLE`.
- Security considerations: Assigning DEFAULT_ADMIN_ROLE during construction is crucial for secure management of the contract, laying the foundation for role governance and mitigating risks of unauthorized access from the start.

### Token Minting

- Functionality: Establishes initial settings and roles.
- Associated Functions:
  - `mint`: Enables addresses with `MINTER_ROLE` to mint new tokens.
  - `_mint`: Internal function overridden from ERC20Capped to handle the actual minting process.
- Security considerations: Restricting minting capabilities to MINTER_ROLE holders is essential to prevent unauthorized token issuance. The security of minting relies on stringent role management.

### Supply Capping

- Functionality: Imposes a maximum limit on the total token supply.
- Associated Functions:
  - `ERC20Capped`: An inherited function that enforces the supply cap.
- Security considerations: The cap is fundamental to preserving the token's value and preventing unlimited inflation.

### Token Burning

- Functionality: Allows token holders to permanently remove tokens from circulation.
- Associated Functions:
  - `burn`: Enables token holders to destroy a portion of their tokens.
  - `burnFrom`: Allows a third party to burn tokens with the token holder's approval.
- Security considerations: Token burning requires careful communication to ensure users are aware of its impact.

### Role Management

- Functionality: Manages access control for critical functionalities.
- Associated Functions:
  - `grantRole`, `revokeRole`, `renounceRole`: Functions from the AccessControl module used to manage roles like MINTER_ROLE.
- Security considerations: Proper role management is vital to ensure that only authorized parties have access to sensitive functions like minting.

## Functional Correlations and Security

- Minting and Supply Limit: Minting, governed by `mint` and `_mint`, is constrained by the supply cap established in `ERC20Capped`. This interaction is crucial to prevent over-issuance and maintain the token's economic health.

- Burning and Supply Limit: `burn` and `burnFrom` enable a mechanism for reducing token supply, but do not affect the maximum supply limit set by `ERC20Capped`. The cap ensures that the total possible supply, accounting for any minted and burned tokens, does not exceed the predefined limit. This relationship between minting and burning directly impacts the available token supply.

# Genesis NFT

## Contracts

### GenesisNft.sol

The GenesisNft contract is an ERC721 token with advanced features like minting with staking options, tier-based evolution, and a reward mechanism. This contract integrates unique functionalities that allow for dynamic interaction with the NFTs, including token staking directly into the NFTs, evolving tiers based on staked tokens, and a system for rewarding NFT holders.

- Contract Specification
  - Inherits: ERC721, Ownable, EIP712, IERC4906 from OpenZeppelin.
  - Integration:
    - Interacts with IWorkToken for token-related functionalities.
    - Utilizes ITokenDistribution for managing token claims.
    - Integrates with GenesisNftData for NFT data computations.
  - Main Functionalities:
    - NFT minting with staking options and tier-based evolution.
    - NFT reward mechanism and locking period management.
    - Dynamic token URI generation based on NFT attributes and status.

### GenesisNftData.sol

The GenesisNftData contract functions as a data management and computation tool for Genesis NFTs, handling attributes, levels, and staking-related calculations.

- Contract Specification
  - Inherits: None.
  - Integration: Utilizes GenesisNftAttributes for attribute management.
  - Main Functionalities:
    - Level and tier calculations based on staked tokens.
    - Token requirements computation for different levels and tiers.
    - Attribute decoding from encoded format.
    - Generation of token URI for Genesis NFTs, integrating level, tier, staking, and attributes data.

### GenesisNftAttributes.sol

The GenesisNftAttributes contract offers a comprehensive range of predefined attributes for Genesis NFTs, including varied options in categories like gender, body, profession, and accessories, to augment the distinctiveness and individuality of each NFT.

- Contract Specification

  - Inherits: None.
  - Main Functionalities:

    - Provides predefined attributes for Genesis NFTs in various categories, enhancing NFT uniqueness.
    - Categories include gender, body, profession, accessories, background, eyes, hair, mouth, complexion, items, and clothing.
    - Each category contains multiple options, encoded as bytes32 arrays, for extensive customization.

### RewardTokens.sol

The RewardTokens contract, a variation of RewardBase, is tailored for calculating and distributing monthly rewards for Genesis NFTs based on the amount of tokens staked.

- Contract Specification
  - Inherits: Inherits from Ownable (OpenZeppelin) and IRewarder (custom interface).
  - Integration:
    - IGenesisNft interface for NFT operations on GenesisNft.
    - IWorkToken interface for operations on WorkToken.
    - Utilizes IERC20 for token-related operations.
  - Main Functionalities:
    - Claiming staked token rewards related to the $WORK token
    - Calculation of NFT rewards based on tokens staked in the previous month.
    - Determination of monthly rewards for each Work X GenesisNft related to staked tokens.

### RewardShares.sol

The RewardShares contract, also based on RewardBase, is specifically designed for calculating and distributing monthly rewards for Genesis NFTs, but it focuses on the number of shares held in the NFTs.

- Contract Specification
  - Inherits: Inherits from Ownable (OpenZeppelin) and IRewarder (custom interface).
  - Integration:
    - IGenesisNft interface for NFT operations on GenesisNft.
    - IWorkToken interface for operations on WorkToken.
    - Utilizes IERC20 for token-related operations.
  - Main Functionalities:
    - Claiming shares and level rewards related to the $WORK token
    - Calculation of rewards based on the number of shares held in the previous month.
    - Calculation of rewards based on the level in the previous month.
    - Computation of monthly rewards for each Work X GenesisNft related to shares and level.

### RewardWrapper.sol

The RewardWrapper contract acts as wrapper for managing multiple reward contracts associated with Work X Genesis Nfts. It facilitates the claiming of rewards from various rewarder contracts for a specific NFT id.

- Contract Specification
  - Inherits: Extends from Ownable (OpenZeppelin).
  - Integration:
    - GenesisNft contract for NFT ownership verification.
    - Multiple IRewarder contracts for handling different reward mechanisms.
  - Main Functionalities:
    - Facilitates the claiming of rewards from various rewarder contracts for a specific NFT.
    - Allows setting and updating of multiple rewarder contracts.
    - Provides functionality to claim rewards across all integrated rewarder contracts for an NFT.

## Interfaces

### ITokenDistribution.sol

The ITokenDistribution interface defines methods for managing and querying the total claimed tokens associated with wallet addresses.

### IWorkToken.sol

The IWorkToken interface specifies key functions for minting, transferring, and querying the balance of WORK tokens.

### IGenesisNft.sol

The IGenesisNft interface specifies key functions for rewarding, and obtaining Work X Genesis Nft information like shares, staked tokens, and level.

## Minting

### Introduction to Minting

In the GenesisNft contract, a total of 999 NFTs can be minted, with the first NFT having an ID of 0. To mint an NFT, a user must first receive a voucher from Work X. The voucher contains a voucher ID and a signature. Only users with a valid voucher are permitted to mint an NFT.

The voucher includes information such as the type of NFT, the duration for which tokens will be locked in the NFT, the recipient of the NFT, and the initial amount of WORK tokens staked in the NFT. When an NFT is minted, it is assigned a level and a tier based on the number of tokens staked during the minting process. There are 8 tiers, each with 10 levels, and the level of an NFT depends on the amount of tokens staked.

Each NFT also has an attribute called "shares", which increases in quantity as more tokens are added to the NFT. Any remaining NFTs that are not minted by users using a voucher can be minted by the owner to the Work X treasury.

### Minting Functionality

#### Detailed Description of the Minting Mechanism

Each account receiving a voucher can only mint once. In the `GenesisNft.sol` contract, an `vouchersigner` address is set. During the minting process, it is verified if the voucher is signed by the `vouchersigner`. The NFTs will never be locked for more than 550 days, and there will never be more than 999 NFTs. There are three types of NFTs: Guaranteed spots, first come first serve, and work investors. The limits for each type are 400, 150, and 449 NFTs, respectively. However, if a type is not fully minted, the remaining spots are made available for the next type.

When a minter is eligible for tokens according to the `TokenDistribution` contract, they can mint a maximum amount of WORK into the NFT, provided that this amount is stated in the signed voucher. Based on this amount, the minter receives an additional amount of shares in their NFT, in addition to the base stake of 50 shares for each NFT.

The amount of shares and tokens is tracked on a monthly basis. Therefore, when minting, values such as your shares and staked tokens are stored, and the monthly shares and staked tokens are updated for the current month.

#### Associated Functions:

- `GenesisNft.mintNft`: This function allows users to mint and directly stake into the NFT. It first checks if a mint with these parameters is allowed, then mints the NFT and updates the `nftIdCounter`. It also mints the WorkToken directly in this contract and the NFT with `safemint`. When tokens are directly minted in this contract, it updates the `claimedTokens` amount using `tokenDistribution.setTotalClaimed`.
- `GenesisNftData.getLevel`: Calculates the level that the NFT receives based on the amount of staked tokens.
- `GenesisNft.mintRemainingNfts`: This function can be called by the contract owner to mint the remaining NFTs to the treasury. It can only be done before the `startTime` and before initialization is finished, by setting `initCompleted` to true.
- `GenesisNft._hashMint`: This function hashes the voucher values, which include the information checked when minting the NFT.
- `GenesisNft._verify`: This function verifies if the digest created by `_hashMint` was signed by the `vouchersigner` address.

## Staking

### Introduction to Staking

The GenesisNft contract provides functionality for staking and unstaking WORK tokens. Additionally, it includes staking during the mint process. However, there are certain limitations on the amount that can be staked and unstaked, based on specific rules.

To stake tokens, you must have a sufficient staking allowance and possess WORK tokens. Conversely, you can only unstake tokens when you have reached the maximum level in a tier, and it is not possible to lower your level.

Furthermore, you have the option to destroy your NFT, which will result in the burning of the NFT and the return of your staked tokens. This can be done at any time.

Once enough tokens have been staked in your NFT, you can evolve it to the next tier. This evolution can increase your level and the amount of shares you hold

Note, when you stake/unstake in the contract your staked value and shares are updated for that specific month and the minimum tokens staked in that specific month are also updated.

### Staking Functionality

#### Detailed Explanation of Staking Mechanism

Staking WORK tokens can be done through individual NFTs. When staking, the first step is to check the staking allowance. Only NFT owners can stake. The staking allowance is calculated as 294 tokens per day, starting from the starttime, minus the tokens currently staked in this NFT (excluding the tokens staked during the minting process). When your NFT is level 80, you will not be limited to the staking allowance.

After verifying the staking allowance requirement, your amount of staked tokens and shares for that month will be updated. The monthly values will be used for rewards. It involves updating the amount of tokens you have staked in a given month by adding the staking amount to the previous amount of tokens you had staked.

Additionally, it keeps track of the minimum amount of tokens staked in a month. If this minimum has not been set yet in the current month, it will be updated to the amount of tokens you had staked in a previous month, as that is currently the minimum amount of tokens staked during this month.

The monthly total staked and the monthly sum of all minimum tokens staked by all NFTs will also be updated based on the changes in staked amount and minimum staked tokens for this NFT. Staking will also update your shares. The shares for this month will be updated based on whether your level has increased, and the monthly total shares will be updated based on how much your shares have changed.

After all the monthly values have been updated, the WORK tokens will be transferred from the staker to the NFT contract.

#### Associated Functions:

- `GenesisNft.stake`: Stakes an amount of tokens into an NFT it uses the `_checkAllowance` function to check if staking is allowed and then uses the internal function `_stake` to stake.
- `GenesisNft._checkAllowance`: Checks if you are the nft owner and also checks if you are currently allowed to stake based on if your current stake is less than your staking allowance.
- `GenesisNft._stake` Updates the staked, mininum staked, and updates your shares for this nft in the current month using `_updateMonhtly` and `updateShares` and then transfers WORK tokens to the NFT contract with `transfer`.
- `GenesisNft._updateMonthly` Updates the amount of tokens and the minimum amount of tokens staked in a month. It searches back through the previous months until it finds a month with a staked value with `getStaked`. These values serve as a basis for the update. Then the staked amount increases by the amount being staked, while the minimum is set to the staked value when we loop back. Then staking, the staked amount increases and the minimum is set to the correct monthly minimum. However, the minimum is not increased by the stake amount. The monthly total staked is increased with the staked amount, but the sum of all monthly minima is only updated with the correct minimum value when it has not been set yet.
- `GenesisNft.getCurrentMonth` returns the current month since the startdate each month is 30 days.
- `GenesisNft.getStaked` Returns the amount of tokens staked and the minimum staked amount from an NFT in a specific month. It iterates through the months to find a month where tokens are staked, and then returns the staked amount and the minimum staked amount for that month. When the function loops back, it indicates that the staked amount in the previous month is also the minimum amount staked for the specific month.
- `GenesisNft._updateShares` Update shares, it looks back over previous months to find your last amount of shares with `getShares`. Then it calculates your new amount of shares. and updates the total amount of shares in that month with the difference.
- `GenesisNft.getShares` Returns the amount of shares for a tokenId in a given month. It loops back over the months to find the most recent updates value and then returns this amount of shares.
- `WorkToken.transfer` The ERC20 transfer method is used to transfer the WORK tokens from the NFT owner into the NFT contract.
- `GenesisNft.stakeAndEvolve`: This is the same as function `stake` but immediately followed by the function `evolveTier`. More on `_evolveTier` in a later section.

### Unstaking Functionality

#### Detailed Explanation of Unstaking mechanism

Unstaking in this system is initiated by the NFT owner and is subject to several conditions. Firstly, it checks if the unstaking request is within the lock period, starting from a predetermined time. If it's within this period, the request is denied.

The next step involves evaluating the staked amount for the NFT in the current month and considering the NFT's tier. Unstaking is limited to the surplus tokens beyond the minimum required for level 10 in the current tier.

Upon successful validation, the system updates the monthly staking records by deducting the unstaked amount and marking the withdrawal. It does not have to set the update the shares, because shares cannot go down.

The tokens are then transferred back to the NFT owner. If the transfer fails, the process is reverted.

#### Associated Functions:

- `GenesisNft.unstake`: NFT owner unstakes an amount of tokens from an NFT with a specific tokenId, it only unstakes when the NFT is unlocked. Then it checks how many tokens are staked with `getStaked` and then it checks the minimum tokens that have to be kept staked based on the tier. If your unstake amount is allowed it calls `updateMonthly` and then transfers the WORK tokens back to the NFT owner.
- `GenesisNft.ownerOf` returns the owner of a tokenId to determine if unstaking is allowed.
- `GenesisNft.getStaked` Already described before.
- `GenesisNft.getCurrentMonth` Already described before.
- `GenesisNft._updateMonthly` Similar to with staking it first finds the currently staked amount and current staked minimum of a month using `getStaked` . When unstaking, the newly staked amount is found by deducting the unstake amount and the newly minimum staked in a month for this nft, can be found by comparing the current minimum in a month and checking if the newly staked amount in that month is less then the minimum has to be updated to this new staked amount in this month. The monthly total is also updated by subtracting the unstake amount and the monthly sum of all the mimima is updated when an individual monthly minimum is decreased.
- `WorkToken.transfer` The ERC20 transfer method is used to transfer the tokens back to the NFT owner.

### Destroying Functionality

- Detailed Explanation of Destroying

The destroy functionality in this system enables NFT owners to permanently delete their NFT and recover the staked tokens, akin to smashing a piggy bank. It starts by confirming the initiator's ownership, preventing unauthorised destruction. The system then checks if the NFT is past a predefined lock period, ensuring it's not destroyed prematurely. If this condition is met, the process moves forward.

Next, the system calculates the total staked tokens in the NFT until the current month, indicating the amount to be returned to the owner. Subsequently, it updates its records, adjusting the staked and shared values for both the individual NFT and the overall system, maintaining accuracy post-destruction.

The NFT is then irreversibly removed from the blockchain. Finally, the staked tokens are transferred back to the owner. If this transfer fails, the process reverts, safeguarding the owner's tokens.

#### Associated Functions

- `GenesisNft.destroyNft`: Allows the NFT owner to burn the NFT and retrieve the tokens staked within it. Destruction is permitted only if the `lockPeriod` has elapsed since the `startTime`. This function utilizes `getCurrentMonth` and `getStaked` to determine the current staked amount in the NFT, then employs `updateMonthly` and `updateShares` to revise the staked amount and shares. It permanently deletes the NFT using `_burn` and subsequently uses `transfer` to move the tokens to the owner.
- `GenesisNft.ownerOf`: Returns the owner of a tokenId, which is essential to verify if the destruction of the NFT is permissible.
- `GenesisNft.getStaked`: Already described previously.
- `GenesisNft.getCurrentMonth`: Already described previously.
- `GenesisNft._updateMonthly`: Adjusts the monthly staked amount and the monthly minimum staked amount. In the context of destruction, it sets the staked amount for the NFT in the current month to zero, and likewise for the minimum, as no tokens remain staked. It then updates the monthly total staked by subtracting the amount previously staked by this NFT, and the sum of monthly minimums is adjusted by deducting this NFT's monthly minimum.
- `GenesisNft._updateShares`: Reduces the total shares by the share amount of the NFT and sets the shares for this NFT to zero.
- `GenesisNft._burn`: The standard ERC721 internal function used for destroying the NFT.
- `WorkToken.transfer`: The ERC20 transfer method utilized for returning the tokens to the NFT owner.

### Evolving Functionality

#### Detailed Explanation of Evolving

The Evolve Tier functionality enables an NFT to increase its tier based on the staked tokens. The system comprises eight tiers, each containing ten levels. As tokens are staked, the NFT's level within its current tier increases. Reaching level 10 in a tier and staking additional tokens allows will not increase your level more, the tier remains unchanged until the tier evolution is activated.

When an NFT owner decides to evolve their NFT's tier, the system recalculates the tier based on the total staked tokens. This can lead to the NFT advancing multiple tiers, depending on the staked amount. This recalculated tier results in an adjustment of the NFT's 'shares' property, which influences the owner's share of rewards in the system. By staking more tokens and evolving the tier, owners can enhance their NFT's position, achieving higher tiers and thus increasing their 'shares', without changing the amount of tokens currently staked.

#### Associated Functions:

- `GenesisNft.evolveTier`: This function enables the NFT owner to evolve the tier if the staked tokens are sufficient for a tier increase. It confirms NFT ownership using `ownerOf` and then calls `_evolveTier` to implement the tier change.
- `GenesisNft.ownerOf`: This function identifies the owner of a tokenId, crucial for determining if the sender is authorized to evolve the tier.
- `GenesisNft._evolveTier`: Retrieves the current month's staked amount in the NFT, then calculates the current tier by dividing the level obtained from `getLevel` by ten. Once the tier is set, the NFT's shares for the current month are updated accordingly.
- `GenesisNft._updateShares`: Similar to staking, this function calculates the new amount of shares based `getLevelCapped` , which returns the level based on the staked amount and the current tier. Then, it adjusts the NFT's share amount for the month, and increases the total shares proportionate to the rise in the NFT's shares.
- `GenesisNftData.getLevelCapped` Returns the level of the NFT based on the amount of tokens staked capped by the tier, so after increasing the tier, this function can return a higher level.
- `GenesisNftData.getLevel`: Determines the level of an NFT based on the staked tokens. This level is not constrained by the tier. Dividing the level by 10 identifies the current tier.

### NFT Display

#### Displaying and Interacting with Staked NFTs

NFT images in this system are hosted on IPFS, with their identifier integrated into the `GenesisNft`. This integration enables dynamic generation of each NFT's tokenURI, which is essential for displaying real-time data from the smart contract, including tokens staked, shares, tier, and lock time.

Before revealing, the NFT contract owner sets the NFTs' encoded attributes. When displaying the attributes it decoded into readable traits like gender, body, profession, and more, using the `GenesisNftData` and `GenesisNftAttributes` contracts. Post-initialization, these attributes are fixed and unchangeable.

The tokenURI function dynamically generates each NFT's URI, reflecting its current level, tier, staked tokens, shares, and unlock time, along with its image URI for visual representation. This setup ensures that the NFT metadata is both comprehensive and current, aligning with the NFT's ongoing interactions with the smart contract.

#### Associated Functions

- `GenesisNft.tokenURI`: This function consistently returns the tokenURI for a specific NFT, conforming to the ERC721 standard. Unlike typical implementations, the URI here is dynamically generated. It starts by gathering NFT information using `getNftInfo` and `getLevelCapped`, and accessing data from the `nft` mapping. Subsequently, `tokenUriTraits` formats this information into a URI.
- `GenesisNft.getNftInfo`: Provides the staked amount and the number of shares associated with a specific NFT.
- `GenesisNftData.getLevelCapped`: Previously described.
- `GenesisNftData.tokenUriTraits`: This function compiles various details to be displayed in the tokenURI, including tokenId, level, tier, staked amount, shares, encodedAttributes, unlockTime, and the imageURI. It employs subfunctions like `part1`, `part2`, and `_getImageUri` to piece together parts of the tokenURI.
- `GenesisNftData.decodeAttributes`: It processes the encoded bytes of an NFT, converting them into an array. Using this array, it retrieves attributes by reading from the `GenesisNftAttributes` contract. Before the completion of the initialisation process, all attributes are represented as ‘?’.

# Rewarding System

## Description Rewarding System

This system's rewarding mechanism accumulates rewards for NFTs on a monthly basis, starting from a predefined initiation point. The reward allocation for each NFT is influenced by three key factors: the level at the end of the month, the shares held at the end of each month and the minimum token amount staked in that NFT for the respective month The privilege of claiming these rewards is exclusive to NFT owners.

The process of claiming involves the calculation of tokens that can be claimed for a specific NFT. Once the claim is successful, these tokens are moved from the reward contract to the NFT contract. This transfer can potentially enhance the NFT's level, leading to a compounding effect on future rewards. These claims can be processed either separately through the `RewardTokens` or `RewardShares` contracts, or collectively via the `RewardWrapper` contract.

The `RewardTokens` contract determines the reward share by assessing the minimum tokens staked in the preceding month. If this metric is not previously established, the contract considers the last month when the NFT's staked amount was recorded. The reward for an individual is then calculated by proportionally dividing this amount by the aggregate of the minimum amounts staked across all NFTs.

The RewardShares contract allocates rewards based on an NFT's previous month's shares and level. It compares an NFT's shares to the total, distributing rewards proportionally. Additionally, NFTs receive a monthly level-based reward, calculated as a constant multiplied by the previous month's level, complementing the share-based rewards.

It is essential for the RewardContracts to approve the NFT contract to utilize the work tokens of the rewardContracts and for the NFT contract to set which addresses are rewarders.

## Reward Calculation (Subject to Change)

## Factors Influencing Reward Size

Rewards are calculated for each NFT at the end of every month and can be claimed at the same time. The aggregate monthly reward is apportioned among all NFTs, based on their individual shares and token contributions. The first month, identified as 'month 0', does not allocate any rewards. From the second month (month 1) onwards, rewards for tokens are computed using the formula: (40000 - sqrt(month \* 40000000)) \* 10 / 4. This formula, a decreasing function, aims to allocate 1,386,516 WORK tokens across 40 months. For instance, in month 1, the formula results in the distribution of 100,000 WORK tokens for staked tokens. The details of the monthly reward distribution for subsequent months can be found in the rewards array within the RewardTokens contract. An NFT's monthly reward is determined based on its relative stake in comparison to the total staked tokens, and these rewards are cumulative. When calculating the tokens an NFT can claim, the system aggregates the rewards for all the months for which claims have not been made.

Similarly, the rewards based on shares start from zero in month 0. From month 1 onwards, they are calculated using the formula: (40000 - sqrt(month \* 40000000)) \* 10 / 8. This decreasing function is intended to distribute 693,261 WORK tokens over 40 months. In month 1, for example, 50,000 WORK tokens are allotted for shares. The rewards array in the RewardShares contract provides details about the monthly distribution for subsequent months. The monthly reward for an NFT is based on its share proportion relative to the total shares. These rewards, too, accumulate over time. For calculating claimable tokens, the system sums up the rewards for all unclaimed months for an NFT.

Level-based rewards start at zero in month 0. From month 1, they are calculated as eight times the NFT's previous month level. This consistent calculation method does not diminish over time, setting it apart from other rewards which are divided over 40 months. This level-based reward operates on a first-come-first-serve basis and continues until the total 693,261 allocated for level rewards is fully distributed.

#### Associated Functions

`RewardShares.getSharesRewardTotalMonth`: This function computes the total monthly share-based rewards distributed equally across all NFT shares by `RewardShares`. Initially zero in month 0, it utilizes the rewards array for subsequent months.
`RewardTokens.getTokensRewardTotalMonth:` This function determines the total monthly token-based rewards distributed equally among all staked tokens by `RewardTokens`. Starting from zero in month 0, it incorporates the rewards array in the following months.

### Reward Shares Calculation

#### Monthly Reward Calculation Based on Shares

For an NFT, monthly rewards are calculated based on the NFT's share of the total rewards for that month. This share is determined by two factors: the NFT's shares from the previous month and the total shares from the previous month.

The system first obtains the NFT's shares for the preceding month. If these shares are not set for that month, it backtracks to find the last month where the NFT's shares were recorded. In parallel, it calculates the total shares for the previous month, again backtracking if necessary to find a month with recorded total shares.

The NFT's share of the total rewards is then calculated by dividing its shares by the total shares of the previous month. This ratio is multiplied by the total rewards for the current month to determine the NFT's reward amount. This process ensures that rewards are distributed proportionally based on the NFT's historical participation.

#### Monthly Reward Calculation Based on Levels

Level-based rewards are nonexistent in month 0. From month 1 onwards, each NFT's reward is calculated as its previous month's level multiplied by a constant of 8. This linear increase incentivizes leveling up. For example, an NFT's level in month 0, multiplied by 8, determines its month 1 reward. The level for each month is derived from that month's shares, linking shares to level progression.

#### Associated Functions

- `RewardShares.getRewardNftIdMonth:` It calculates the monthly rewards for a specific NFT. Both the reward for this NFT for this month earned by its shares, returned as `_rewardNftIdMonthShares`, as well as the reward for this NFT for this month earned by its level. In month 0, both of these will be 0. After that it will check the shares from the previous month using the `getShares` function, if the NFT did not have any shares both will be 0. If there are shares then the reward from shares is `_getSharesReward`. You only have level rewards if you have more than 51 shares. If you have more then 51 shares and not all level rewards have been claimed yet. Then, it will calculate reward for the level with `getLevelsReward`.
- `GenesisNft.getShares:` Determines an NFT's shares for a specified month. If not set, it backtracks to find the last recorded month, ensuring continuous share calculation.
- `RewardShares._getSharesReward:` Calculates the share-based reward by comparing an NFT's shares from the previous month to the total shares (getTotals) and the total available rewards for the current month (getSharesRewardTotalMonth).
- `GenesisNft.getTotals:` Retrieves the total shares for a specific month, resorting to previous months' data if current data is unavailable.
- `RewardShares._getLevelsReward:` : This function calculates an NFT's level reward for the current month by multiplying its level from the previous month by 8. The previous month's level is determined by mapping the NFT's shares from the previous month to the level, using the levelShares mapping.

### Reward Tokens Calculation

#### Monthly Reward Calculation Based on Tokens

For an NFT, monthly rewards based on tokens are calculated by assessing the minimum tokens staked in the previous month and the total minimum staked across all NFTs for that same month. If the total minimum for a month isn't set, the system uses the total balance of that month of an earlier month.

The reward for each NFT is then calculated as a proportion of the total rewards for the current month. This proportion is based on the NFT's share of the total minimum staked tokens. The result is the NFT's reward amount for the month, reflecting its contribution through token staking.

#### Associated Functions

- `RewardTokens.getRewardNftIdMonth:` Calculates monthly rewards for an NFT by first determining the total minimum staked tokens from the previous month. If not available, it uses the total balance of a past month as the minimum. It then finds the individual NFT's minimum staked tokens and the total available rewards for the current month, combining these to compute the NFT's reward.
- `GenesisNft.getTotals:` Determines the total shares for a given month. If data for the current month is missing, it looks back to previous months to maintain continuous calculation of total shares.
- `GenesisNft.getStaked:` Calculates an NFT's minimum staked amount for a specific month, looping back to prior months to find a staked balance if the current month's data is unavailable.
- `RewardTokens.getRewardTotalMonth:` Computes the total rewards to be distributed across all staked tokens for a particular month, defining the reward pool for that period.

## Claiming Rewards

#### Process of Claiming Rewards

The reward system allows NFT owners to claim rewards through the `RewardTokens` or `RewardShares` contracts, or collectively using the `RewardWrapper` contract. The process begins with a verification step, ensuring the claimant is either the NFT owner or an authorized party, such as the RewardWrapper.

For each NFT, the system calculates the claimable rewards based on the accumulated rewards since the last claim. This involves summing the rewards for all unclaimed months. If there are claimable rewards, these are added to the claimed tokens for the respective NFT. The rewards are then transferred to the NFT contract through the `nft.reward` function, which facilitates the staking of tokens into any NFT, potentially enhancing its level.

The `RewardWrapper` contract streamlines this process by enabling the claiming of rewards from both `RewardTokens` and `RewardShares` in a single transaction. This requires setting the addresses of these contracts in the `RewardWrapper`, and similarly, these contracts must acknowledge the `RewardWrapper` as an authorized claimant.

#### Associated Functions

- `RewardTokens.claim:` Claim rewards for all unclaimed months. `getClaimable` calculates all rewards earned from staking tokens in the months, since the last claim and transfer the claimable amount to the NFT contract.
  -RewardShares.claim`: Claim rewards for all unclaimed months. `getClaimable` calculates all rewards earned from both shares and levels seperately in the months, since the last claim. If there is a claimable reward from the level, it will add these tokens up to the total claimed tokens for the level. After it will transfer the claimable amount to the NFT contract.

- `RewardTokens.getClaimable:` Calculates `_claimable` , which is all rewards that have not been claimed yet. The function first gets the currentMonth, and then starts looping over the months from the month after the last month in which the NFT claimed, which is initialized to zero, so the loop starts looking from the first month. In each month it calculates the reward for that month using `getRewardNftIdMonth` and adds it to the total claimable.

- `RewardShares.getClaimable:` Calculates both `_claimableShares` and `_claimableLevels`, which are all rewards that have not been claimed yet. Similar to getClaimable in RewardTokens, the function loops from next month since last claim up to the current month. In each month it calculates the reward from shares and levels for that month using `getRewardNftIdMonth` and adds that month's reward to the corresping total clamable which is the claimable reward from shares to `claimableShares` and the claimable reward from levels to `claimableLevels`.

- `GenesisNft.setRewarder`: Function for specifying rewarder addresses, such as `RewardTokens`, `RewardShares`. This function designates specific addresses as authorized to stake tokens into any NFT, which gives a it different staking restrictions.
- `RewardTokens.approve/RewardShares.approve`: Approves the NFT contract to spend WORK tokens from these reward contracts, enabling the transfer of rewards to the NFTs.
- `RewardWrapper.setRewarder`: Specify the address of the `RewardWrapper` contract. This is a vital step to allow the `RewardWrapper` to claim rewards on behalf of NFT owners.
- `rewardWrapper.claim`: Claim rewards from all related reward contracts for a specific NFT. The necessary reward contract addresses are set via the `setRewarders` function.
