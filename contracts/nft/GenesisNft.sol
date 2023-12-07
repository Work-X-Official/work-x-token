// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import "./GenesisNftData.sol";
import "./../interface/ITokenDistribution.sol";
import "./../interface/IWorkToken.sol";

import "hardhat/console.sol";

contract GenesisNft is ERC721, Ownable, ReentrancyGuard, EIP712 {
    GenesisNftData private immutable nftData;
    ITokenDistribution private immutable tokenDistribution;
    IWorkToken private immutable token;

    uint256 constant BASE_STAKE = 50;
    uint256 constant TYPE_GUAR = 0;
    uint256 constant TYPE_FCFS = 1;
    uint256 constant TYPE_INV = 2;
    uint256 constant DAILY_STAKING_ALLOWANCE = 294;
    uint256 constant COUNT_GUAR = 350;
    uint256 constant COUNT_FCFS = 150;
    uint256 constant COUNT_INV = 499;
    uint256 constant ONE_E18 = 10 ** 18;

    uint128 public startTime;
    uint16 public nftIdCounter;
    uint8 public initCompleted = 0;

    string private imageBaseURI = "ipfs://";
    string private imageFolder = "QmdXcctk5G1rkqFuqsEAVhoKxJ6tMoV1fjqYRXri3VY47b";
    address private voucherSigner;

    mapping(address => bool) public accountMinted;
    mapping(address => bool) private isRewarder;
    mapping(uint256 => NftTotalMonth) public monthlyTotal; // change to uint256
    struct NftTotalMonth {
        uint32 totalShares;
        uint128 totalStaked;
        uint128 minimumStaked;
    }

    mapping(uint256 => NftInfo) public nft;
    struct NftInfo {
        uint16 tier;
        uint16 voucherId;
        uint64 lockPeriod;
        uint128 stakedAtMint;
        bytes32 encodedAttributes;
        mapping(uint256 => NftInfoMonth) monthly;
    }
    struct NftInfoMonth {
        uint16 shares;
        uint8 hasWithdrawn;
        uint128 staked;
        uint128 minimumStaked;
    }

    event Stake(uint256 indexed tokenId, uint256 amount);
    event Unstake(uint256 indexed tokenId, uint256 amount);
    event Evolve(uint256 indexed tokenId, uint256 tier);
    event Destroy(uint256 indexed tokenId);

    /**
     * @notice Deploying the NFT contract and sets the Admin role and references Erc20 Token, TokenDistribution and NftData contracts.
     * @dev Requires the Erc20Token, TokenDistribution and NftData contracts to be deployed first and they addresses set to the constants.
     * @param _nftName The name of the nft, which will be Work X Genesis NFT in this case.
     * @param _nftSymbol The symbol of the nft, which will be Work X Genesis NFT in this case.
     * @param _workTokenAddress The address of the $WORK token contract (ERC20).
     * @param _tokenDistributionAddress The TokenDistribution address that will be used to mint tokens and update the claimed amount.
     * @param _nftDataAddress The address of the NftData contract that will be used to get the data for the nft, like how many tokens are needed for each level.
     **/
    constructor(
        string memory _nftName,
        string memory _nftSymbol,
        address _workTokenAddress,
        address _tokenDistributionAddress,
        address _nftDataAddress,
        address _voucherSigner
    ) ERC721(_nftName, _nftSymbol) EIP712(_nftName, "1.0.0") {
        require(_workTokenAddress != address(0), "GenesisNft: Invalid token address");
        require(_tokenDistributionAddress != address(0), "GenesisNft: Invalid token distribution address");
        token = IWorkToken(_workTokenAddress);
        tokenDistribution = ITokenDistribution(_tokenDistributionAddress);
        nftData = GenesisNftData(_nftDataAddress);
        voucherSigner = _voucherSigner;
        startTime = uint128(block.timestamp + 12 days);
    }

    /****
     **** ONLY OWNER
     ****/

    /**
     * @notice Sets the IPFS folder where the NFT images are stored.
     * @param _folder The folder that will be set.
     **/
    function setIpfsFolder(string calldata _folder) external onlyOwner {
        imageFolder = _folder;
    }

    /**
     * @notice Sets initCompleted to 1
     * @dev This is used to make sure that the attributes can not be changed after the init is completed.
     **/
    function setInitCompleted() external onlyOwner {
        initCompleted = 1;
    }

    /**
     * @notice Sets the attributes for a batch of NFTs.
     * @param _tokenId The tokenId of the NFT.
     * @param _encodedAttributes The 11 NFT attributes encoded in a bytes32.
     **/
    function setNftAttributes(uint256[] calldata _tokenId, bytes32[] calldata _encodedAttributes) external onlyOwner {
        require(initCompleted == 0, "GenesisNft: The NFT attributes can not be changed after the init is completed");
        for (uint256 id = 0; id < _tokenId.length; id++) {
            nft[_tokenId[id]].encodedAttributes = _encodedAttributes[id];
        }
    }

    /**
     * @notice Sets the address of the Voucher Signer.
     * @param _voucherSigner Address of the vouchersigner that will be set.
     **/
    function setVoucherSigner(address _voucherSigner) external onlyOwner {
        voucherSigner = _voucherSigner;
    }

    /**
     * @notice Sets or unsets a specific address to be a rewarder, they can add tokens to any NFT bypassing the stakingAllowance.
     * @param _rewarder Address of the vouchersigner that will be set.
     **/
    function setRewarder(address _rewarder, bool _isRewarder) external onlyOwner {
        isRewarder[_rewarder] = _isRewarder;
    }

    /**
     * @notice Sets the start time of the NFT reward mechanism.
     * @param _startTime The new start time.
     **/
    function setStartTime(uint256 _startTime) external onlyOwner {
        _startTime = uint256(uint128(_startTime));
        require(startTime > block.timestamp, "GenesisNft: The reward mechanism has already started");
        require(_startTime > block.timestamp, "GenesisNft: The startTime must be in the future");
        startTime = uint128(_startTime);
    }

    /**
     * @notice After the minting period has ended, the remaining NFT will be minted to the treasury account.
     **/
    function mintRemainingToTreasury() external onlyOwner {
        for (uint256 i = nftIdCounter; i <= 999; i++) {
            nftIdCounter += 1;
            _safeMint(owner(), nftIdCounter);
        }
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice The function mintNft mints the Work X GenesisNft and mints an amount of tokens into the NFT these tokens are locked for a certain amount of time but the NFT is freely tradable.
     *  A voucher is constructed by Work X backend and only callers with a valid voucher can mint the NFT.
     * @dev Before giving out vouchers the tokenDistribution startTime has to be set, otherwise the tokens will not be locked correctly.
     * @dev Only the caller of the mintNft function can be the receiving _account, because evolveTier is checking if the msg.sender is the owner of the nft.
     * @param _account The address of the account that will receive the NFT.
     * @param _voucherId The id of the voucher that will be used to mint the NFT, each voucher can only be used once for an NFT with a tokenID.
     * @param _type The id of the minting type.
     * @param _lockPeriod The amount of time that the tokens will be locked in the NFT from the startTime of the distribution contract.
     * @param _amountToStake The amount of tokens that will be staked into the minted NFT.
     * @param _signature A signature signed by the minter role, to check if a voucher is valid.
     **/
    function mintNft(
        address _account,
        uint256 _voucherId,
        uint256 _type,
        uint256 _lockPeriod,
        uint256 _amountToStake,
        bytes calldata _signature
    ) external nonReentrant {
        require(accountMinted[_account] == false, "GenesisNft: This account already minted an NFT");
        bytes32 digest = _hashMint(_voucherId, _type, _lockPeriod, _account, _amountToStake);
        require(nftData.verify(digest, _signature, voucherSigner), "GenesisNft: Invalid signature");

        uint256 oldCounter = nftIdCounter;
        if (_type == TYPE_GUAR) {
            require(oldCounter < COUNT_GUAR, "GenesisNft: No more guaranteed spots.");
        } else if (_type == TYPE_FCFS) {
            require(oldCounter < COUNT_GUAR + COUNT_FCFS, "GenesisNft: No more first-come first-serve spots.");
        } else if (_type == TYPE_INV) {
            require(oldCounter < COUNT_GUAR + COUNT_FCFS + COUNT_INV, "GenesisNft: No more early contributor spots.");
        } else {
            revert("GenesisNft: All NFT's have been minted");
        }

        accountMinted[_account] = true;

        if (_amountToStake > 0) {
            if (tokenDistribution.claimedTokens(_account) == 0) {
                tokenDistribution.setTotalClaimed(_account, _amountToStake);
            } else {
                _amountToStake = 0;
            }
        }

        nftIdCounter += 1;
        uint256 newCounter = nftIdCounter;
        NftInfo storage _nft = nft[newCounter];
        _nft.voucherId = uint16(_voucherId);
        _nft.lockPeriod = uint64(_lockPeriod);
        _nft.stakedAtMint = uint128(_amountToStake);
        uint256 level = nftData.getLevel(_amountToStake);
        _nft.tier = uint16(level / 10);

        NftInfoMonth memory _info;
        _info.staked = uint128(_amountToStake);
        _info.minimumStaked = uint128(_amountToStake);
        _info.shares = uint16(nftData.shares(level) + BASE_STAKE);
        _nft.monthly[0] = _info;

        NftTotalMonth storage totalMonthly = monthlyTotal[0];
        totalMonthly.minimumStaked += uint128(_amountToStake);
        totalMonthly.totalStaked += uint128(_amountToStake);
        totalMonthly.totalShares += _info.shares;

        if (_amountToStake > 0) {
            token.mint(address(this), _amountToStake);
        }
        _safeMint(_account, newCounter);
    }

    /**
     * @notice The function destroyNft destroys your NFT and gives you back the tokens in that NFT. Your "Piggy bank will be destroyed forever."
     * @dev In order to destroy an NFT you need to be the owner, the lockPeriod should have passed, and it should be approved.
     *  The nonReentrant modifier is used to make extra sure people will not be able to extract more tokens. On top of the checks-effects pattern
     *  Its fine to use the block.timestamp for the comparison because the miner can not manipulate the block.timestamp by a practically significant amount.
     *  It is oke to use block.timestamp for comparison, because miner
     * @param _tokenId The id of the NFT that will destroyed.
     **/
    function destroyNft(uint256 _tokenId) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        require(
            block.timestamp > nft[_tokenId].lockPeriod + startTime,
            "GenesisNft: The NFT is still time-locked, so you can not destroy it yet"
        );
        uint256 currentMonth = getCurrentMonth();
        (uint256 stakedAmount, ) = getStaked(_tokenId, currentMonth);

        _updateMonthly(_tokenId, false, stakedAmount, currentMonth);
        _updateShares(_tokenId, false);

        NftInfoMonth storage _nftMonth = nft[_tokenId].monthly[currentMonth];
        _nftMonth.hasWithdrawn = 1;

        _burn(_tokenId);
        token.transfer(msg.sender, stakedAmount);

        emit Destroy(_tokenId);
    }

    /**
     * @notice The stake function stakes an amount of tokens into an NFT of the owner.
     * @dev The amount that can be staked for a specific tokenId builds up over time. You can only stake up to this allowance and you need own enough tokens.
     * @param _tokenId The id of the nft that will receive the tokens.
     * @param _amount The amount of tokens that will be staked.
     **/
    function stake(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        (uint256 stakedAmount, ) = getStaked(_tokenId, getCurrentMonth());
        if (nftData.getLevel(stakedAmount) < 80) {
            uint256 allowance = _getStakingAllowance(_tokenId, stakedAmount);
            require(_amount <= allowance, "GenesisNft: The amount you want to stake is more than the total allowance");
        }
        _stake(_tokenId, _amount);
    }

    /**
     * @notice The reward function stakes an amount of tokens into any NFT, bypassing the stakingAllowance.
     * @dev Rewarders can stake tokens into any NFT, which potentially increases its level but does not evolve it to the next tier.
     * @param _tokenId The id of the nft that will receive the tokens.
     * @param _amount The amount of tokens that will be staked.
     **/
    function reward(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(isRewarder[msg.sender], "GenesisNft: You are not a rewarder!");
        _stake(_tokenId, _amount);
    }

    /**
     * @notice The stakeAndEvolve function stakes tokens and afterwards evolves the NFT to the a higher tier if applicable.
     * @param _tokenId The id of the NFT.
     * @param _amount a string which is the tokenURI of an NFT.
     **/
    function stakeAndEvolve(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        (uint256 stakedAmount, ) = getStaked(_tokenId, getCurrentMonth());
        if (nftData.getLevel(stakedAmount) < 80) {
            uint256 allowance = _getStakingAllowance(_tokenId, stakedAmount);
            require(_amount <= allowance, "GenesisNft: The amount you want to stake is more than the total allowance");
        }
        _stake(_tokenId, _amount);
        _evolveTier(_tokenId);
    }

    /**
     * @notice The unstake function unstakes an amount of tokens from the NFT with a specific tokenId
     * @dev You can only unstake tokens after the lockPeriod has passed, and even then you can not unstake more than the minimum amount of tokens that is required to make the NFT level 10 in the current tier.
     * If an NFT evolves to the next tier it has to reach level 10 first and only the tokens that are above the minimum amount of tokens required to reach level 10 in the current tier can be unstaked. We call this unstakable amount "Surplus"
     * @param _tokenId The id of the NFT that will receive the tokens.
     * @param _amount The amount of tokens that will be staked.
     **/
    function unstake(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        NftInfo storage _nft = nft[_tokenId];
        require(
            block.timestamp > _nft.lockPeriod + startTime,
            "GenesisNft: The NFT is still time-locked, so you cannot unstake"
        );
        uint256 currentMonth = getCurrentMonth();
        (uint256 stakedAmount, ) = getStaked(_tokenId, currentMonth);
        uint256 tokensRequiredForMaxLevelInTier = nftData.getTokensRequiredForTier(_nft.tier + 1);
        require(
            tokensRequiredForMaxLevelInTier <= stakedAmount - _amount,
            "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier"
        );

        _updateMonthly(_tokenId, false, _amount, currentMonth);

        NftInfoMonth storage _nftMonth = _nft.monthly[currentMonth];
        _nftMonth.hasWithdrawn = 1;

        token.transfer(msg.sender, _amount);
    }

    /**
     * @notice Tries to evolve the tier if you are the owner of the NFT.
     **/
    function evolveTier(uint256 _tokenId) external {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        _evolveTier(_tokenId);
    }

    /****
     **** private WRITE
     ****/

    /**
     * @notice The _updateShares function updates the shares of an NFT, it needs to calculate the shares amount when an NFT changes level, or tier, or when it is destroyed.
     * @dev It calculates the new amount of shares of an nft, and then updates both the total, and NFT specific shares amounts.
     *      Note that unstaking does never change shares because the level can not decrease, only destroying an NFT does.
     * @param _tokenId The id of the NFT of which the shares will be updated.
     * @param _isIncreasingShares True if we have to add shares, false if we need to subtract shares.
     **/
    function _updateShares(uint256 _tokenId, bool _isIncreasingShares) private {
        uint256 currentMonth = getCurrentMonth();
        uint256 nftSharesOld = getShares(_tokenId, currentMonth);
        uint256 totalSharesCurrentMonth = _getTotalShares(currentMonth);
        NftTotalMonth storage _nftMonthTotal = monthlyTotal[currentMonth];
        NftInfo storage _nft = nft[_tokenId];
        NftInfoMonth storage _nftMonthToSet = _nft.monthly[currentMonth];
        for (uint256 i = currentMonth + 1; i >= 1; --i) {
            NftInfoMonth memory _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1 || i == 1) {
                if (_isIncreasingShares) {
                    uint256 nftSharesNew = nftData.shares(nftData.getLevelCapped(_nftMonth.staked, _nft.tier)) +
                        BASE_STAKE;
                    _nftMonthToSet.shares = uint16(nftSharesNew);
                    _nftMonthTotal.totalShares = uint32(totalSharesCurrentMonth + nftSharesNew - nftSharesOld);
                } else {
                    _nftMonthToSet.shares = 0;
                    _nftMonthTotal.totalShares = uint32(totalSharesCurrentMonth - nftSharesOld);
                }
                break;
            }
        }
    }

    /**
     * @notice Increases the tier of an NFT.
     * @dev It recalculates the tier of an NFT and set it, als the amount of shares is updated as we might jump several tiers/levels at once.
     * @param _tokenId The id of the NFT.
     **/
    function _evolveTier(uint256 _tokenId) private {
        (uint256 staked, ) = getStaked(_tokenId, getCurrentMonth());
        uint256 tier = nftData.getLevel(staked) / 10;
        NftInfo storage _nft = nft[_tokenId];
        _nft.tier = uint16(tier);
        _updateShares(_tokenId, true);
        emit Evolve(_tokenId, tier);
    }

    /**
     * @notice The _stake function stakes an amount of tokens into an NFT of the owner.
     * @dev The amount that can be staked for a specific tokenId builds up over time. You can only stake up to this allowance and you need own enough tokens.
     *      The _updateMonthly function is called to update the monthly totals and the monthly totals of the NFT.
     *      The _updateShares function is called to update the shares totals and the shares of the NFT.
     *      The token.transferFrom function is called to transfer the tokens from the sender to the contract.
     * @param _tokenId The id of the NFT.
     * @param _amount The amount that will be staked.
     **/
    function _stake(uint256 _tokenId, uint256 _amount) private {
        _updateMonthly(_tokenId, true, _amount, getCurrentMonth());
        _updateShares(_tokenId, true);
        token.transferFrom(msg.sender, address(this), _amount);
        emit Stake(_tokenId, _amount);
    }

    /**
     * @notice _updateMonthly updates the monthly balance of an NFT, as well as the global totals.
     * @dev Important: For - Loop through the previous months and to find the last non-zero value for "nft.monthly" Because you might have tokens in a month, but if you did not stake/unstake in that month, the value for that month will be never set (0).
     * @param _tokenId The id of the NFT.
     * @param _isIncreasingStake Whether the amount of tokens staked is increasing or decreasing.
     * @param _amount The amount of tokens staked.
     * @param _amount The month at which we are looking.
     **/
    function _updateMonthly(uint256 _tokenId, bool _isIncreasingStake, uint256 _amount, uint256 _month) private {
        NftInfo storage _nft = nft[_tokenId];
        NftInfoMonth storage _nftMonthToSet = _nft.monthly[_month];
        NftTotalMonth storage _totalToSet = monthlyTotal[_month];
        uint256 _minimumToCheck;
        for (uint256 i = _month + 1; i >= 1; --i) {
            NftInfoMonth memory _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1 || i == 1) {
                uint256 _minimumDecreased;
                if (_isIncreasingStake) {
                    _nftMonthToSet.staked = _nftMonth.staked + uint128(_amount);
                    if (i < _month + 1) {
                        _nftMonthToSet.minimumStaked = _nftMonth.staked;
                    } else {
                        _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked;
                    }
                } else {
                    if (_nftMonth.staked >= _amount) {
                        _nftMonthToSet.staked = _nftMonth.staked - uint128(_amount);
                        _minimumToCheck = i < _month + 1 ? _nftMonth.staked : _nftMonth.minimumStaked;
                        if (_nftMonthToSet.staked < _minimumToCheck) {
                            _nftMonthToSet.minimumStaked = _nftMonthToSet.staked;
                            _minimumDecreased = _minimumToCheck - _nftMonthToSet.staked;
                        } else {
                            _nftMonthToSet.minimumStaked = uint128(_minimumToCheck);
                        }
                    } else {
                        revert("GenesisNft: You are trying to unstake more than the total staked in this nft!");
                    }
                }

                for (uint256 ii = _month + 1; ii >= 1; --ii) {
                    // Update monthly totals
                    NftTotalMonth memory _monthlyTotal = monthlyTotal[ii - 1];
                    if (_monthlyTotal.totalStaked > 0 || ii == 1) {
                        if (_isIncreasingStake) {
                            _totalToSet.totalStaked = _monthlyTotal.totalStaked + uint128(_amount);
                            if (ii < _month + 1) {
                                _totalToSet.minimumStaked = _monthlyTotal.totalStaked;
                            }
                        } else {
                            if (_monthlyTotal.totalStaked >= _amount) {
                                _totalToSet.totalStaked = _monthlyTotal.totalStaked - uint128(_amount);
                                _minimumToCheck = ii < _month + 1
                                    ? _monthlyTotal.totalStaked
                                    : _monthlyTotal.minimumStaked;
                                _totalToSet.minimumStaked = uint128(_minimumToCheck - _minimumDecreased);
                            } else {
                                revert("GenesisNft: You are trying to unstake more than the amount staked!");
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }
    }

    /****
     **** PUBLIC VIEW
     ****/

    /**
     * @notice Get the current month number since the reward period has started.
     * @return The current month.
     **/
    function getCurrentMonth() public view returns (uint256) {
        if (block.timestamp < startTime) {
            return 0;
        } else {
            return (block.timestamp - startTime) / 30 days;
        }
    }

    /**
     * @notice Get the currently staked and minimumStaked tokens for a specific NFT at a specific month (looping back).
     * @param _tokenId The id of the NFT.
     * @return stakedAmount The amount of tokens staked in an NFT.
     * @return stakedAmountMinimum The amountMinimum of tokens staked in an NFT.s
     **/
    function getStaked(
        uint256 _tokenId,
        uint256 _month
    ) public view returns (uint256 stakedAmount, uint256 stakedAmountMinimum) {
        NftInfo storage _nft = nft[_tokenId];
        for (uint256 i = _month + 1; i >= 1; --i) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1) {
                if (i == _month + 1) {
                    return (_nftMonth.staked, _nftMonth.minimumStaked);
                } else {
                    return (_nftMonth.staked, _nftMonth.staked);
                }
            }
        }
        return (0, 0);
    }

    /**
     * @notice Get the current shares for a specific NFT at a specific month (looping back).
     * @dev Loops from the current month back over the previous months to find the last time this NFT has been staked or unstaked
     * @param _tokenId The id of the NFT.
     * @return The shares of the NFT.
     **/
    function getShares(uint256 _tokenId, uint256 _month) public view returns (uint256) {
        NftInfo storage _nft = nft[_tokenId];
        for (uint256 i = _month + 1; i >= 1; i--) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.shares > 0 || (_nftMonth.hasWithdrawn == 1 && _nftMonth.staked == 0)) {
                return _nftMonth.shares;
            }
        }
        return 0;
    }

    /**
     * @notice This function gets the tokenURI for this NFT.
     * @dev The tokenURI is dynamically generated, it will be based on the type and level and many other variables and is then formatted.
     * @param _tokenId The id of the NFT.
     * @return _tokenUri a string which is the tokenURI of an NFT.
     **/
    function tokenURI(uint256 _tokenId) public view override returns (string memory _tokenUri) {
        require(_exists(_tokenId), "GenesisNft: URI query for nonexistent tokenId");
        (uint256 staked, , uint256 shares, , , ) = getNftInfo(_tokenId);
        uint256 level = nftData.getLevelCapped(staked, nft[_tokenId].tier);
        NftInfo storage _nft = nft[_tokenId];

        return
            nftData.tokenUriTraits(
                _tokenId,
                level,
                _nft.tier,
                staked,
                shares,
                _nft.encodedAttributes,
                _nft.lockPeriod + startTime,
                startTime,
                string.concat(imageBaseURI, imageFolder, "/")
            );
    }

    /****
     **** EXTERNAL VIEW
     ****/

    /**
     * @notice Aggregates the information of a given NFT.
     * @dev This function can be used to get all relevant data at once so that you do not have to do many blockchain calls in sequence.
     * @param _tokenId The id of the NFT.
     * @return _staked The amount of tokens staked in an NFT.
     * @return _stakingAllowance The total amount of tokens you are still allowed to stake.
     * @return _shares The shares of the NFT.
     * @return _level The level of the NFT.
     * @return _tier The tier of the NFT.
     * @return _lockPeriod The period the NFT is locked for.
     **/
    function getNftInfo(
        uint256 _tokenId
    )
        public
        view
        returns (
            uint256 _staked,
            uint256 _stakingAllowance,
            uint256 _shares,
            uint256 _level,
            uint256 _tier,
            uint256 _lockPeriod
        )
    {
        NftInfo storage _nft = nft[_tokenId];
        for (uint256 i = getCurrentMonth() + 1; i >= 1; --i) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1) {
                _staked = _nftMonth.staked;
                break;
            }
        }
        for (uint256 i = getCurrentMonth() + 1; i >= 1; --i) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.shares > 0 || (_nftMonth.hasWithdrawn == 1 && _nftMonth.staked == 0)) {
                _shares = _nftMonth.shares;
                break;
            }
        }
        _stakingAllowance = _getStakingAllowance(_tokenId, _staked);
        _tier = _nft.tier;
        _level = nftData.getLevelCapped(_staked, _tier);
        _lockPeriod = _nft.lockPeriod;
        return (_staked, _stakingAllowance, _shares, _level, _tier, _lockPeriod);
    }

    /**
     * @notice Gets the token ids that a wallet owns.
     * @dev It loops over the tokenIds array and finds the owners of each id and then returns the array of ids.
     * @param _nftOwner The address of the owner.
     * @return tokenIds The array of token ids that the owner has.
     **/
    function getIdsFromWallet(address _nftOwner) external view returns (uint256[] memory tokenIds) {
        tokenIds = new uint256[](balanceOf(_nftOwner));
        uint256 counter = 0;
        for (uint256 i = 1; i <= nftIdCounter; i++) {
            if (super._exists(i) && ownerOf(i) == _nftOwner) {
                tokenIds[counter] = i;
                counter++;
            }
        }
        return tokenIds;
    }

    /**
     * @notice Aggregate function that returns the total shares, total balance and total minimum balance for a specific month.
     * @dev The function loops back to prior months if the current month has no data.
     * @param _month The specific month.
     * @return _totalShares The total shares for that month.
     * @return _totalBalance The total staked tokens that month.
     * @return _minimumBalance The minimum total staked tokens that month.
     **/
    function getTotals(
        uint256 _month
    ) external view returns (uint256 _totalShares, uint256 _totalBalance, uint256 _minimumBalance) {
        _totalShares = monthlyTotal[_month].totalShares;
        _totalBalance = monthlyTotal[_month].totalStaked;
        _minimumBalance = monthlyTotal[_month].minimumStaked;
        if (_month > 0 && _totalBalance == 0) {
            for (uint256 i = _month + 1; i >= 1; i--) {
                NftTotalMonth storage _monthlyTotal = monthlyTotal[i - 1];
                if (_monthlyTotal.totalStaked > 0 || i <= 1) {
                    _totalBalance = _monthlyTotal.totalStaked;
                    _minimumBalance = _monthlyTotal.minimumStaked;
                    break;
                }
            }
        }
        if (_month > 0 && _totalShares == 0) {
            for (uint256 i = _month + 1; i >= 1; i--) {
                NftTotalMonth storage _monthlyTotal = monthlyTotal[i - 1];
                if (_monthlyTotal.totalShares > 0 || i <= 1) {
                    _totalShares = _monthlyTotal.totalShares;
                    break;
                }
            }
        }
    }

    /****
     **** private VIEW
     ****/

    /**
     * @notice How much tokens you are allowed to stake into a specific tokenId.
     * @dev It finds the allowance for the passed time since the startTime and calculates how much tokens you are allowed to stake for each.
     *  After it checks how much you have staked already this month and subtracts that.
     * @param _tokenId The id of the nft for which you want to know the total allowance.
     * @return stakingAllowance The total amount of tokens you are currently allowed to stake.
     **/
    function _getStakingAllowance(uint256 _tokenId, uint256 _staked) private view returns (uint256 stakingAllowance) {
        if (startTime > block.timestamp) return 0;

        uint256 accumulatedAllowance = (((((block.timestamp - startTime) / 1 days) * DAILY_STAKING_ALLOWANCE) +
            DAILY_STAKING_ALLOWANCE) * ONE_E18);
        NftInfo storage _nft = nft[_tokenId];
        if (accumulatedAllowance + _nft.stakedAtMint > _staked) {
            stakingAllowance = accumulatedAllowance + _nft.stakedAtMint - _staked;
        } else {
            return 0;
        }
    }

    function _getTotalShares(uint256 _month) private view returns (uint256 sharesTotal) {
        sharesTotal = monthlyTotal[_month].totalShares;
        if (_month > 0 && sharesTotal == 0) {
            uint256 i = _month - 1;
            do {
                if (monthlyTotal[i].totalShares > 0) {
                    sharesTotal = monthlyTotal[i].totalShares;
                    break;
                }
                if (i > 0) {
                    i--;
                } else {
                    break;
                }
            } while (true);
        }
    }

    /**
     * @notice Hashes the data from a voucher that includes the information to mint an NFT.
     * @dev This is done according to the EIP-712 standard. So that it is secure and takes into account context information such as chainId and contract address.
     * @param _voucherId Id of the Voucher
     * @param _type time mint type of the NFT
     * @param _lockPeriod time the NFT will remain locked
     * @param _account address of the minter
     * @param _amountToStake amount of tokens staked directly into the NFT
     **/
    function _hashMint(
        uint256 _voucherId,
        uint256 _type,
        uint256 _lockPeriod,
        address _account,
        uint256 _amountToStake
    ) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFT(uint256 voucherId,uint256 type,uint256 lockPeriod,address account,uint256 amountToStake)"
                        ),
                        _voucherId,
                        _type,
                        _lockPeriod,
                        _account,
                        _amountToStake
                    )
                )
            );
    }
}
