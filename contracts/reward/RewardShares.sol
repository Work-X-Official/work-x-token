// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./Reward.sol";

contract RewardShares is Reward {
    /**
     * @notice Initializes the RewardShares contract with the given addresses.
     * @param _genesisNftAddress The address of the Genesis NFT contract.
     * @param _workTokenAddress The address of the WORK token contract.
     */
    constructor(address _genesisNftAddress, address _workTokenAddress) Reward(_genesisNftAddress, _workTokenAddress) {}

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month and shares of the previous month.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonth Reward of a nftId for a specific month based on shares.
     */
    function getRewardNftIdMonth(
        uint256 _nftId,
        uint256 _month
    ) public view override returns (uint256 _rewardNftIdMonth) {
        if (_month == 0) {
            return 0;
        }
        uint256 monthPrev = _month - 1;
        (uint256 totalShares, , ) = nft.getTotals(monthPrev);
        if (totalShares == 0) {
            return 0;
        }

        uint256 nftIdShares = nft.getShares(_nftId, monthPrev);
        if (nftIdShares == 0) {
            return 0;
        }

        uint256 rewardTotalMonth = getRewardTotalMonth(_month);

        _rewardNftIdMonth = (nftIdShares * rewardTotalMonth) / totalShares;
    }
}
