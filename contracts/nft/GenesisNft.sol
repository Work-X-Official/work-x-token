// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./GenesisNftData.sol";
import "./../sale/TokenDistribution.sol";

contract GenesisNft is ERC721, Ownable, ReentrancyGuard, AccessControl, EIP712 {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    GenesisNftData public immutable nftData;
    TokenDistribution public immutable tokenDistribution;
    WorkToken public immutable token;

    uint128 constant ONE_E18 = 10 ** 18;
    uint8 constant BASE_STAKE = 50;
    uint8 constant TYPE_GUAR = 0;
    uint8 constant TYPE_FCFS = 1;
    uint8 constant TYPE_INV = 2;
    uint16 constant DAILY_STAKING_ALLOWANCE = 294;
    uint16 constant COUNT_GUAR = 350;
    uint16 constant COUNT_FCFS = 150;
    uint16 constant COUNT_INV = 499;
    uint16 public nftIdCounter;

    mapping(address => uint16) public accountMinted;

    mapping(uint8 => NftTotalMonth) public monthlyTotal;
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
        string imageUri;
        mapping(uint8 => NftInfoMonth) monthly;
    }
    struct NftInfoMonth {
        uint16 shares;
        uint8 hasWithdrawn;
        uint128 staked;
        uint128 minimumStaked;
    }

    event Stake(uint256 indexed tokenId, uint128 amount);
    event Unstake(uint256 indexed tokenId, uint128 amount);
    event Evolve(uint256 indexed tokenId, uint16 tier);

    /**
     * @notice Deploying the nft contract and sets the Admin role and references Erc20 Token, TokenDistribution and NftData contracts.
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
        address _nftDataAddress
    ) ERC721(_nftName, _nftSymbol) EIP712(_nftName, "1.0.0") {
        require(_workTokenAddress != address(0), "GenesisNft: Invalid token address");
        require(_tokenDistributionAddress != address(0), "GenesisNft: Invalid token distribution address");
        token = WorkToken(_workTokenAddress);
        tokenDistribution = TokenDistribution(_tokenDistributionAddress);
        nftData = GenesisNftData(_nftDataAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /****
     **** PUBLIC WRITE
     ****/

    /**
     * @notice The stake function stakes an amount of tokens into an nft of the owner.
     * @dev The amount that can be staked for a specific tokenId builds up over time. You can only stake up to this allowance and you need own enough tokens.
     * @param _tokenId The id of the nft that will receive the tokens.
     * @param _amount The amount of tokens that will be staked.
     **/
    function stake(uint256 _tokenId, uint128 _amount) public nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        uint128 stakedAmount = getStaked(_tokenId);
        if (nftData.getLevel(stakedAmount) < 80) {
            uint256 allowance = getStakingAllowance(_tokenId, stakedAmount);
            require(_amount <= allowance, "GenesisNft: The amount you want to stake is more than the total allowance");
        }
        _stake(_tokenId, _amount);
    }

    /****
     **** EXTERNAL WRITE
     ****/

    /**
     * @notice The function mintNft mints the Work X GenesisNft and mints an amount of tokens into the NFT these tokens are locked for a certain amount of time but the NFT is freely tradable.
     *  A voucher is constructed by Work X backend and only callers with a valid voucher can mint the NFT.
     * @dev Before giving out vouchers the tokenDistribution startTime has to be set, otherwise the tokens will not be locked correctly.
     * @dev Only the caller of the mintNft function can be the receiving _account, because evolveTier is checking if the msg.sender is the owner of the nft.
     * @param _account The address of the account that will receive the nft.
     * @param _voucherId The id of the voucher that will be used to mint the nft, each voucher can only be used once for an NFT with a tokenID.
     * @param _type The id of the minting type.
     * @param _lockPeriod The amount of time that the tokens will be locked in the NFT from the startTime of the distribution contract.
     * @param _amountToStake The amount of tokens that will be staked into the minted NFT.
     * @param _signature A signature signed by the minter role, to check if a voucher is valid.
     **/
    function mintNft(
        address _account,
        uint16 _voucherId,
        uint16 _type,
        uint64 _lockPeriod,
        uint128 _amountToStake,
        string calldata _imageUri,
        bytes32 _encodedAttributes,
        bytes calldata _signature
    ) external nonReentrant {
        require(accountMinted[_account] == 0, "GenesisNft: This account already minted an NFT");
        bytes32 digest = _hashMint(
            _voucherId,
            _type,
            _lockPeriod,
            _account,
            _amountToStake,
            _imageUri,
            _encodedAttributes
        );
        require(_verify(digest, _signature, SIGNER_ROLE), "GenesisNft: Invalid signature");

        if (_type == TYPE_GUAR) {
            require(nftIdCounter < COUNT_GUAR, "GenesisNft: No more guaranteed spots.");
        } else if (_type == TYPE_FCFS) {
            require(nftIdCounter < COUNT_GUAR + COUNT_FCFS, "GenesisNft: No more first-come first-serve spots.");
        } else if (_type == TYPE_INV) {
            require(nftIdCounter < COUNT_GUAR + COUNT_FCFS + COUNT_INV, "GenesisNft: No more early contributor spots.");
        } else {
            revert("GenesisNft: All NFT's have been minted");
        }

        accountMinted[_account] = 1;
        nftIdCounter += 1;
        _safeMint(_account, nftIdCounter);

        NftInfoMonth memory _info;
        _info.staked = _amountToStake;
        _info.minimumStaked = _amountToStake;

        NftInfo storage _nft = nft[nftIdCounter];
        _nft.voucherId = _voucherId;
        _nft.encodedAttributes = _encodedAttributes;
        _nft.imageUri = _imageUri;
        _nft.lockPeriod = _lockPeriod;
        _nft.stakedAtMint = _amountToStake;
        _nft.monthly[0] = _info;

        _setInitial(nftIdCounter, _amountToStake);
        token.mint(address(this), _amountToStake);
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
            block.timestamp > nft[_tokenId].lockPeriod + tokenDistribution.startTime(),
            "GenesisNft: The NFT is still time-locked, so you can not destroy it yet"
        );

        uint128 stakedAmount = getStaked(_tokenId);
        uint8 currentMonth = getCurrentMonth();
        _updateMonthly(_tokenId, false, stakedAmount, currentMonth);
        _updateShares(_tokenId, false);

        NftInfoMonth storage _nftMonth = nft[_tokenId].monthly[currentMonth];
        _nftMonth.hasWithdrawn = 1;

        _burn(_tokenId);
        _refundTokens(stakedAmount);
    }

    function stakeAndEvolve(uint256 _tokenId, uint128 _amount) external nonReentrant {
        stake(_tokenId, _amount);
        _evolveTier(_tokenId);
    }

    function unstake(uint256 _tokenId, uint128 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        require(
            block.timestamp > nft[_tokenId].lockPeriod + tokenDistribution.startTime(),
            "GenesisNft: The NFT is still time-locked, so you cannot unstake"
        );
        uint256 stakedAmount = getStaked(_tokenId);
        uint256 tokensRequiredForMaxLevelInTier = nftData.getTokensRequiredForTier(nft[_tokenId].tier + 1);
        require(
            tokensRequiredForMaxLevelInTier <= stakedAmount - _amount,
            "GenesisNft: Unable to unstake requested amount, the NFT can not go below max level in this tier"
        );
        uint8 currentMonth = getCurrentMonth();
        _updateMonthly(_tokenId, false, _amount, currentMonth);

        NftInfoMonth storage _nftMonth = nft[_tokenId].monthly[currentMonth];
        _nftMonth.hasWithdrawn = 1;

        _refundTokens(_amount);
        emit Unstake(_tokenId, _amount);
    }

    function evolveTier(uint256 _tokenId) external {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        _evolveTier(_tokenId);
    }

    /****
     **** private WRITE
     ****/

    function _updateShares(uint256 _tokenId, bool _isIncreasingShares) private {
        uint8 currentMonth = getCurrentMonth();
        uint32 nftSharesOld = getShares(_tokenId);
        uint32 totalSharesCurrentMonth = _getTotalShares(currentMonth);
        NftTotalMonth storage _nftMonthTotal = monthlyTotal[currentMonth];
        NftInfoMonth storage _nftMonth = nft[_tokenId].monthly[currentMonth];
        if (_isIncreasingShares) {
            uint16 nftSharesNew = calculateTokenIdShares(_tokenId);
            _nftMonth.shares = nftSharesNew;
            _nftMonthTotal.totalShares = totalSharesCurrentMonth + nftSharesNew - nftSharesOld;
        } else {
            _nftMonth.shares = 0;
            _nftMonthTotal.totalShares = totalSharesCurrentMonth - nftSharesOld;
        }
    }

    function _setInitial(uint256 _tokenId, uint128 _amountToStake) private {
        uint16 tier = nftData.getLevel(getStaked(_tokenId)) / 10;
        NftInfo storage _nft = nft[_tokenId];
        _nft.tier = tier;
        NftInfoMonth storage _nftMonth = _nft.monthly[0];
        _nftMonth.shares = calculateTokenIdShares(_tokenId);

        uint8 _currentMonth = getCurrentMonth();

        for (uint256 i = 0; i <= _currentMonth; i++) {
            NftTotalMonth storage totalMonthly = monthlyTotal[uint8(i)];
            totalMonthly.minimumStaked += _amountToStake;
            totalMonthly.totalStaked += _amountToStake;
            if (totalMonthly.totalShares > 0 || i == 0) {
                totalMonthly.totalShares += _nftMonth.shares;
            }
        }

        emit Evolve(_tokenId, tier);
    }

    function _evolveTier(uint256 _tokenId) private {
        uint16 tier = nftData.getLevel(getStaked(_tokenId)) / 10;
        NftInfo storage _nft = nft[_tokenId];
        _nft.tier = tier;
        _updateShares(_tokenId, true);
        emit Evolve(_tokenId, tier);
    }

    function _stake(uint256 _tokenId, uint128 _amount) private {
        _updateMonthly(_tokenId, true, _amount, getCurrentMonth());
        _updateShares(_tokenId, true);
        token.transferFrom(msg.sender, address(this), _amount);
        emit Stake(_tokenId, _amount);
    }

    function _refundTokens(uint256 _amount) private {
        uint256 amount = token.balanceOf(address(this));
        require(amount >= _amount, "GenesisNft: Not enough $WORK tokens in the contract");
        token.transfer(msg.sender, _amount);
    }

    function _updateMonthly(uint256 _tokenId, bool _isIncreasingStake, uint128 _amount, uint8 _month) private {
        NftInfo storage _nft = nft[_tokenId];
        NftInfoMonth storage _nftMonthToSet = _nft.monthly[_month];
        NftTotalMonth storage _totalToSet = monthlyTotal[_month];
        for (uint256 i = _month + 1; i >= 1; --i) {
            NftInfoMonth memory _nftMonth = _nft.monthly[uint8(i - 1)];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1 || i == 1) {
                if (_isIncreasingStake) {
                    _nftMonthToSet.staked = _nftMonth.staked + _amount;
                    if (i < _month + 1) {
                        _nftMonthToSet.minimumStaked = _nftMonth.staked;
                    } else {
                        _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked;
                    }
                } else {
                    if (_nftMonth.staked >= _amount) {
                        _nftMonthToSet.staked = _nftMonth.staked - _amount;
                        uint128 _minimumToCheck = i < _month + 1 ? _nftMonth.staked : _nftMonth.minimumStaked;
                        if (_nftMonthToSet.staked < _minimumToCheck) {
                            _nftMonthToSet.minimumStaked = _nftMonthToSet.staked;
                        } else {
                            if (i < _month + 1) {
                                _nftMonthToSet.minimumStaked = _nftMonth.staked;
                            } else {
                                _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked;
                            }
                        }
                    } else {
                        revert("GenesisNft: You are trying to unstake more than the total staked in this nft!");
                    }
                }

                for (uint8 ii = _month + 1; ii >= 1; --ii) {
                    // Update monthly totals
                    NftTotalMonth memory _monthlyTotal = monthlyTotal[ii - 1];
                    if (_monthlyTotal.totalStaked > 0 || ii == 1) {
                        if (_isIncreasingStake) {
                            _totalToSet.totalStaked = _monthlyTotal.totalStaked + _amount;
                            if (ii < _month + 1) {
                                _totalToSet.minimumStaked = _monthlyTotal.totalStaked;
                            }
                        } else {
                            if (_monthlyTotal.totalStaked >= _amount) {
                                _totalToSet.totalStaked = _monthlyTotal.totalStaked - _amount;
                                uint128 _minimumToCheck = ii < _month + 1
                                    ? _monthlyTotal.totalStaked
                                    : _monthlyTotal.minimumStaked;
                                if (_totalToSet.totalStaked < _minimumToCheck) {
                                    _totalToSet.minimumStaked = _totalToSet.totalStaked;
                                } else {
                                    if (ii < _month + 1) {
                                        _totalToSet.minimumStaked = _monthlyTotal.totalStaked;
                                    } else {
                                        _totalToSet.minimumStaked = _monthlyTotal.minimumStaked;
                                    }
                                }
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

    function supportsInterface(bytes4 _interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(_interfaceId);
    }

    function getStakingAllowance(uint256 _tokenId, uint128 _staked) public view returns (uint128 stakingAllowance) {
        if (tokenDistribution.startTime() > block.timestamp) return 0;

        uint128 accumulatedAllowance = (((
            (((uint128(block.timestamp) - tokenDistribution.startTime()) / 1 days) * DAILY_STAKING_ALLOWANCE)
        ) + DAILY_STAKING_ALLOWANCE) * ONE_E18);
        if (accumulatedAllowance + nft[_tokenId].stakedAtMint > _staked) {
            stakingAllowance = accumulatedAllowance + nft[_tokenId].stakedAtMint - _staked;
        } else {
            return 0;
        }
    }

    function getLevel(uint256 _tokenId) public view returns (uint16) {
        require(super._exists(_tokenId), "GenesisNft: This token does not exists");
        return nftData.getLevelCapped(getStaked(_tokenId), nft[_tokenId].tier);
    }

    function getCurrentMonth() public view returns (uint8) {
        uint256 startTime = tokenDistribution.startTime();
        if (block.timestamp < startTime) {
            return 0;
        } else {
            return uint8((block.timestamp - startTime) / 30 days);
        }
    }

    function calculateTokenIdShares(uint256 _tokenId) public view returns (uint16) {
        return _calculateShares(nftData.getLevelCapped(getStaked(_tokenId), nft[_tokenId].tier)) + BASE_STAKE;
    }

    function getStaked(uint256 _tokenId) public view returns (uint128 stakedAmount) {
        NftInfo storage _nft = nft[_tokenId];
        for (uint8 i = getCurrentMonth() + 1; i >= 1; --i) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1) {
                return _nftMonth.staked;
            }
        }
        return 0;
    }

    function getShares(uint256 _tokenId) public view returns (uint16) {
        NftInfo storage _nft = nft[_tokenId];
        for (uint8 i = getCurrentMonth() + 1; i >= 1; i--) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.shares > 0 || _nftMonth.hasWithdrawn == 1) {
                return _nftMonth.shares;
            }
        }
        return 0;
    }

    /****
     **** EXTERNAL VIEW
     ****/

    function getNftInfo(
        uint256 _tokenId
    )
        external
        view
        returns (
            uint128 _staked,
            uint128 _stakingAllowance,
            uint16 _shares,
            uint16 _level,
            uint16 _tier,
            uint64 _lockPeriod
        )
    {
        NftInfo storage _nft = nft[_tokenId];
        for (uint256 i = getCurrentMonth() + 1; i >= 1; --i) {
            NftInfoMonth storage _nftMonth = _nft.monthly[uint8(i - 1)];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1) {
                _staked = _nftMonth.staked;
                _shares = _nftMonth.shares;
                break;
            }
        }
        _stakingAllowance = getStakingAllowance(_tokenId, _staked);
        _level = getLevel(_tokenId);
        _tier = _nft.tier;
        _lockPeriod = _nft.lockPeriod;
        return (_staked, _stakingAllowance, _shares, _level, _tier, _lockPeriod);
    }

    function getNftInfoAtMonth(
        uint256 _tokenId,
        uint8 _month
    ) external view returns (uint256 shares, uint256 staked, uint256 minimumStaked) {
        NftInfo storage _nft = nft[_tokenId];
        NftInfoMonth storage _nftMonth = _nft.monthly[_month];
        shares = _nftMonth.shares;
        staked = _nftMonth.staked;
        minimumStaked = _nftMonth.minimumStaked;
    }

    function getTier(uint256 _tokenId) external view returns (uint16) {
        require(super._exists(_tokenId), "GenesisNft: This token does not exists");
        return nft[_tokenId].tier;
    }

    function getIdsFromWallet(address _nftOwner) external view returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](balanceOf(_nftOwner));
        uint256 counter = 0;
        for (uint256 i = 1; i <= nftIdCounter; i++) {
            if (super._exists(i) && ownerOf(i) == _nftOwner) {
                tokenIds[counter] = i;
                counter++;
            }
        }
        return tokenIds;
    }

    function getTokenIdToHasWithdrawnAtMonth(
        uint256 _tokenId,
        uint8 _month
    ) external view returns (uint8 hasWithdrawn) {
        return nft[_tokenId].monthly[_month].hasWithdrawn;
    }

    function getTotals(
        uint8 _month
    ) external view returns (uint128 _totalShares, uint128 _totalBalance, uint128 _minimumBalance) {
        _totalShares = monthlyTotal[_month].totalShares;
        _totalBalance = monthlyTotal[_month].totalStaked;
        _minimumBalance = monthlyTotal[_month].minimumStaked;
        if (_month > 0 && _totalBalance == 0) {
            for (uint8 i = _month + 1; i >= 1; i--) {
                NftTotalMonth storage _monthlyTotal = monthlyTotal[i - 1];
                if (_monthlyTotal.totalStaked > 0 || _monthlyTotal.totalShares > 0 || i <= 1) {
                    _totalShares = _monthlyTotal.totalShares;
                    _totalBalance = _monthlyTotal.totalStaked;
                    _minimumBalance = _monthlyTotal.minimumStaked;
                    break;
                }
            }
        }
    }

    /****
     **** private VIEW
     ****/

    function _getTotalShares(uint8 _month) private view returns (uint32 sharesTotal) {
        sharesTotal = monthlyTotal[_month].totalShares;
        if (_month > 0 && sharesTotal == 0) {
            uint8 i = _month - 1;
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

    function _calculateShares(uint16 _nftLevel) private pure returns (uint16) {
        if (_nftLevel == 80) return 320;
        uint24 totalLevelCost = 525;
        uint16 currentLevelIteration = 1;
        for (currentLevelIteration = 1; currentLevelIteration <= _nftLevel; currentLevelIteration++) {
            totalLevelCost += ((3 + (currentLevelIteration / 10)) * ((70 + currentLevelIteration) * 25)) / 10;
        }
        return uint16(((totalLevelCost + (currentLevelIteration - 1) * 12) + 250) / 500);
    }

    function _hashMint(
        uint16 _voucherId,
        uint16 _type,
        uint64 _lockPeriod,
        address _account,
        uint256 _amountToStake,
        string calldata _imageUri,
        bytes32 _encodedAttributes
    ) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFT(uint16 voucherId,uint16 type,uint64 lockPeriod,address account,uint256 amountToStake,string imageUri,bytes32 encodedAttributes)"
                        ),
                        _voucherId,
                        _type,
                        _lockPeriod,
                        _account,
                        _amountToStake,
                        keccak256(abi.encodePacked(_imageUri)),
                        _encodedAttributes
                    )
                )
            );
    }

    function _verify(bytes32 _digest, bytes memory _signature, bytes32 _role) private view returns (bool) {
        return hasRole(_role, ECDSA.recover(_digest, _signature));
    }

    /**
     * @notice This function gets the tokenURI for this nft.
     * @dev The tokenURI is dynamically generated, it will be based on the type and level and many other variables and is then formatted.
     * @param _tokenId The id of the nft.
     * @return _tokenUri a string which is the tokenURI of an nft.
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory _tokenUri) {
        require(_exists(_tokenId), "GenesisNft: URI query for nonexistent token");
        uint128 staked = getStaked(_tokenId);
        uint16 shares = getShares(_tokenId);
        uint16 level = nftData.getLevelCapped(staked, nft[_tokenId].tier);
        NftInfo storage _nft = nft[_tokenId];

        return
            nftData.tokenUriTraits(
                level,
                _nft.tier,
                staked,
                shares,
                string(abi.encodePacked(_nft.encodedAttributes)),
                _nft.lockPeriod + tokenDistribution.startTime(),
                _nft.imageUri
            );
    }
}
