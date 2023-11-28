// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";
import "./GenesisNftAttributes.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract GenesisNftData {
    GenesisNftAttributes public immutable attributes;

    uint256 constant ONE_E18 = 10 ** 18;

    uint24[80] private levels = [
        525,
        1056,
        1596,
        2142,
        2697,
        3258,
        3828,
        4404,
        4989,
        5580,
        6380,
        7188,
        8008,
        8836,
        9676,
        10524,
        11384,
        12252,
        13132,
        14020,
        15145,
        16280,
        17430,
        18590,
        19765,
        20950,
        22150,
        23360,
        24585,
        25820,
        27320,
        28832,
        30362,
        31904,
        33464,
        35036,
        36626,
        38228,
        39848,
        41480,
        43405,
        45344,
        47304,
        49278,
        51273,
        53282,
        55312,
        57356,
        59421,
        61500,
        63900,
        66316,
        68756,
        71212,
        73692,
        76188,
        78708,
        81244,
        83804,
        86380,
        89305,
        92248,
        95218,
        98206,
        101221,
        104254,
        107314,
        110392,
        113497,
        116620,
        120120,
        123640,
        127190,
        130760,
        134360,
        137980,
        141630,
        145300,
        149000,
        152720
    ];

    constructor(address _attributesAddress) {
        require(_attributesAddress != address(0), "GenesisNftData: Invalid attributes address");
        attributes = GenesisNftAttributes(_attributesAddress);
    }

    /**
     * @notice Checks with a digest and a signature if the account that signed the digest matches the voucherSigner.
     * @param _digest The digest that is checked, this is the hash of messages that included the the typed data.
     * @param _signature The signature that is checked, this is the signature of the person that signed the digest.
     * @return a bool that is true if the account that signed the digest matches the voucherSigner.
     **/
    function verify(bytes32 _digest, bytes memory _signature, address _voucherSigner) external pure returns (bool) {
        return ECDSA.recover(_digest, _signature) == _voucherSigner;
    }

    /**
     * @notice Returns the level of the NFT based on the amount of tokens staked.
     * @dev Splits 80 into 4 seconds of 20, then splits 20 into 4 sections of 5, then loops over the remaining 5 to find the correct level from the XP array.
     * @param _staked The amount of tokens staked.
     * @return The level of the NFT.
     **/
    function getLevel(uint256 _staked) public view returns (uint256) {
        for (uint256 s1 = 1; s1 <= 4; s1++) {
            if (_staked < uint256(levels[s1 * 20 - 1]) * ONE_E18) {
                for (uint256 s2 = 1; s2 <= 4; s2++) {
                    if (_staked <= uint256(levels[(s1 - 1) * 20 + (s2) * 5 - 1]) * ONE_E18) {
                        uint256 ls = (s1 - 1) * 20 + (s2 - 1) * 5;
                        for (uint256 level = ls; level <= ls + 4; level++) {
                            if (_staked < uint256(levels[level]) * ONE_E18) {
                                return level;
                            }
                        }
                    }
                }
            }
        }
        return 80;
    }

    /**
     * @notice Returns the level of the NFT based on the amount of tokens staked capped by the tier.
     * @dev Gets the level using getLevel, but then caps it based on the tier as the level does not increase if the tier is not evolved.
     * @param _staked The amount of tokens staked.
     * @param _tier The tier of the NFT.
     * @return The level of the NFT.
     **/
    function getLevelCapped(uint256 _staked, uint256 _tier) external view returns (uint256) {
        uint256 level = getLevel(_staked);
        if ((_tier + 1) * 10 < level) {
            return (_tier + 1) * 10;
        }
        return level;
    }

    /**
     * @notice Calculate the shares of an NFT based on the level.
     * @dev The multiplier is rounded that is included in the calculation by adding a value and then later dividing, this is to avoid rounding errors.
     * @param _nftLevel The level of the NFT.
     * @return The shares of the NFT.
     **/
    function calculateShares(uint256 _nftLevel) external pure returns (uint256) {
        if (_nftLevel == 80) return 320;
        uint256 totalLevelCost = 525;
        uint256 currentLevelIteration = 1;
        for (currentLevelIteration = 1; currentLevelIteration <= _nftLevel; currentLevelIteration++) {
            totalLevelCost += (3 + uint256((currentLevelIteration) / 10)) * (175 + ((currentLevelIteration * 25) / 10));
        }
        return ((totalLevelCost + (currentLevelIteration - 1) * 12) + 250) / 500;
    }

    /**
     * @notice Returns the amount of tokens required to reach a specific level.
     * @dev Gets the tokens from the level array and multiplies it by 1e18.
     * @param _level The level to get the tokens required for.
     * @return The amount of tokens required to reach the level.
     **/
    function getTokensRequiredForLevel(uint256 _level) external view returns (uint256) {
        require(_level <= levels.length, "Level must be less than or equal to max level");
        return levels[_level - 1] * ONE_E18;
    }

    /**
     * @notice Returns the amount of tokens required to reach a specific tier.
     * @dev Gets the tokens from the level array and multiplies it by 1e18.
     * @param _tier The tier to get the tokens required for.
     * @return The amount of tokens required to reach the tier.
     **/
    function getTokensRequiredForTier(uint256 _tier) external view returns (uint256) {
        if (_tier == 0) {
            return 0;
        }
        if (_tier * 10 <= levels.length) {
            return levels[(_tier * 10) - 1] * ONE_E18;
        } else {
            return levels[levels.length - 1] * ONE_E18;
        }
    }

    /**
     * @notice splits a bytes into an array of uint8's.
     * @param _b The bytes to split.
     * @return _res The array of uint8s's.
     **/
    function splitBytes(bytes memory _b) public pure returns (uint8[11] memory _res) {
        for (uint256 i = 0; i < 11; i++) {
            uint8 tmp = uint8(uint256(uint8(_b[i * 2])) * 10 + uint256(uint8(_b[i * 2 + 1])));
            if (tmp > 15) _res[i] = tmp - 16;
        }
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    /**
     * @notice Decodes the attributes from the encoded attributes bytes32.
     * @param _encodedAttributes The encoded attributes bytes.
     * @return _attributes The array of attributes.
     **/
    function decodeAttributes(bytes32 _encodedAttributes) public view returns (string[11] memory _attributes) {
        uint8[11] memory i = this.splitBytes(abi.encode(_encodedAttributes));
        _attributes[0] = bytes32ToString(attributes.gender(i[0]));
        _attributes[1] = bytes32ToString(attributes.body(i[1]));
        _attributes[2] = bytes32ToString(attributes.profession(i[2]));
        _attributes[3] = bytes32ToString(attributes.accessories(i[3]));
        _attributes[4] = bytes32ToString(attributes.background(i[4]));
        _attributes[5] = bytes32ToString(attributes.eyes(i[5]));
        _attributes[6] = bytes32ToString(attributes.hair(i[6]));
        _attributes[7] = bytes32ToString(attributes.mouth(i[7]));
        _attributes[8] = bytes32ToString(attributes.complexion(i[8]));
        _attributes[9] = bytes32ToString(attributes.item(i[9]));
        _attributes[10] = bytes32ToString(attributes.clothes(i[10]));
    }

    /**
     * @notice Returns the token URI for the Genesis NFT.
     * @dev Returns the token URI for the Genesis NFT.
     * @param _level The level of the NFT.
     * @param _tier The tier of the NFT.
     * @param _staked The amount of tokens staked.
     * @param _shares The amount of shares.
     * @param _encodedAttributes The encoded attributes string.
     * @param _unlockTime The unlock time of the NFT.
     * @param _imageUri The image URI of the NFT.
     * @return The token URI for the Genesis NFT.
     **/
    function tokenUriTraits(
        uint256 _tokenId,
        uint256 _level,
        uint256 _tier,
        uint256 _staked,
        uint256 _shares,
        bytes32 _encodedAttributes,
        uint256 _unlockTime,
        uint256 _startTime,
        string calldata _imageUri
    ) public view returns (string memory) {
        string[11] memory attr = decodeAttributes(_encodedAttributes);
        string memory id = Strings.toString(_tokenId);

        //TODO: use this as image, if before reveal (_startTime)  https://content.workx.io/video/Work-X-Lockup.mp4
        string memory part1 = string(
            abi.encodePacked(
                '{"name":"Work X Genesis NFT", "description":"This Work X Genesis NFT was obtained by being an early Work X adopter.", "image":"',
                string.concat(_imageUri, id),
                '.png","attributes": [{"trait_type":"Level","value":',
                Strings.toString(_level),
                '},{"trait_type":"Tier","value":',
                Strings.toString(_tier),
                '},{"trait_type":"$WORK Staked","value":',
                Strings.toString(_staked / ONE_E18),
                '},{"trait_type":"Gender","value":"',
                attr[0],
                '"},{"trait_type":"Body","value":"',
                attr[1]
            )
        );

        string memory part2 = string(
            abi.encodePacked(
                '"},{"trait_type":"Profession","value":"',
                attr[2],
                '"},{"trait_type":"Accessories","value":"',
                attr[3],
                '"},{"trait_type":"Background","value":"',
                attr[4],
                '"},{"trait_type":"Eyes","value":"',
                attr[5],
                '"},{"trait_type":"Hair","value":"',
                attr[6],
                '"},{"trait_type":"Mouth","value":"',
                attr[7]
            )
        );

        string memory part3 = string(
            abi.encodePacked(
                '"},{"trait_type":"Complexion","value":"',
                attr[8],
                '"},{"trait_type":"Item","value":"',
                attr[9],
                '"},{"trait_type":"Clothes","value":"',
                attr[10],
                '"},{"display_type": "boost_number", "trait_type": "Shares","value":',
                Strings.toString(_shares),
                '},{"display_type": "date", "trait_type": "Tokens Unlock","value":',
                Strings.toString(_unlockTime),
                "}]}"
            )
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(bytes(abi.encodePacked(part1, part2, part3)))
                )
            );
    }
}
