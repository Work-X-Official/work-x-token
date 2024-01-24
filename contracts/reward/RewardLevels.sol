// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "./../interface/IGenesisNft.sol";
import "./../interface/IRewarder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error ClaimNotAllowed();

contract RewardLevels is Ownable, IRewarder {
    IGenesisNft public nft;
    IERC20 public workToken;

    address public rewardWrapper;

    mapping(uint256 => uint256) public claimed;

    uint256 private constant REWARD_MONTHS = 40;
    uint256 private constant ONE_E18 = 10 ** 18;


    uint256 private constant REWARD_LEVEL_MONTH = 50 * ONE_E18;

    mapping(uint16 => uint8) public levelShares;
    mapping(uint256 => uint256) public monthClaimed;


    event Claimed(uint256 indexed nftId, address indexed claimer, uint256 amountClaimed);


    /**
     * @notice Initializes the RewardLevels contract with the given addresses.
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
     * @return _success True if the operation was successful.
     **/
    function approve(address _spender, uint256 _amount) external onlyOwner returns (bool _success) {
        _success = workToken.approve(_spender, _amount);
    }


    /**
     * @notice Set in levelShares, which level you are based on which amount of shares you have. only callable by the contract owner.
     * @param _levelShares Array of shares in each level.
     */
    function setLevelShares(uint16[81] memory _levelShares) external onlyOwner {
        for (uint8 i = 0; i < _levelShares.length; ++i) {
            levelShares[_levelShares[i]] = i;
        }
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
     * @notice Calculates the reward of a nftId for a specific month based. In each month, an nft gets the REWARD_LEVEL_MONTH per level.
     * @param _nftId Id of the nft for which you want to get the reward amount.
     * @param _month Month for which you want to get the reward amount.
     * @return _rewardNftIdMonth Reward of a nftId for a specific month based on the level of the nft.
     */
    function getRewardNftIdMonth(
        uint256 _nftId,
        uint256 _month
    ) public view returns (uint256 _rewardNftIdMonth) {
        if (_month > REWARD_MONTHS || _month == 0) {
            return 0;
        }
        uint256 monthPrev = _month - 1;

        uint256 nftIdShares = nft.getShares(_nftId, monthPrev);
        if (nftIdShares == 0 || nftIdShares == 51) {
            return 0;
        }

        uint256 nftIdLevel = levelShares[uint16(nftIdShares)];

        _rewardNftIdMonth = nftIdLevel * REWARD_LEVEL_MONTH;
    }
}
