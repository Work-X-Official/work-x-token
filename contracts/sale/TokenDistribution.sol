// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../work/WorkToken.sol";

contract TokenDistribution is Ownable {
    WorkToken public immutable workToken;

    uint64 public constant VESTING_PERIOD1 = 547.5 days;
    uint64 public constant VESTING_PERIOD2 = 365 days;
    uint64 public constant VESTING_PERIOD3 = 273.75 days;
    uint64 public constant VESTING_PERIOD3_DIRECT_UNLOCK = 27.375 days;
    uint128 constant ONE_E18 = 10 ** 18;
    uint128 constant ONE_E17 = 10 ** 17;

    uint128 public startTime;

    event ClaimTokens(address indexed beneficiary, uint256 amount);

    struct Balance {
        uint32 totalBought;
        uint32 bought1;
        uint32 bought2;
        uint32 bought3;
        uint128 totalClaimed;
    }
    mapping(address => Balance) public accountBalance;

    constructor(address _tokenAddress, uint128 _startTime) {
        workToken = WorkToken(_tokenAddress);
        startTime = _startTime;
    }

    /****
     **** EXTERNAL WRITE
     ****/

    function claimTokens() external {
        require(block.timestamp >= startTime, "TokenDistribution: The distribution hasn't started yet");
        uint128 availableTokens = _claimableTokens(msg.sender);
        require(availableTokens > 0, "TokenDistribution: You don't have any tokens to claim");
        Balance storage _balance = accountBalance[msg.sender];
        _balance.totalClaimed += availableTokens;
        workToken.mint(msg.sender, availableTokens);
        emit ClaimTokens(msg.sender, availableTokens);
    }

    /****
     **** ONLY OWNER
     ****/

    function startDistribution(uint128 _startTime) external onlyOwner {
        require(startTime > block.timestamp, "TokenDistribution: The token distribution has already started");
        startTime = _startTime;
    }

    function setWalletClaimable(
        address[] calldata wallet,
        uint32[] calldata amount1,
        uint32[] calldata amount2,
        uint32[] calldata amount3,
        uint32[] calldata totalClaimed
    ) external onlyOwner {
        require(startTime > block.timestamp, "TokenDistribution: The token distribution has already started");
        for (uint256 w = 0; w < wallet.length; w++) {
            accountBalance[wallet[w]] = Balance(
                amount1[w] + amount2[w] + amount3[w],
                amount1[w],
                amount2[w],
                amount3[w],
                uint128(totalClaimed[w]) * ONE_E18
            );
        }
    }

    /****
     **** EXTERNAL VIEW
     ****/

    function claimableTokens(address _account) external view returns (uint128) {
        return _claimableTokens(_account);
    }

    function claimedTokens(address _account) external view returns (uint128) {
        return accountBalance[_account].totalClaimed;
    }

    function vestedTokens(address _account) external view returns (uint128) {
        return _vestedTokens(_account);
    }

    function balance(
        address _account
    )
        external
        view
        returns (
            uint128 _totalBought,
            uint128 _totalClaimed,
            uint128 _claimable,
            uint128 _vested,
            uint128 _lastClaimDate
        )
    {
        Balance memory _balance = accountBalance[_account];
        _totalBought = uint128(_balance.totalBought) * ONE_E18;
        _totalClaimed = _balance.totalClaimed;
        _claimable = _claimableTokens(_account);
        _vested = _vestedTokens(_account);
        _lastClaimDate = lastClaimDate(_account);
    }

    function lastClaimDate(address _account) public view returns (uint128) {
        if (block.timestamp < startTime) return 0;
        Balance memory _balance = accountBalance[_account];
        if (_balance.totalClaimed == 0) return 0;
        uint128 periodLargest = 0;
        periodLargest = _getLargestPeriod(periodLargest, VESTING_PERIOD1, _balance.totalClaimed, _balance.bought1);
        periodLargest = _getLargestPeriod(periodLargest, VESTING_PERIOD2, _balance.totalClaimed, _balance.bought2);
        periodLargest = _getLargestPeriod(periodLargest, VESTING_PERIOD3, _balance.totalClaimed, _balance.bought3);
        if (periodLargest == 0) return 0;
        return startTime + periodLargest;
    }

    /****
     **** PRIVATE VIEW
     ****/

    function _getLargestPeriod(
        uint128 _periodLargest,
        uint128 _period,
        uint128 _claimed,
        uint32 _bought
    ) private view returns (uint128) {
        if (_bought > 0) {
            uint128 timeElapsed = uint128(block.timestamp) - startTime;
            if (timeElapsed > _period) {
                if (_period > _periodLargest) return _period;
            } else {
                uint128 tmpPeriod = ((_period * _claimed) / uint128(_bought)) * timeElapsed * _period;
                if (tmpPeriod > _periodLargest) return tmpPeriod;
            }
        }
        return _periodLargest;
    }

    function _claimableTokens(address _account) private view returns (uint128 claimableAmount) {
        uint128 vestedAmount = _vestedTokens(_account);
        uint128 claimed = accountBalance[_account].totalClaimed;
        if (vestedAmount <= claimed) {
            claimableAmount = 0;
        } else {
            claimableAmount = vestedAmount - claimed;
        }
    }

    function _vestedTokens(address _account) private view returns (uint128 vestedAmount) {
        if (block.timestamp < startTime) return 0;
        Balance memory _balance = accountBalance[_account];
        uint128 timeElapsed = uint128(block.timestamp) - startTime;

        if (timeElapsed >= VESTING_PERIOD1) {
            vestedAmount += uint128(_balance.bought1) * ONE_E18;
        } else {
            vestedAmount += (_balance.bought1 * timeElapsed * ONE_E18) / VESTING_PERIOD1;
        }
        if (timeElapsed >= VESTING_PERIOD2) {
            vestedAmount += uint128(_balance.bought2) * ONE_E18;
        } else {
            vestedAmount += (_balance.bought2 * timeElapsed * ONE_E18) / VESTING_PERIOD2;
        }
        if (timeElapsed >= VESTING_PERIOD3) {
            vestedAmount += uint128(_balance.bought3) * ONE_E18;
        } else {
            if (timeElapsed < VESTING_PERIOD3_DIRECT_UNLOCK) {
                vestedAmount += (uint128(_balance.bought3) * ONE_E17);
            } else {
                vestedAmount += (_balance.bought3 * timeElapsed * ONE_E18) / VESTING_PERIOD3;
            }
        }
    }
}
