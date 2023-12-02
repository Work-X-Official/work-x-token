// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Sale is Ownable {
    using ECDSA for bytes32;
    using SafeMath for uint256;

    struct Round {
        uint256 maximum;
        bool active;
    }

    struct Pool {
        uint256 amount;
        bool unrestricted;
    }

    uint256 public constant NORMALIZING_DECIMALS = 36;

    mapping(string => IERC20Metadata) public acceptedTokens;

    address public immutable signer;

    address public immutable wallet;

    Round[] public rounds;

    mapping(uint8 => mapping(address => uint256)) public investments;

    mapping(uint8 => mapping(address => Pool)) public pools;

    mapping(uint8 => uint256) public roundsTotalInvestments;

    mapping(bytes32 => address) public codeToInvitee;
    mapping(address => bytes32) public inviteeToCode;
    mapping(address => address) public walletToPool;

    uint256 public constant MAXIMUM_POOL_ALLOWANCE = 250_000 * 10 ** NORMALIZING_DECIMALS;

    uint256[] private maximumRebalance;

    constructor(address _signer, address _wallet, string[] memory tokenNames, address[] memory tokenAddreses) {
        require(tokenNames.length == tokenAddreses.length, "Sale: Invalid accepted tokens length");

        signer = _signer;
        wallet = _wallet;

        for (uint256 i = 0; i < tokenNames.length; i++) {
            acceptedTokens[tokenNames[i]] = IERC20Metadata(address(tokenAddreses[i]));
        }

        rounds.push(Round({ maximum: 900_000 * 10 ** NORMALIZING_DECIMALS, active: false }));
        rounds.push(Round({ maximum: 1_225_000 * 10 ** NORMALIZING_DECIMALS, active: false }));
        rounds.push(Round({ maximum: 750_000 * 10 ** NORMALIZING_DECIMALS, active: false }));

        maximumRebalance.push(rounds[0].maximum * 2);
        maximumRebalance.push(rounds[1].maximum * 2);
        maximumRebalance.push(rounds[2].maximum * 2);
    }

    function enableRound(uint8 round, bool enable) public onlyOwner {
        require(_verifyRound(round, false), "Sale: Invalid round");
        require(rounds[round].active == !enable, "Sale: Round already has this state");

        rounds[round].active = enable;
    }

    // Used by people invited by root wallet and NOT by pool investors
    function investWithCode(
        bytes32 code,
        bytes memory signature,
        string memory tokenName,
        uint256 amount,
        uint8 round
    ) public {
        require(_verifyCode(code, signature), "Sale: Invalid signature");
        require(_verifyInviteeCode(code), "Sale: This code was already used by a different address");

        _investInRound(_msgSender(), tokenName, amount, round);
    }

    // Used by people invited by root wallet and NOT by pool investors, they need to invest first using the code
    // to create a link between their wallets and the code
    function investWithoutCode(string memory tokenName, uint256 amount, uint8 round) public {
        require(walletToPool[_msgSender()] != address(0), "Sale: You need to invest with an invitation first");

        _investInRound(walletToPool[_msgSender()], tokenName, amount, round);
    }

    function investPublicPool(address poolOwner, string memory tokenName, uint256 amount, uint8 round) public {
        require(inviteeToCode[poolOwner] != bytes32(0), "Sale: This pool does not exist");
        require(pools[round][poolOwner].unrestricted == true, "Sale: The pool is not publicly open");

        _investInRound(poolOwner, tokenName, amount, round);
    }

    function investPrivatePool(
        address poolOwner,
        bytes32 code,
        bytes memory signature,
        string memory tokenName,
        uint256 amount,
        uint8 round
    ) public {
        require(code.toEthSignedMessageHash().recover(signature) == poolOwner, "Sale: Invalid invitation codes");
        require(inviteeToCode[poolOwner] != bytes32(0), "Sale: This pool does not exist");
        require(_verifyInviteeCode(code), "Sale: This code was already used by a different address");

        _investInRound(poolOwner, tokenName, amount, round);
    }

    function openPool(uint8 round, bool unrestricted) public {
        _openPool(_msgSender(), round, unrestricted);
    }

    function openPoolForAddress(address poolOwner, uint8 round, bool unrestricted) public onlyOwner {
        _openPool(poolOwner, round, unrestricted);
    }

    function getInvestorTotalAllocation(address investor) public view returns (uint256[] memory, uint256[] memory) {
        require(investor != address(0), "Sale: You must specify a buyer");

        uint256[] memory investorAllocations = new uint256[](rounds.length);
        uint256[] memory poolAllocations = new uint256[](rounds.length);

        for (uint8 r = 0; r < rounds.length; r++) {
            investorAllocations[r] = investments[r][investor];

            if (walletToPool[investor] != address(0)) {
                poolAllocations[r] = pools[r][walletToPool[investor]].amount;
            } else {
                poolAllocations[r] = 0;
            }
        }

        return (investorAllocations, poolAllocations);
    }

    function rebalanceRoundLimit(uint8 round, uint256 newMaximum) public onlyOwner {
        require(_verifyRound(round, false), "Sale: Invalid round");
        require(
            roundsTotalInvestments[round] <= newMaximum,
            "Sale: The new maximum must be higher or equal than the total invested"
        );
        require(maximumRebalance[round] >= newMaximum, "Sale: Cannot rebalance over the maximum rebalance limit");

        rounds[round].maximum = newMaximum;
    }

    function _openPool(address poolOwner, uint8 round, bool unrestricted) private {
        require(inviteeToCode[poolOwner] != bytes32(0), "Sale: Address does not own a pool");
        require(pools[round][poolOwner].unrestricted != unrestricted, "Sale: The pool already has this state");

        pools[round][poolOwner].unrestricted = unrestricted;
    }

    function _investInRound(address poolOwner, string memory tokenName, uint256 amount, uint8 round) private {
        require(acceptedTokens[tokenName] != IERC20Metadata(address(0)), "Sale: Invalid token/token not accepted");
        require(amount > 0, "Sale: You can't invest 0 tokens");
        require(amount % (10 ** acceptedTokens[tokenName].decimals()) == 0, "Sale: Only round numbers are accepted");
        require(_verifyRound(round, true), "Sale: Round is not active");
        uint256 normalizedAmount = _normalizeDecimals(amount, acceptedTokens[tokenName]);
        require(
            roundsTotalInvestments[round].add(normalizedAmount) <= rounds[round].maximum,
            "Sale: Round maximum allowance reached"
        );
        require(
            pools[round][poolOwner].amount.add(normalizedAmount) <= MAXIMUM_POOL_ALLOWANCE,
            "Sale: Pool maximum allowance reached"
        );

        _safeTransferFrom(address(acceptedTokens[tokenName]), _msgSender(), wallet, amount);

        if (walletToPool[_msgSender()] == address(0)) {
            walletToPool[_msgSender()] = poolOwner;
        }
        roundsTotalInvestments[round] = roundsTotalInvestments[round].add(normalizedAmount);

        pools[round][poolOwner].amount = pools[round][poolOwner].amount.add(normalizedAmount);

        investments[round][_msgSender()] = investments[round][_msgSender()].add(normalizedAmount);
    }

    function _verifyInviteeCode(bytes32 code) private returns (bool) {
        if (inviteeToCode[_msgSender()] != bytes32(0) || codeToInvitee[code] != address(0)) {
            return code == inviteeToCode[_msgSender()] && codeToInvitee[code] == _msgSender();
        }

        codeToInvitee[code] = _msgSender();
        inviteeToCode[_msgSender()] = code;
        return true;
    }

    function _normalizeDecimals(uint256 amount, IERC20Metadata token) private view returns (uint256) {
        return amount.mul(10 ** uint256(NORMALIZING_DECIMALS).sub(uint256(token.decimals())));
    }

    function _verifyRound(uint8 round, bool checkActive) private view returns (bool) {
        if (round > 2) {
            return false;
        }

        if (checkActive) {
            return rounds[round].active == true;
        }

        return true;
    }

    function _verifyCode(bytes32 code, bytes memory signature) private view returns (bool) {
        return code.toEthSignedMessageHash().recover(signature) == signer;
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Sale: Cannot transfer from the token to the target"
        );
    }
}
