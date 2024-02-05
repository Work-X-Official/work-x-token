// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "./../interface/IRewarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NftNotOwned();

contract RewardWrapper is Ownable {
    IGenesisNft immutable nft;
    IRewarder[] public rewarder;

    event RewardersSet(address[] rewarders);
    /**
     * @notice Initializes the contract with given addresses.
     * @param _genesisNftAddress Address of the Genesis NFT contract.
     * @param _rewardAddresses Addresses of the reward contracts.
     */
    constructor(address _genesisNftAddress, address[] memory _rewardAddresses) {
        nft = IGenesisNft(_genesisNftAddress);
        for (uint256 i = 0; i < _rewardAddresses.length; ++i) {
            rewarder.push(IRewarder(_rewardAddresses[i]));
        }
    }

    /**
     * @notice Claims rewards on all reward contracts for a give nftId.
     * @param _nftId Id of the nft to claim rewards for.
     */
    function claim(uint256 _nftId) external {
        if (msg.sender != nft.ownerOf(_nftId)) {
            revert NftNotOwned();
        }

        for (uint256 i = 0; i < rewarder.length; ++i) {
            rewarder[i].claim(_nftId);
        }
    }

    /**
     * @notice Set the array of reward contracts.
     * @param _rewardAddresses Addresses of the reward contracts.
     */
    function setRewarders(address[] memory _rewardAddresses) external onlyOwner {
        delete rewarder;
        for (uint256 i = 0; i < _rewardAddresses.length; ++i) {
            rewarder.push(IRewarder(_rewardAddresses[i]));
        }
        emit RewardersSet(_rewardAddresses);
    }

    /**
     * Get the array of reward contract addresses.
     * @return rewarder array of reward contract addresses.
     */
    function getRewarders() external view returns (IRewarder[] memory) {
        return rewarder;
    }
}
