// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../work/WorkToken.sol";

error SwapAmountZero();
error BurnFailed();
error TransferFailed();
error SwapAmountAllowanceInsufficient();
error NotWhitelisted();

/**
 * @title The Work X $WORK SwapV2 contract to upgrade from V1 to V2.
 * @notice This contract is used to upgrade $WORK tokens from V1 to V2
 * @dev The full amount of V1 tokens is burned and the same amount of V2 tokens is sent to the account interacting with the conract.
 **/
contract SwapV2 is AccessControl {
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    WorkToken public immutable workTokenV1;
    WorkToken public immutable workTokenV2;

    mapping(address => bool) public whitelisted;

    event Swap(address indexed beneficiary, uint256 amount);

    constructor(address _workTokenV1Address, address _workTokenV2Address) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(WHITELIST_ROLE, _msgSender());
        _grantRole(WITHDRAW_ROLE, _msgSender());
        workTokenV1 = WorkToken(_workTokenV1Address);
        workTokenV2 = WorkToken(_workTokenV2Address);
    }

    /**
     * @notice The swap function burns an amount of $WORK v1 tokens that an account has and then distributes the same amount of $WORK v2 tokens.
     * @dev The swap function will swap the old v1 $WORK tokens for the new v2 $WORK tokens.
     **/
    function swap() external {
        if (!whitelisted[msg.sender]) revert NotWhitelisted();
        uint256 amount = workTokenV1.balanceOf(msg.sender);
        if (amount == 0) revert SwapAmountZero();
        if (workTokenV1.allowance(msg.sender, address(this)) < amount) revert SwapAmountAllowanceInsufficient();
        workTokenV1.burnFrom(msg.sender, amount);

        if (!workTokenV2.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }

        emit Swap(msg.sender, amount);
    }

    /**
     * @notice The whitelist function allows an account with the whitelist role to whitelist other accounts enabling them to swap.
     * @dev The whitelist function can only be used by accounts with the WHITELIST_ROLE assigned with access control.
     * @param _address The address to be whitelisted or removed from the whitelist.
     * @param _list A boolean to indicate if the address should be whitelisted or removed from the whitelist.
     **/
    function whitelist(address _address, bool _list) external onlyRole(WHITELIST_ROLE) {
        require(hasRole(WHITELIST_ROLE, msg.sender), "SwapV2: must have whitelist role to whitelist");
        whitelisted[_address] = _list;
    }

    /**
     * @notice Function to withdraw any ERC20 token from the contract.
     * @param _tokenAddress Address of the ERC20 token contract.
     * @param _amount Amount of the ERC20 token to withdraw.
     **/
    function withdrawTokens(address _tokenAddress, uint256 _amount) external onlyRole(WITHDRAW_ROLE) {
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
    }

    /**
     * @notice Function to withdraw all ETH from the contract.
     **/
    function withdrawEther() external payable onlyRole(WITHDRAW_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }
}
