// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

interface IGenesisNft {
    function reward(uint256 _tokenId, uint256 _amount) external;

    function getShares(uint256 _tokenId, uint256 _month) external view returns (uint256);

    function getStaked(
        uint256 _tokenId,
        uint256 _month
    ) external view returns (uint256 stakedAmount, uint256 stakedAmountMinimum);

    function getTotals(
        uint256 _month
    ) external view returns (uint256 _totalShares, uint256 _totalBalance, uint256 _minimumBalance);

    function getAirdropStartTime() external view returns (uint256);

    function startTime() external view returns (uint128);

    function ownerOf(uint256 tokenId) external view returns (address);

    function getCurrentMonth() external view returns (uint256);

    function monthlyTotal(
        uint256 _month
    ) external view returns (uint32 totalShares, uint128 totalStaked, uint128 minimumStaked);
}
