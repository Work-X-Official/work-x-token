// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

interface ITokenDistribution {
    function setTotalClaimed(address wallet, uint256 totalClaimed) external;
}
