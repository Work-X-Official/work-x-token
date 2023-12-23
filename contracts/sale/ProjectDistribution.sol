// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "../work/WorkToken.sol";

/**
 * @title The Work X $WORK ProjectDistribution contract for the project funds.
 * @author Daniel de Witte
 * @notice The contract used to distribute the project's $WORK tokens according to a vesting schedule.
 * @dev There are 6 types, with different vesting periods: DAO treasury, platform incentives, ecosystem, team(+founders), advisory and strategic.
 **/
contract ProjectDistribution {
    WorkToken public immutable workToken;

    uint256 public constant startTime = 1701771000;
    uint256 private constant ONE_E18 = 10 ** 18;

    uint64 public constant VEST_TIME_5_YEARS = 1825 days;
    uint64 public constant VEST_TIME_2_YEARS = 730 days;
    uint64 public constant VEST_TIME_1_YEAR = 365 days;

    uint64 public constant VEST_AMOUNT_DAO = 12000000;
    uint64 public constant VEST_AMOUNT_PLATFORM = 9500000;
    uint64 public constant VEST_AMOUNT_ECOSYSTEM = 14000000;
    uint64 public constant VEST_AMOUNT_TEAM = 5000000;
    uint64 public constant VEST_AMOUNT_FOUNDER = 2500000;
    uint64 public constant VEST_AMOUNT_ADVISORY = 2500000;
    uint64 public constant VEST_AMOUNT_STRATEGIC = 4000000;

    event ClaimTokens(address indexed beneficiary, uint256 amount);

    struct Balance {
        uint64 amount;
        uint64 period;
        uint128 claimed;
    }
    mapping(address => Balance) public bal;

    /**
     * @notice The constructor sets the beneficiaries of each vesting schedule.
     * @dev A reference to the $WORK token is initialized.
     **/
    constructor(address _workTokenAddress, address[8] memory _accounts) {
        workToken = WorkToken(_workTokenAddress);
        bal[_accounts[0]] = Balance(VEST_AMOUNT_DAO, VEST_TIME_5_YEARS, 0);
        bal[_accounts[1]] = Balance(VEST_AMOUNT_PLATFORM, VEST_TIME_5_YEARS, 0);
        bal[_accounts[2]] = Balance(VEST_AMOUNT_ECOSYSTEM, VEST_TIME_5_YEARS, 0);
        bal[_accounts[3]] = Balance(VEST_AMOUNT_TEAM, VEST_TIME_2_YEARS, 0);
        bal[_accounts[4]] = Balance(VEST_AMOUNT_FOUNDER, VEST_TIME_2_YEARS, 0);
        bal[_accounts[5]] = Balance(VEST_AMOUNT_FOUNDER, VEST_TIME_2_YEARS, 0);
        bal[_accounts[6]] = Balance(VEST_AMOUNT_ADVISORY, VEST_TIME_2_YEARS, 0);
        bal[_accounts[7]] = Balance(VEST_AMOUNT_STRATEGIC, VEST_TIME_1_YEAR, 0);
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice The claimTokens function claims the amount of tokens a user has vested given the time that has past since distribution start minus how much they have previously claimed.
     * @dev The WorkToken contract is used to mint the tokens directly towards the claimer.
     **/
    function claimTokens() external {
        require(block.timestamp >= startTime, "TokenDistribution: The distribution hasn't started yet");
        uint256 availableTokens = _claimableTokens(msg.sender);
        require(availableTokens > 0, "TokenDistribution: You don't have any tokens to claim");
        Balance storage _balance = bal[msg.sender];
        _balance.claimed += uint128(availableTokens);
        workToken.mint(msg.sender, availableTokens);
        emit ClaimTokens(msg.sender, availableTokens);
    }

    /****
     **** EXTERNAL VIEW
     ****/

    /**
     * @notice The claimableTokens function returns the claimable tokens for an account.
     * @param _account The account for which the claimable token amount will be returned.
     **/
    function claimableTokens(address _account) external view returns (uint256) {
        return _claimableTokens(_account);
    }

    /**
     * @notice The claimedTokens function returns the claimed tokens for an account.
     * @param _account The account for which the claimed token amount will be returned.
     **/
    function claimedTokens(address _account) external view returns (uint256) {
        return bal[_account].claimed;
    }

    /**
     * @notice The vestedTokens function returns the vested tokens for an account.
     * @param _account The account for which the vested token amount will be returned.
     **/
    function vestedTokens(address _account) external view returns (uint256) {
        return _vestedTokens(_account);
    }

    /**
     * @notice The balance function returns an aggregate of vesting and claiming data for an account.
     * @param _account The account for which the aggregated data will be returned.
     **/
    function balance(
        address _account
    ) external view returns (uint256 _total, uint256 _claimed, uint256 _period, uint256 _claimable, uint256 _vested) {
        Balance memory _balance = bal[_account];
        _total = _balance.amount * ONE_E18;
        _claimed = _balance.claimed;
        _period = _balance.period;
        _claimable = _claimableTokens(_account);
        _vested = _vestedTokens(_account);
    }

    /****
     **** PRIVATE VIEW
     ****/

    /**
     * @notice The _claimableTokens function calculates the amount of tokens that are claimable for an account.
     * @dev The amount of tokens that are claimable is the amount of vested tokens minus the amount of tokens that have already been claimed.
     * @param _account The account for which the claimable tokens are calculated.
     **/
    function _claimableTokens(address _account) private view returns (uint256 claimableAmount) {
        uint256 vestedAmount = _vestedTokens(_account);
        uint256 claimed = bal[_account].claimed;
        if (vestedAmount <= claimed) {
            claimableAmount = 0;
        } else {
            claimableAmount = vestedAmount - claimed;
        }
    }

    /**
     * @notice The _vestedTokens function calculates the amount of tokens that have been vested for an account.
     * @dev The amount of tokens that are vested is calculated by taking the amount of tokens that are bought in each round and multiplying it by the percentage of the vesting period that has passed.
     * @param _account The account for which the vested tokens are calculated.
     **/
    function _vestedTokens(address _account) private view returns (uint256 vestedAmount) {
        if (block.timestamp < startTime) return 0;
        Balance memory _balance = bal[_account];
        uint256 timeElapsed = block.timestamp - startTime;

        if (timeElapsed >= _balance.period) {
            vestedAmount += _balance.amount * ONE_E18;
        } else {
            vestedAmount += (_balance.amount * timeElapsed * ONE_E18) / _balance.period;
        }
    }
}
