// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./RewardBase.sol";

contract RewardShares is RewardBase {

    /**
     * @notice Initializes the RewardShares contract with the given addresses.
     * @param _genesisNftAddress The address of the Genesis NFT contract.
     * @param _workTokenAddress The address of the WORK token contract.
     */
    constructor(address _genesisNftAddress, address _workTokenAddress)
        RewardBase(_genesisNftAddress, _workTokenAddress){}

    /**
     * @notice Calculates how much a nftId is allowed to claim for a specific month by taking into account
     *  the rewards of this month, the nftIdShares and the totalShares at the end of the previous month, because this amount has been staked for at least this whole month.
     * @dev The amount of shares of a user is divided by the total shares. To find his percentage of the rewards of that month.
     * @param _nftId The id of the nft for which you want to find the claimable amount.
     * @param _month The month for which you want to find the claimable amount.
     * @return _rewardNftIdMonth The reward for a nftId for a specific month based on the minimum of the previous month.
     */
    function getRewardNftIdMonth(uint256 _nftId, uint256 _month) public view override returns (uint256 _rewardNftIdMonth) {
        if (_month == 0) {
            return 0;
        }

        (uint256 totalShares, , ) = nft.getTotals(_month-1);
        if (totalShares == 0) {
            return 0;
        }

        uint256 nftIdShares = nft.getShares(_nftId, _month-1);
        if (nftIdShares == 0) {
            return 0;
        }

        uint256 rewardTotalMonth = getRewardTotalMonth(_month);

        _rewardNftIdMonth = (nftIdShares * rewardTotalMonth) / totalShares;
    }
}
