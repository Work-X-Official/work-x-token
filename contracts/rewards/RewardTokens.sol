// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./RewardBase.sol";

contract RewardTokens is RewardBase {

    /**
     * @notice Initializes the RewardTokens contract with the given addresses.
     * @param _genesisNftAddress The address of the Genesis NFT contract.
     * @param _workTokenAddress The address of the WORK token contract.
     */
    constructor(address _genesisNftAddress, address _workTokenAddress)
        RewardBase(_genesisNftAddress, _workTokenAddress){}

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month and the minimum staked of the previous month.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonth Reward of a nftId for a specific month based on tokens staked.
     */
    function getRewardNftIdMonth(uint256 _nftId, uint256 _month) public view override returns (uint256 _rewardNftIdMonth) {
        if (_month == 0) {
            return 0;
        }

        (, , uint256 totalMinimum) = nft.getTotals(_month-1);
        if(totalMinimum == 0) {
            return 0;
        }

        (, uint256 nftIdMinimum) = nft.getStaked(_nftId, _month-1);
        if (nftIdMinimum == 0) {
            return 0;
        }

        uint256 rewardTotalMonth = getRewardTotalMonth(_month);

        _rewardNftIdMonth = (nftIdMinimum * rewardTotalMonth) / totalMinimum;
    }
}
