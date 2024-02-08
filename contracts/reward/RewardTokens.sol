// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "./../interface/IRewarder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error ClaimNotAllowed();
error WithdrawWorkNotAllowed();

/**
 * @notice RewardTokens rewards users that hold an NFT based on the amount of tokens staked in the NFT:
 *    The amount of tokens staked in the NFT in the previous month determines the amount of $WORK tokens that can be claimed.
 *    This reward is capped by 1,386,516 $WORK tokens, and spread out over 40 months, giving a predetermined total reward portions per month,
 *    that are shared proportionally by all NFTs based on the amount of tokens staked in them.
 */
contract RewardTokens is Ownable, IRewarder {
    using SafeERC20 for IERC20;

    IGenesisNft immutable nft;
    IERC20 immutable workToken;

    uint256 private constant REWARD_MONTHS = 40;
    uint256 private constant ONE_E18 = 10 ** 18;

    address public rewardWrapper;
    mapping(uint256 => uint256) public claimed;
    mapping(uint256 => uint256) public monthClaimed;

    /**
     * @notice  The formula is: (40000 - sqrt(month * 40000000)) * 10 / 4 , but is multiplied by 10 ** 18 to get the amount in wei.
     * Array with total reward amounts per month, filled with the formula above.
     */
    uint24[REWARD_MONTHS] public rewards = [
        100000,
        84189,
        77639,
        72614,
        68377,
        64645,
        61270,
        58167,
        55279,
        52566,
        50000,
        47560,
        45228,
        42991,
        40839,
        38763,
        36754,
        34808,
        32918,
        31080,
        29289,
        27543,
        25838,
        24171,
        22540,
        20943,
        19377,
        17842,
        16334,
        14853,
        13397,
        11966,
        10557,
        9170,
        7805,
        6459,
        5132,
        3823,
        2532,
        1258
    ];

    event Claimed(uint256 indexed nftId, address indexed claimer, uint256 amountClaimed);

    /**
     * @notice Initializes the RewardTokens contract with the given addresses.
     * @param _genesisNftAddress The address of the Genesis NFT contract.
     * @param _workTokenAddress The address of the WORK token contract.
     */
    constructor(address _genesisNftAddress, address _workTokenAddress) {
        nft = IGenesisNft(_genesisNftAddress);
        workToken = IERC20(_workTokenAddress);
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
            IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);
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

        uint256 claimableNftId = getClaimable(_nftId);

        if (claimableNftId > 0) {
            claimed[_nftId] += claimableNftId;
            monthClaimed[_nftId] = currentMonth;
            nft.reward(_nftId, claimableNftId);
            emit Claimed(_nftId, msg.sender, claimableNftId);
        }
        return;
    }

    /**
     * @notice Set the reward wrapper address, only callable by the contract owner.
     * @param _rewardWrapper Address of the reward wrapper contract.
     */
    function setRewardWrapper(address _rewardWrapper) external onlyOwner {
        rewardWrapper = _rewardWrapper;
    }

    /****
     **** PUBLIC VIEW
     ****/

    /**
     * @notice Amount of tokens currently claimable, which is all rewards of a nftId that have not been claimed yet.
     * @dev Calculates the reward for a nftId by summing the rewards of all previous months from month after last claim.
     * @param _nftId Id of the nft for which you want to find the claimable amount.
     * @return _claimable Amount of tokens currently claimable.
     */
    function getClaimable(uint256 _nftId) public view returns (uint256 _claimable) {
        uint256 currentMonth = nft.getCurrentMonth();

        for (uint256 i = monthClaimed[_nftId] + 1; i <= currentMonth; ++i) {
            _claimable += getRewardNftIdMonth(_nftId, i);
        }
    }

    /**
     * @notice Get the total reward for a specific month according to the rewards array. In month 0 there is no reward and from month 1,
     * the rewards are stored in the array.
     * @param _month Month for which you want to find the total reward.
     * @return _rewardTotalMonth Total reward in specific month.
     */
    function getRewardTotalMonth(uint256 _month) public view returns (uint256 _rewardTotalMonth) {
        if (_month > REWARD_MONTHS || _month == 0) {
            return 0;
        }
        _rewardTotalMonth = rewards[_month - 1] * ONE_E18;
    }

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month and the minimum staked of the previous month.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonth Reward of a nftId for a specific month based on tokens staked.
     */
    function getRewardNftIdMonth(uint256 _nftId, uint256 _month) public view returns (uint256 _rewardNftIdMonth) {
        if (_month == 0) {
            return 0;
        }

        uint256 monthPrev = _month - 1;

        (, , uint256 totalMinimum) = nft.monthlyTotal(monthPrev);
        if (totalMinimum == 0) {
            (, uint256 totalBalance, ) = nft.getTotals(monthPrev);
            if (totalBalance == 0) {
                return 0;
            } else {
                totalMinimum = totalBalance;
            }
        }

        (, uint256 nftIdMinimum) = nft.getStaked(_nftId, monthPrev);
        if (nftIdMinimum == 0) {
            return 0;
        }

        uint256 rewardTotalMonth = getRewardTotalMonth(_month);

        _rewardNftIdMonth = (nftIdMinimum * rewardTotalMonth) / totalMinimum;
    }
}
