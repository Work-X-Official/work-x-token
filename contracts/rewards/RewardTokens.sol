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
     * @notice Calculates how much a nftId is allowed to claim for a specific month based on the amount of minimum amount of tokensstaked in a month.
     * @dev The loop over the months from current to previous months is done to find the minimum  value that a user staked in that month.
     * @param _nftId The id of the nft for which you want to find the claimable amount.
     * @param _month The month for which you want to find the claimable amount.
     * @return _rewardNftIdMonth The reward for a nftId for a specific month based on the minimum of the previous month.
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
