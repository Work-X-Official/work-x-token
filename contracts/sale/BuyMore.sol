// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract BuyMore is Ownable {
    using SafeMath for uint256;

    uint256 public constant NORMALIZING_DECIMALS = 36;
    address public immutable targetWallet;

    mapping(address => uint256) public investments;
    mapping(string => IERC20Metadata) public acceptedTokens;

    constructor(address _targetWallet, string[] memory _tokenNames, address[] memory _tokenAddresses) {
        require(_tokenNames.length == _tokenAddresses.length, "BuyMore: Invalid accepted tokens length");

        targetWallet = _targetWallet;

        for (uint256 i = 0; i < _tokenNames.length; i++) {
            acceptedTokens[_tokenNames[i]] = IERC20Metadata(address(_tokenAddresses[i]));
        }
    }

    function buyMore(string memory tokenName, uint256 amount) public {
        _buyMore(tokenName, amount);
    }

    function getTotalAllocation(address user) public view returns (uint256) {
        return investments[user];
    }

    function _buyMore(string memory tokenName, uint256 amount) private {
        require(acceptedTokens[tokenName] != IERC20Metadata(address(0)), "BuyMore: Invalid tokenName");
        require(amount > 0, "BuyMore: You can't invest 0 tokens");
        require(amount % (10 ** acceptedTokens[tokenName].decimals()) == 0, "BuyMore: Only round numbers are accepted");

        uint256 normalizedAmount = _normalizeDecimals(amount, acceptedTokens[tokenName]);

        _safeTransferFrom(address(acceptedTokens[tokenName]), _msgSender(), targetWallet, amount);

        investments[_msgSender()] = investments[_msgSender()].add(normalizedAmount);
    }

    function _normalizeDecimals(uint256 amount, IERC20Metadata token) private view returns (uint256) {
        return amount.mul(10 ** uint256(NORMALIZING_DECIMALS).sub(uint256(token.decimals())));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "BuyMore: Cannot transfer from the token to the target wallet"
        );
    }
}
