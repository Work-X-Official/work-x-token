// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "./../interface/IRewarder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error ClaimNotAllowed();
error TransferFailed();
error WithdrawWorkNotAllowed();

/**
 * @notice RewardShares rewards NFTs in 2 separate ways:
 * 1. The amount of shares of the NFT in the previous month determines the amount of WORK tokens that can be claimed.
 *    This reward type is capped at 693,261 WORK tokens, and spread out over 40 months, giving predetermined total reward portions per month that are shared by all NFTs.
 * 2. The level of the NFT determines the amount of WORK tokens that can be claimed. This second reward is capped at 693,261 WORK tokens.
 *    This reward type is capped at 693,261 WORK tokens, but does not have a predetermined amount per month, meaning it is uncertain how this reward system will run for.
 *    The total amount per month will depend on the amount of NFTs that are eligible for this reward (lvl1+) and what their levels are.
 */
contract RewardShares is Ownable, IRewarder {
    using SafeERC20 for IERC20;

    IGenesisNft immutable nft;
    IERC20 immutable workToken;

    uint256 private constant REWARD_MONTHS = 40;
    uint256 private constant ONE_E18 = 10 ** 18;
    uint256 private constant REWARD_LEVEL_MONTH = 8 * ONE_E18;
    uint256 private constant SHARES_LEVEL_ZERO = 51;
    uint256 private constant TOTAL_LEVEL_REWARDS = 693_261 * ONE_E18;

    address public rewardWrapper;
    uint256 public totalLevelClaimed;

    mapping(uint256 => uint8) public levelShares;
    mapping(uint256 => uint256) public claimed;
    mapping(uint256 => uint256) public monthClaimed;

    /**
     * @notice  The formula is: (40000 - sqrt(month * 40000000)) * 10 / 8 , but is multiplied by 10 ** 18 to get the amount in wei.
     * Array with total reward amounts per month, filled with the formula above.
     */
    uint16[REWARD_MONTHS] public rewards = [
        50000,
        42094,
        38820,
        36307,
        34189,
        32322,
        30635,
        29083,
        27639,
        26283,
        25000,
        23780,
        22614,
        21496,
        20420,
        19381,
        18377,
        17404,
        16459,
        15540,
        14645,
        13772,
        12919,
        12086,
        11270,
        10472,
        9689,
        8921,
        8167,
        7427,
        6699,
        5983,
        5279,
        4585,
        3902,
        3229,
        2566,
        1912,
        1266,
        629
    ];

    event Claimed(uint256 indexed nftId, address indexed claimer, uint256 amountClaimed);

    /**
     * @notice Initializes the RewardShares contract with the given addresses.
     * @param _genesisNftAddress The address of the Genesis NFT contract.
     * @param _workTokenAddress The address of the WORK token contract.
     */
    constructor(address _genesisNftAddress, address _workTokenAddress) {
        nft = IGenesisNft(_genesisNftAddress);
        workToken = IERC20(_workTokenAddress);

        levelShares[51] = 0;
        levelShares[52] = 1;
        levelShares[53] = 2;
        levelShares[54] = 3;
        levelShares[55] = 4;
        levelShares[57] = 5;
        levelShares[58] = 6;
        levelShares[59] = 7;
        levelShares[60] = 8;
        levelShares[61] = 9;
        levelShares[63] = 10;
        levelShares[65] = 11;
        levelShares[66] = 12;
        levelShares[68] = 13;
        levelShares[70] = 14;
        levelShares[71] = 15;
        levelShares[73] = 16;
        levelShares[75] = 17;
        levelShares[77] = 18;
        levelShares[78] = 19;
        levelShares[81] = 20;
        levelShares[83] = 21;
        levelShares[85] = 22;
        levelShares[88] = 23;
        levelShares[90] = 24;
        levelShares[93] = 25;
        levelShares[95] = 26;
        levelShares[97] = 27;
        levelShares[100] = 28;
        levelShares[102] = 29;
        levelShares[105] = 30;
        levelShares[108] = 31;
        levelShares[111] = 32;
        levelShares[115] = 33;
        levelShares[118] = 34;
        levelShares[121] = 35;
        levelShares[124] = 36;
        levelShares[127] = 37;
        levelShares[131] = 38;
        levelShares[134] = 39;
        levelShares[138] = 40;
        levelShares[142] = 41;
        levelShares[146] = 42;
        levelShares[150] = 43;
        levelShares[154] = 44;
        levelShares[158] = 45;
        levelShares[162] = 46;
        levelShares[166] = 47;
        levelShares[170] = 48;
        levelShares[174] = 49;
        levelShares[179] = 50;
        levelShares[184] = 51;
        levelShares[189] = 52;
        levelShares[194] = 53;
        levelShares[199] = 54;
        levelShares[204] = 55;
        levelShares[209] = 56;
        levelShares[214] = 57;
        levelShares[219] = 58;
        levelShares[224] = 59;
        levelShares[230] = 60;
        levelShares[236] = 61;
        levelShares[242] = 62;
        levelShares[248] = 63;
        levelShares[254] = 64;
        levelShares[260] = 65;
        levelShares[266] = 66;
        levelShares[272] = 67;
        levelShares[279] = 68;
        levelShares[285] = 69;
        levelShares[292] = 70;
        levelShares[299] = 71;
        levelShares[306] = 72;
        levelShares[313] = 73;
        levelShares[320] = 74;
        levelShares[328] = 75;
        levelShares[335] = 76;
        levelShares[342] = 77;
        levelShares[350] = 78;
        levelShares[357] = 79;
        levelShares[370] = 80;
    }

    /****
     **** ONLY OWNER
     ****/

    /**
     * @notice Rescue function for the contract owner to withdraw any ERC20 token except $WORK from this contract.
     * @dev A failsafe for any token stuck in this contract. Only callable by the contract owner.
     * @param _tokenAddress Address of the ERC20 token contract.
     * @param _amount Amount of the ERC20 token to withdraw.
     **/
    function withdrawTokens(address _tokenAddress, uint256 _amount) external onlyOwner {
        if (_tokenAddress != address(workToken)) {
            if (!IERC20(_tokenAddress).transfer(msg.sender, _amount)) {
                revert TransferFailed();
            }
        } else {
            revert WithdrawWorkNotAllowed();
        }
    }

    /**
     * @notice Approve a spender to spend an amount of WORK tokens from this contract, only callable by the contract owner.
     * @param _spender Address of the spender.
     * @param _amount Amount of the WORK token to approve.
     * @return _success True if the operation was successful.
     **/
    function approve(address _spender, uint256 _amount) external onlyOwner returns (bool _success) {
        _success = workToken.approve(_spender, _amount);
    }

    /**
     * @notice Set the reward wrapper address, only callable by the contract owner.
     * @param _rewardWrapper Address of the reward wrapper contract.
     */
    function setRewardWrapper(address _rewardWrapper) external onlyOwner {
        rewardWrapper = _rewardWrapper;
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice Claim the claimable reward of a nftId into the nft contract, can be done by the owner of the nftId.
     * @param _nftId Id of the nft in which you want to claim the reward.
     */
    function claim(uint256 _nftId) external {
        if (msg.sender != nft.ownerOf(_nftId) && msg.sender != rewardWrapper) {
            revert ClaimNotAllowed();
        }
        uint256 currentMonth = nft.getCurrentMonth();

        if (currentMonth == 0) {
            return;
        }

        (uint256 claimableShares, uint256 claimableLevel) = getClaimable(_nftId);

        if (claimableShares + claimableLevel > 0) {
            claimed[_nftId] += claimableShares + claimableLevel;
            monthClaimed[_nftId] = currentMonth;
            if (claimableLevel > 0) {
                totalLevelClaimed += claimableLevel;
            }
            nft.reward(_nftId, claimableShares + claimableLevel);
            emit Claimed(_nftId, msg.sender, claimableShares + claimableLevel);
        }
        return;
    }

    /****
     **** PUBLIC VIEW
     ****/

    /**
     * @notice Amount of tokens currently claimable, which is all rewards of a nftId that have not been claimed yet.
     * @dev Calculates the reward for a nftId by summing the rewards of all previous months from month after last claim.
     * @param _nftId Id of the nft for which you want to find the claimable amount.
     * @return _claimableShares Amount of tokens currently claimable.
     * @return _claimableLevel Amount of tokens currently claimable.
     */
    function getClaimable(uint256 _nftId) public view returns (uint256 _claimableShares, uint256 _claimableLevel) {
        uint256 currentMonth = nft.getCurrentMonth();

        for (uint256 i = monthClaimed[_nftId] + 1; i <= currentMonth; ++i) {
            (uint256 claimableShares, uint256 claimableLevel) = getRewardNftIdMonth(_nftId, i);
            _claimableShares += claimableShares;
            _claimableLevel += claimableLevel;
        }

        if (totalLevelClaimed + _claimableLevel > TOTAL_LEVEL_REWARDS) {
            if (totalLevelClaimed < TOTAL_LEVEL_REWARDS) {
                _claimableLevel = TOTAL_LEVEL_REWARDS - totalLevelClaimed;
            } else {
                _claimableLevel = 0;
            }
        }
    }

    /**
     * @notice Get the total reward for a specific month according to the rewards array. In month 0 there is no reward and from month 1,
     * the rewards are stored in the array.
     * @param _month Month for which you want to find the total reward.
     * @return _rewardTotalMonth Total reward in specific month.
     */
    function getSharesRewardTotalMonth(uint256 _month) public view returns (uint256 _rewardTotalMonth) {
        if (_month > REWARD_MONTHS || _month == 0) {
            return 0;
        }
        _rewardTotalMonth = rewards[_month - 1] * ONE_E18;
    }

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month and shares of the previous month.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonthShares Reward of a nftId for a specific month based on shares.
     * @return _rewardNftIdMonthLevel Reward of a nftId for a specific month based on shares.
     */
    function getRewardNftIdMonth(
        uint256 _nftId,
        uint256 _month
    ) public view returns (uint256 _rewardNftIdMonthShares, uint256 _rewardNftIdMonthLevel) {
        if (_month == 0) {
            return (0, 0);
        }
        uint256 monthPrev = _month - 1;
        uint256 shares = nft.getShares(_nftId, monthPrev);
        if (shares == 0) {
            return (0, 0);
        }

        uint256 sharesReward = _getSharesReward(shares, _month);
        if (shares <= SHARES_LEVEL_ZERO || totalLevelClaimed >= TOTAL_LEVEL_REWARDS) {
            return (sharesReward, 0);
        } else {
            uint256 levelsReward = _getLevelsReward(shares);
            return (sharesReward, levelsReward);
        }
    }

    /**
     * @notice Calculates the reward from shares of a nftId for a specific month based on the total rewards of this month and shares of the previous month.
     * @dev This function is for the front-end to get this amount.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _sharesReward Reward a nft in a specific month based on shares.
     */
    function getSharesRewardNftIdMonth(uint256 _nftId, uint256 _month) public view returns (uint256 _sharesReward) {
        if (_month == 0) {
            return 0;
        }
        uint256 monthPrev = _month - 1;
        uint256 shares = nft.getShares(_nftId, monthPrev);
        if (shares == 0) {
            return 0;
        }
        _sharesReward = _getSharesReward(shares, _month);
    }

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the level of the nft.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _levelsReward Reward for a nft in a specific month based on the nft level.
     */
    function getLevelsRewardNftIdMonth(uint256 _nftId, uint256 _month) public view returns (uint256 _levelsReward) {
        if (_month == 0) {
            return 0;
        }
        uint256 monthPrev = _month - 1;
        uint256 shares = nft.getShares(_nftId, monthPrev);
        if (shares <= SHARES_LEVEL_ZERO) {
            return 0;
        }
        _levelsReward = _getLevelsReward(shares);
    }

    /****
     **** INTERNAL VIEW
     ****/

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month and shares of the previous month.
     * @param _shares Amount of shares of this nft.
     * @param _month Month for which you want to get the reward amount.
     * @return _sharesReward Reward for an amount of shares in a specific month based on shares.
     */
    function _getSharesReward(uint256 _shares, uint256 _month) internal view returns (uint256 _sharesReward) {
        uint256 monthPrev = _month - 1;
        (uint256 totalShares, , ) = nft.getTotals(monthPrev);
        if (totalShares == 0) {
            return 0;
        }
        uint256 rewardTotalMonth = getSharesRewardTotalMonth(_month);
        _sharesReward = (_shares * rewardTotalMonth) / totalShares;
    }

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the level of the nft.
     * @param _shares Amount of shares of this nft.
     * @return _levelsReward Reward for an amount of shares in a specific month based on the nft level.
     */
    function _getLevelsReward(uint256 _shares) internal view returns (uint256 _levelsReward) {
        uint256 nftIdLevel = levelShares[uint16(_shares)];
        _levelsReward = nftIdLevel * REWARD_LEVEL_MONTH;
    }
}
