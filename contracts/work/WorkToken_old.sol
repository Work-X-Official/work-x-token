// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title The Work X $WORK Token
 * @author Daniel de Witte
 * @notice The token used in the decentralized Work X ecosystem.
 * @dev Mint function is only accessible by the minter role.
 **/
contract WorkTokenOld is ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice The constructor does not take arguments but sets the name, symbol and cap of the token.
     * @dev The role MINTER_ROLE is set to the deployer of the contract.
     **/
    constructor() ERC20Capped(100 * 10 ** 6 * 10 ** decimals()) ERC20("Work X Token", "WORK") {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Mints an amount of $WORK tokens to a target address.
     * @dev This function can only be called by an address with the role MINTER_ROLE.
     * @param to The address that will receive the $WORK tokens.
     * @param amount The amount of tokens that will be minted.
     **/
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
