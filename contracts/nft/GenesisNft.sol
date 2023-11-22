// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "base64-sol/base64.sol";

import "./GenesisNftData.sol";
import "./../sale/TokenDistribution.sol";

import "hardhat/console.sol";

contract GenesisNft is ERC721, Ownable, ReentrancyGuard, AccessControl, EIP712 {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    GenesisNftData public immutable nftData;
    TokenDistribution public immutable tokenDistribution;
    WorkToken public immutable token;

    uint128 constant ONE_E18 = 10 ** 18;
    uint8 constant TYPE_GUARANTEED = 0;
    uint8 constant TYPE_FCFS = 1;
    uint8 constant TYPE_INVESTOR = 2;
    uint8 constant BASE_STAKE = 50;
    uint16 constant DAILY_STAKING_ALLOWANCE = 294;
    uint16 constant COUNT_GUARANTEED = 350;
    uint16 constant COUNT_FCFS = 150;
    uint16 constant COUNT_INVESTOR = 499;
    uint16 public nftIdCounter;

    mapping(address => uint16) public accountMinted;

    mapping(uint8 => NftTotalMonth) public monthlyTotal;
    struct NftTotalMonth {
        uint8 hasWithdrawn;
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
     **** EXTERNAL WRITE
     ****/

    function mintNft(
        address _account,
        uint16 _voucherId,
        uint16 _type,
        uint64 _lockPeriod,
        uint128 _amountToStake,
        uint128 _amountToNotVest,
        string calldata _imageUri,
        bytes32 _encodedAttributes,
        bytes calldata _signature
    ) external nonReentrant {
        require(accountMinted[_account] == 0, "GenesisNft: This account already minted an NFT");
        //TODO: write a test for this
        bytes32 digest = _hashMint(
            _account,
            _voucherId,
            _type,
            _amountToStake,
            _amountToNotVest,
            _lockPeriod,
            _imageUri,
            _encodedAttributes
        );
        require(_verify(digest, _signature, SIGNER_ROLE), "GenesisNft: Invalid signature");
        //TODO: write a test for this
        if (_type == TYPE_GUARANTEED) {
            require(nftIdCounter < COUNT_GUARANTEED - 1, "GenesisNft: No more guaranteed spots.");
        } else if (_type == TYPE_FCFS) {
            require(
                nftIdCounter < COUNT_GUARANTEED + COUNT_FCFS - 1,
                "GenesisNft: No more first-come first-serve spots."
            );
        } else if (_type == TYPE_INVESTOR) {
            require(
                nftIdCounter < COUNT_GUARANTEED + COUNT_FCFS + COUNT_INVESTOR - 1,
                "GenesisNft: No more early contributor spots."
            );
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

    function destroyNft(uint256 _tokenId) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        require(address(this) == getApproved(_tokenId), "GenesisNft: This contract is not allowed to burn this NFT");
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

    function stake(uint256 _tokenId, uint128 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        uint256 allowance = getStakingAllowance(_tokenId);
        require(_amount <= allowance, "GenesisNft: The amount you want to stake is more than the total allowance");
        _stake(_tokenId, _amount);
    }

    function stakeAndEvolve(uint256 _tokenId, uint128 _amount) external nonReentrant {
        require(msg.sender == ownerOf(_tokenId), "GenesisNft: You are not the owner of this NFT!");
        uint256 allowance = getStakingAllowance(_tokenId);
        require(_amount <= allowance, "GenesisNft: The amount you want to stake is more than the total allowance");
        _stake(_tokenId, _amount);
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
        // _updateShares(_tokenId, false);
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
     **** INTERNAL WRITE
     ****/

    function _updateShares(uint256 _tokenId, bool _isIncreasingShares) internal {
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

    function _setInitial(uint256 _tokenId, uint128 _amountToStake) internal {
        uint16 tier = nftData.getLevel(getStaked(_tokenId)) / 10;
        NftInfo storage _nft = nft[_tokenId];
        _nft.tier = tier;
        NftInfoMonth storage _nftMonth = _nft.monthly[0];
        _nftMonth.shares = calculateTokenIdShares(_tokenId);

        uint8 _currentMonth = getCurrentMonth();

        for (uint8 i = 0; i <= _currentMonth; i++) {
            NftTotalMonth storage totalMonthly = monthlyTotal[i];
            totalMonthly.minimumStaked += _amountToStake;
            totalMonthly.totalStaked += _amountToStake;
            if (totalMonthly.totalShares > 0 || i == 0) {
                totalMonthly.totalShares += _nftMonth.shares;
            }
        }

        emit Evolve(_tokenId, tier);
    }

    function _evolveTier(uint256 _tokenId) internal {
        uint16 tier = nftData.getLevel(getStaked(_tokenId)) / 10;
        NftInfo storage _nft = nft[_tokenId];
        _nft.tier = tier;
        _updateShares(_tokenId, true);
        emit Evolve(_tokenId, tier);
    }

    function _stake(uint256 _tokenId, uint128 _amount) internal {
        _updateMonthly(_tokenId, true, _amount, getCurrentMonth());
        _updateShares(_tokenId, true);
        token.transferFrom(msg.sender, address(this), _amount);
        emit Stake(_tokenId, _amount);
    }

    function _refundTokens(uint256 _amount) internal {
        uint256 amount = token.balanceOf(address(this));
        require(amount >= _amount, "GenesisNft: Not enough $WORK tokens in the contract");
        token.transfer(msg.sender, _amount);
    }

    function _updateMonthly(uint256 _tokenId, bool _isIncreasingStake, uint128 _amount, uint8 _month) internal {
        NftInfo storage _nft = nft[_tokenId];
        NftInfoMonth storage _nftMonthToSet = _nft.monthly[_month];
        NftTotalMonth storage _totalToSet = monthlyTotal[_month];
        for (uint8 i = _month + 1; i >= 1; --i) {
            NftInfoMonth memory _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1 || i == 1) {
                uint128 stakedDelta;
                if (_isIncreasingStake) {
                    if (i < _month + 1) {
                        _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked;
                    } else {
                        _nftMonthToSet.minimumStaked = _nftMonth.staked;
                    }
                    _nftMonthToSet.staked = _nftMonth.staked + _amount;
                } else {
                    if (_nftMonth.staked >= _amount) {
                        _nftMonthToSet.staked = _nftMonth.staked - _amount;
                        stakedDelta = _nftMonth.staked - _nftMonth.minimumStaked;
                        if (stakedDelta < _amount) {
                            if (stakedDelta > 0) {
                                _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked - (_amount - stakedDelta);
                            } else {
                                _nftMonthToSet.minimumStaked = 0;
                            }
                        } else {
                            _nftMonthToSet.minimumStaked = _nftMonth.minimumStaked;
                        }
                        _nftMonthToSet.hasWithdrawn = 1;
                    } else {
                        revert("GenesisNft: You are trying to unstake more than the total staked in this nft!");
                    }
                }

                for (uint8 ii = _month + 1; ii >= 1; --ii) {
                    // Update monthly totals
                    NftTotalMonth memory _monthlyTotal = monthlyTotal[ii - 1];
                    if (_monthlyTotal.totalStaked > 0 || _monthlyTotal.hasWithdrawn == 1 || ii == 1) {
                        if (_isIncreasingStake) {
                            _totalToSet.totalStaked = _monthlyTotal.totalStaked + _amount;
                            _totalToSet.minimumStaked = _monthlyTotal.totalStaked;
                        } else {
                            if (_monthlyTotal.totalStaked >= _amount) {
                                _totalToSet.totalStaked = _monthlyTotal.totalStaked - _amount;
                                if (_monthlyTotal.minimumStaked >= stakedDelta) {
                                    _totalToSet.minimumStaked = _monthlyTotal.minimumStaked - stakedDelta;
                                } else {
                                    revert("GenesisNft: You are trying to unstake more than the total staked!");
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

    function getStakingAllowance(uint256 _tokenId) public view returns (uint128 stakingAllowance) {
        if (tokenDistribution.startTime() > block.timestamp) return 0;
        stakingAllowance =
            ((((((uint128(block.timestamp) - tokenDistribution.startTime()) / 1 days) * DAILY_STAKING_ALLOWANCE)) +
                DAILY_STAKING_ALLOWANCE) * ONE_E18) +
            nft[_tokenId].stakedAtMint -
            getStaked(_tokenId);
    }

    function getLevel(uint256 _tokenId) public view returns (uint16) {
        return nftData.getLevelCapped(getStaked(_tokenId), nft[_tokenId].tier);
    }

    function getTier(uint256 _tokenId) public view returns (uint16) {
        require(super._exists(_tokenId), "GenesisNft: This token does not exists");
        return nft[_tokenId].tier;
    }

    function getCurrentMonth() public view returns (uint8) {
        uint256 startTime = tokenDistribution.startTime();
        if (block.timestamp < startTime) {
            return 0;
        } else {
            return uint8((block.timestamp - startTime) / 30 days);
        }
    }

    function getIdsFromWallet(address _nftOwner) public view returns (uint256[] memory) {
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
     **** EXTERNAL VIEW
     ****/

    function getNftInfo(
        uint256 _tokenId
    )
        external
        view
        returns (uint128 staked, uint128 stakingAllowance, uint16 shares, uint16 level, uint16 tier, uint64 lockPeriod)
    {
        NftInfo storage _nft = nft[_tokenId];
        for (uint8 i = getCurrentMonth() + 1; i >= 1; i--) {
            NftInfoMonth storage _nftMonth = _nft.monthly[i - 1];
            if (_nftMonth.staked > 0 || _nftMonth.hasWithdrawn == 1 || i == 1) {
                staked = _nftMonth.staked;
                shares = _nftMonth.shares;
            }
        }
        stakingAllowance = getStakingAllowance(_tokenId);
        level = getLevel(_tokenId);
        tier = _nft.tier;
        lockPeriod = _nft.lockPeriod;
    }

    function getNftInfoAtMonth(
        uint256 _tokenId,
        uint8 _month
    ) external view returns (uint256 shares, uint256 staked, uint256 minimumStaked) {
        shares = nft[_tokenId].monthly[_month].shares;
        staked = nft[_tokenId].monthly[_month].staked;
        minimumStaked = nft[_tokenId].monthly[_month].minimumStaked;
    }

    /****
     **** INTERNAL VIEW
     ****/

    function _getTotalShares(uint8 _month) internal view returns (uint32 sharesTotal) {
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

    function _calculateShares(uint16 _nftLevel) internal pure returns (uint16) {
        if (_nftLevel == 80) return 320;
        uint24 totalLevelCost = 525;
        uint16 currentLevelIteration = 1;
        for (currentLevelIteration = 1; currentLevelIteration <= _nftLevel; currentLevelIteration++) {
            totalLevelCost += ((3 + (currentLevelIteration / 10)) * ((70 + currentLevelIteration) * 25)) / 10;
        }
        return uint16(((totalLevelCost + (currentLevelIteration - 1) * 12) + 250) / 500);
    }

    function _hashMint(
        address _account,
        uint16 _voucherId,
        uint16 _type,
        uint256 _amountToStake,
        uint256 _amountToNotVest,
        uint64 _lockPeriod,
        string calldata _imageUri,
        bytes32 _encodedAttributes
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFT(uint16 voucherId,uint16 type,uint64 lockPeriod,address account,uint256 amountToStake,uint256 amountToNotVest,string imageUri,bytes32 encodedAttributes)"
                        ),
                        _voucherId,
                        _type,
                        _lockPeriod,
                        _account,
                        _amountToStake,
                        _amountToNotVest,
                        keccak256(abi.encodePacked(_imageUri)),
                        _encodedAttributes
                    )
                )
            );
    }

    function _verify(bytes32 _digest, bytes memory _signature, bytes32 _role) internal view returns (bool) {
        return hasRole(_role, ECDSA.recover(_digest, _signature));
    }
}
