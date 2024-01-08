// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NftNotOwned();

contract RewardTokens is Ownable {
    IGenesisNft public nft;
    IERC20 public workToken;

    mapping(uint256 => uint256) public claimed;

    uint256 private constant REWARD_MONTHS = 40;
    uint256 private constant ONE_E18 = 10 ** 18;

    /**
     * @notice  The formula is: (40000 - sqrt(month * 40000000)) * 10 / 4 , but is multiplied by 10 ** 18 to get the amount in wei.
     * The formula should return the amount for that current month.
     */
    uint24[REWARD_MONTHS] private rewards = [
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
     * @notice initializes the contract with the nft and workToken addresses and the start time of the nft.
     * @param _genesisNftAddress The address of the contract that is staked in on which the rewards will be based, the nft contract.
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
     * @notice Rescue function for the contract owner to withdraw any ERC20 token from this contract.
     * @dev This is also a failsafe in case there is something wrong in the contract the tokens can be recovered.
     * @param _tokenAddress Address of the ERC20 token contract.
     * @param _amount Amount of the ERC20 token to withdraw.
     **/
    function withdrawTokens(address _tokenAddress, uint256 _amount) external payable onlyOwner {
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
    }

    /**
     * @notice Approve a spender to spend a certain amount of ERC20 tokens, only callable by the contract owner.
     * @param _spender Address of the spender.
     * @param _amount Amount of the ERC20 token to approve.
     **/
    function approve(address _spender, uint256 _amount) external onlyOwner {
        workToken.approve(_spender, _amount);
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice Claim the amount the nft is eligble for into the nft.
     * @param _nftId The id of the nft for which you want to claim the rewards.
     */
    function claim(uint256 _nftId) external returns (bool) {
       if (msg.sender != nft.ownerOf(_nftId)) {
            revert NftNotOwned();
        }

        uint256 claimableNftId = claimable(_nftId);

        if (claimableNftId > 0) {
            claimed[_nftId] += claimableNftId;
            nft.reward(_nftId, claimableNftId);
            emit Claimed(_nftId, msg.sender, claimableNftId);
        }
        return true;
    }

    /****
     **** PUBLIC VIEW
     ****/


    /**
     * @notice How much tokens are currently claimable.
     * @param _nftId The id of the nft for which you want to check the claimable amount for.
     */
    function claimable(uint256 _nftId) public view returns (uint256 _claimable) {
        _claimable = getRewardNftId(_nftId) - claimed[_nftId];
    }

    /**
     * @notice Calculates how much a nftId is allowed to claim by finding how much you can claim for each month summed.
     * @dev It loops of all previous months and callls the function that calculates the reward for a specific month,
     *  starting at the 1 first month, since in month 0 you cannot claim anything.
     * @param _nftId The id of the nft for which you want to claim the rewards.
     * @return _totalRewards The total amount that a nftId can claim.
     */
    function getRewardNftId(uint256 _nftId) public view returns (uint256 _totalRewards) {
        uint256 currentMonth = nft.getCurrentMonth();
        if(currentMonth == 0) {
            return 0;
        }
        for (uint256 i = 1; i <= currentMonth; i++) {
            _totalRewards += getRewardNftIdMonth(_nftId, i);
        }
    }

    /**
     * @notice Calculates how much a nftId is allowed to claim for a specific month based on the amount of minimum amount of tokensstaked in a month.
     * @dev The loop over the months from current to previous months is done to find the minimum  value that a user staked in that month.
     * @param _nftId The id of the nft for which you want to find the claimable amount.
     * @param _month The month for which you want to find the claimable amount.
     * @return The amount that a nftId can claim for a specific month.
     */
    function getRewardNftIdMonth(uint256 _nftId, uint256 _month) public view returns (uint256) {
        if (_month == 0) {
            return 0;
        }

        (, , uint256 totalMinimum) = nft.getTotals(_month-1);
        if(totalMinimum == 0) {
            return 0;
        }

        (, uint256 nftIdMinimum) = nft.getStaked(_nftId, _month-1);
        if (nftIdMinimum == 0) {
            return 0;
        }

        uint256 rewardTotalMonth = getRewardTotalMonth(_month);

        uint nftIdRewardMonth = (nftIdMinimum * rewardTotalMonth) / totalMinimum;

        return nftIdRewardMonth;
    }

    /**
     * @notice Get the total reward for a specific month according to the rewards array.
     * @param _month The month for which you want to find the total reward.
     * @return The total reward for a specific month.
     */
    function getRewardTotalMonth(uint256 _month) public view returns (uint256) {
        if (_month > REWARD_MONTHS || _month == 0) {
            return 0;
        }
        uint256 rewardTotalMonth = rewards[_month - 1] * ONE_E18;
        return rewardTotalMonth;
    }
}
