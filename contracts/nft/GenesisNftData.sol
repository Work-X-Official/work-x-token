// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

contract GenesisNftData {
    uint256 constant ONE_E18 = 10 ** 18;
    mapping(string => string) public genderOptions;
    mapping(string => string) public skinOptions;
    mapping(string => string) public professionOptions;
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

    constructor() {
        initGenderOptions();
        initSkinOptions();
        initProfessionOptions();
    }

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

    function getLevelCapped(uint256 _staked, uint256 _tier) public view returns (uint256) {
        uint256 level = getLevel(_staked);
        if ((_tier + 1) * 10 < level) {
            return (_tier + 1) * 10;
        }
        return level;
    }

    function getTokensRequiredForLevel(uint256 _level) public view returns (uint256) {
        require(_level <= levels.length, "Level must be less than or equal to max level");
        return levels[_level - 1] * ONE_E18;
    }

    function getTokensRequiredForTier(uint256 _tier) public view returns (uint256) {
        if (_tier == 0) {
            return 0;
        }
        if (_tier * 10 <= levels.length) {
            return levels[(_tier * 10) - 1] * ONE_E18;
        } else {
            return levels[levels.length - 1] * ONE_E18;
        }
    }

    function split(string memory _str) public pure returns (string[] memory) {
        bytes memory bStr = bytes(_str);
        uint256 len = bStr.length;
        require(len % 2 == 0);
        string[] memory res = new string[](len / 2);
        for (uint256 i = 0; i < len / 2; i++) {
            bytes memory b = new bytes(2);
            b[0] = bStr[i * 2];
            b[1] = bStr[i * 2 + 1];
            res[i] = string(b);
        }
        return res;
    }

    function decodeAttributes(
        string calldata _encodedAttributes
    ) public view returns (string[3] memory attributeArray) {
        string[] memory encodedAttributesArray = split(_encodedAttributes);
        attributeArray[0] = genderOptions[encodedAttributesArray[0]];
        attributeArray[1] = skinOptions[encodedAttributesArray[1]];
        attributeArray[2] = professionOptions[encodedAttributesArray[2]];
        return attributeArray;
    }

    function initGenderOptions() public {
        genderOptions["00"] = "Male";
        genderOptions["01"] = "Female";
    }

    function initSkinOptions() public {
        skinOptions["00"] = "Brown";
        skinOptions["01"] = "Yellow";
        skinOptions["02"] = "White";
        skinOptions["03"] = "Tan";
        skinOptions["04"] = "Caramel";
        skinOptions["05"] = "Red";
        skinOptions["06"] = "Black";
        skinOptions["07"] = "Caramel";
    }

    function initProfessionOptions() public {
        professionOptions["00"] = "Founder";
        professionOptions["01"] = "Sales";
        professionOptions["02"] = "Web3 Hacker";
        professionOptions["03"] = "Graphics Designer";
        professionOptions["04"] = "Tester";
        professionOptions["05"] = "Community Moderator";
        professionOptions["06"] = "Investor";
        professionOptions["07"] = "Marketeer";
        professionOptions["08"] = "Influencer";
        professionOptions["09"] = "Security Researcher";
        professionOptions["10"] = "Sales";
    }

    function tokenUriTraits(
        uint256 _level,
        uint256 _tier,
        uint256 _staked,
        uint256 _shares,
        string calldata _encodedAttributes,
        uint256 _unlockTime,
        string calldata _imageUri
    ) public view returns (string memory) {
        string[3] memory attributes = decodeAttributes(_encodedAttributes);

        string memory combinedStr2 = string(
            abi.encodePacked('", "attributes":', '[{"trait_type": "level",', '"value":', Strings.toString(_level))
        );

        string memory combinedStr3 = string(
            abi.encodePacked(
                '},{"trait_type": "tier",',
                '"value":',
                Strings.toString(_tier),
                '},{"trait_type": "work tokens staked",',
                '"value":',
                Strings.toString(_staked / ONE_E18)
            )
        );

        string memory combinedStr4 = string(
            abi.encodePacked(
                '},{"trait_type": "sex",',
                '"value":"',
                attributes[0],
                '"},{"trait_type": "skin",',
                '"value":"',
                attributes[1],
                '"},{"trait_type": "profession",',
                '"value":"',
                attributes[2],
                '"},'
            )
        );

        string memory combinedStr5 = string(
            abi.encodePacked(
                '{"display_type": "boost_number", "trait_type": "staking multiplier",',
                '"value":',
                Strings.toString(_shares),
                '},{"display_type": "date", "trait_type": "tokens locked until",',
                '"value":',
                Strings.toString(_unlockTime),
                "}]",
                "}"
            )
        );

        string memory info = string(
            abi.encodePacked(
                '{"name":"Work X Genesis NFT", "description":"This Work X Genesis NFT was earned by being an early Work X adopter.", "image":"',
                _imageUri
            )
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                info,
                                string(abi.encodePacked(combinedStr2, combinedStr3, combinedStr4, combinedStr5))
                            )
                        )
                    )
                )
            );
    }
}
