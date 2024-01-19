// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

interface IRewarder {
    function claim(uint256 _nftId) external;
}
