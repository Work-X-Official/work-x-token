// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "../work/WorkToken.sol";

error SwapAmountZero();
error BurnFailed();
error TransferFailed();
error SwapAmountUnavailable();
error SwapAmountAllowanceInsufficient();

/**
 * @title The Work X $WORK SwapV2 contract to upgrade from V1 to V2.
 * @notice This contract is used to upgrade $WORK tokens from V1 to V2
 * @dev The full amount of V1 tokens is burned and the same amount of V2 tokens is sent to the account interacting with the conract.
 **/
contract SwapV2 {
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    WorkToken public immutable workTokenV1;
    WorkToken public immutable workTokenV2;

    event Swap(address indexed beneficiary, uint256 amount);

    constructor(address _workTokenV1Address, address _workTokenV2Address) {
        workTokenV1 = WorkToken(_workTokenV1Address);
        workTokenV2 = WorkToken(_workTokenV2Address);
    }

    /**
     * @notice The swap function burns an amount of $WORK v1 tokens that an account has and then distributes the same amount of $WORK v2 tokens.
     * @dev The swap function will swap the old v1 $WORK tokens for the new v2 $WORK tokens.
     **/
    function swap() external {
        uint256 amount = workTokenV1.balanceOf(msg.sender);
        if (amount == 0) revert SwapAmountZero();
        if (workTokenV1.allowance(msg.sender, address(this)) < amount) revert SwapAmountAllowanceInsufficient();
        if (!workTokenV1.transferFrom(msg.sender, address(0), amount)) {
            revert BurnFailed();
        }

        if (!workTokenV2.transferFrom(address(this), msg.sender, amount)) {
            revert TransferFailed();
        }

        emit Swap(msg.sender, amount);
    }
}
