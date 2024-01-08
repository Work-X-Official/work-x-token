// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NftNotOwned();

abstract contract RewardBase is Ownable {
    IGenesisNft public nft;
    IERC20 public workToken;

    mapping(uint256 => uint256) public claimed;

    uint256 private constant REWARD_MONTHS = 40;
    uint256 private constant ONE_E18 = 10 ** 18;

    /**
     * @notice  The formula is: (40000 - sqrt(month * 40000000)) * 10 / 4 , but is multiplied by 10 ** 18 to get the amount in wei.
     * Array with total reward amounts per month, filled with the formula above.
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
     * @notice Initializes the contract with given addresses.
     * @param _genesisNftAddress Address of the Genesis NFT contract.
     * @param _workTokenAddress Address of the WORK token contract.
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
     * @dev A failsafe for any token stuck in this contract. Only callable by the contract owner.
     * @param _tokenAddress Address of the ERC20 token contract.
     * @param _amount Amount of the ERC20 token to withdraw.
     **/
    function withdrawTokens(address _tokenAddress, uint256 _amount) external payable onlyOwner {
        IERC20(_tokenAddress).transfer(msg.sender, _amount);
    }

    /**
     * @notice Approve a spender to spend an amount of WORK tokens from this contract, only callable by the contract owner.
     * @param _spender Address of the spender.
     * @param _amount Amount of the WORK token to approve.
     **/
    function approve(address _spender, uint256 _amount) external onlyOwner {
        workToken.approve(_spender, _amount);
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice Claim the claimable reward of a nftId into the nft contract, can be done by the owner of the nftId.
     * @param _nftId Id of the nft in which you want to claim the reward.
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
     * @notice Amount of tokens currently claimable, which is all rewards of an nftId that have not been claimed yet.
     * @param _nftId Id of the nft that you want to find the claimable amount for.
     */
    function claimable(uint256 _nftId) public view returns (uint256 _claimable) {
        _claimable = getRewardNftId(_nftId) - claimed[_nftId];
    }


    /**
     * @notice Calculates the reward for a nftId by summing the rewards of all previous months.
     * @dev It loops of all previous months and calls the function that calculates the reward for a specific month,
     *  starting at the 1 first month, since in month 0 you cannot claim anything.
     * @param _nftId Id of the nft for which you want to find the reward.
     * @return _rewardNftId Rewards of a nftId by summing the rewards of all previous months.
     */
    function getRewardNftId(uint256 _nftId) public view returns (uint256 _rewardNftId) {
        uint256 currentMonth = nft.getCurrentMonth();
        if(currentMonth == 0) {
            return 0;
        }
        for (uint256 i = 1; i <= currentMonth; i++) {
            _rewardNftId += getRewardNftIdMonth(_nftId, i);
        }
    }

    /**
     * @notice Calculates the reward of a nftId for a specific month based on the total rewards of this month
     * and the minimum amount staked or shares of the previous month.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonth Reward of a nftId for a specific month based on stake of the previous month.
     */
    function getRewardNftIdMonth(uint256 _nftId, uint256 _month) public view virtual returns (uint256 _rewardNftIdMonth);


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
}
