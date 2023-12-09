// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract BuyMore {
    uint256 public constant NORMALIZING_DECIMALS = 36;
    address public immutable targetWallet;

    mapping(address => uint256) public investments;
    mapping(string => IERC20Metadata) public acceptedTokens;

    event BoughtMore(address indexed sender, uint256 amount);

    /**
     * @dev Constructor referencing the target wallet and the accepted tokens
     * @param _targetWallet the wallet the bought tokens will be sent to
     * @param _tokenNames names of allowed tokens to spend
     * @param _tokenAddresses addresses of allowed tokens to spend
     **/
    constructor(address _targetWallet, string[] memory _tokenNames, address[] memory _tokenAddresses) {
        require(_tokenNames.length == _tokenAddresses.length, "BuyMore: Invalid accepted tokens length");
        targetWallet = _targetWallet;
        for (uint256 i = 0; i < _tokenNames.length; i++) {
            acceptedTokens[_tokenNames[i]] = IERC20Metadata(address(_tokenAddresses[i]));
        }
    }

    /**
     * @notice Buy more tokens
     * @dev Wraps _buyMore
     * @param tokenName name of the token spent
     * @param amount amount of tokens spent
     **/
    function buyMore(string calldata tokenName, uint256 amount) external {
        _buyMore(tokenName, amount);
        emit BoughtMore(msg.sender, amount);
    }

    /**
     * @dev Gets the total allocation of a user
     * @param user to get allocation for
     * @return total allocation of the user
     **/
    function getTotalAllocation(address user) public view returns (uint256) {
        return investments[user];
    }

    /**
     * @notice _buyMore normalized decimals of the token (stablecoin have differences) and transfers the tokens to the target wallet
     * @dev This function requires this contract to have been approved to spend the amount of tokens
     * @param tokenName name of the token spent
     * @param amount amount of tokens spent
     **/
    function _buyMore(string calldata tokenName, uint256 amount) private {
        require(acceptedTokens[tokenName] != IERC20Metadata(address(0)), "BuyMore: Invalid tokenName");
        require(amount > 0, "BuyMore: You can't invest 0 tokens");
        require(amount % (10 ** acceptedTokens[tokenName].decimals()) == 0, "BuyMore: Only round numbers are accepted");

        uint256 normalizedAmount = _normalizeDecimals(amount, acceptedTokens[tokenName]);
        investments[msg.sender] = investments[msg.sender] + normalizedAmount;
        _safeTransferFrom(address(acceptedTokens[tokenName]), msg.sender, targetWallet, amount);
    }

    /**
     * @dev Normalizes the decimals of the token to the NORMALIZING_DECIMALS
     * @param amount amount of tokens to normalize
     * @param token token to get decimals from
     * @return normalized amount
     **/
    function _normalizeDecimals(uint256 amount, IERC20Metadata token) private view returns (uint256) {
        return amount * 10 ** (NORMALIZING_DECIMALS - uint256(token.decimals()));
    }

    /**
     * @dev Safely transfers tokens from the token contract to the target wallet
     * @param token token to transfer
     * @param from address to transfer from
     * @param to address to transfer to
     * @param value amount of tokens to transfer
     **/
    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "BuyMore: Cannot transfer from the token to the target wallet"
        );
    }
}
