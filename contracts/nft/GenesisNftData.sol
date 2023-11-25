// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

import "hardhat/console.sol";

contract GenesisNftData {
    struct Options {
        uint8[10] opt;
    }
    uint256 constant ONE_E18 = 10 ** 18;

    bytes32[2] public gender = [bytes32("Male"), bytes32("Female")];
    bytes32[7] public body = [
        bytes32("Brown"),
        bytes32("Yellow"),
        bytes32("White"),
        bytes32("Tan"),
        bytes32("Caramel"),
        bytes32("Red"),
        bytes32("Black")
    ];
    bytes32[10] public profession = [
        bytes32("Founder"),
        bytes32("Sales"),
        bytes32("Web3 Hacker"),
        bytes32("Graphics Designer"),
        bytes32("Tester"),
        bytes32("Community Moderator"),
        bytes32("Investor"),
        bytes32("Marketeer"),
        bytes32("Influencer"),
        bytes32("Security Researcher")
    ];
    bytes32[21] public accessories = [
        bytes32("None"),
        bytes32("Airpods Pro"),
        bytes32("Airpods"),
        bytes32("Earbud"),
        bytes32("Earring Blue"),
        bytes32("Earring Gold"),
        bytes32("Earring Green"),
        bytes32("Earring Pink"),
        bytes32("Earring Red"),
        bytes32("Earring Silver-Blue"),
        bytes32("Earring Silver-Pink"),
        bytes32("Earring Silver"),
        bytes32("Glasses Black"),
        bytes32("Glasses Blue"),
        bytes32("Glasses Bordeaux"),
        bytes32("Glasses Gold"),
        bytes32("Glasses Pink"),
        bytes32("Google Glass"),
        bytes32("Mardi Mask"),
        bytes32("Sennheiser"),
        bytes32("Vision Pro")
    ];
    bytes32[52] public background = [
        bytes32("3D Printer"),
        bytes32("Airplane Business Class"),
        bytes32("Atelier"),
        bytes32("Beach"),
        bytes32("Blockchain Schematics"),
        bytes32("Cabin In The Woods"),
        bytes32("Co-working Space"),
        bytes32("Coffeeshop"),
        bytes32("Community Meetup"),
        bytes32("Conference Booth"),
        bytes32("Flip-over Board with Diagrams"),
        bytes32("Garden Office"),
        bytes32("Grand Conference"),
        bytes32("Hackathon"),
        bytes32("Hacker Desk"),
        bytes32("Home Office"),
        bytes32("Hotel Conference Room"),
        bytes32("Hotel Lobby"),
        bytes32("Library"),
        bytes32("Linear Behongo"),
        bytes32("Linear Crazy Orange"),
        bytes32("Linear Earthly"),
        bytes32("Linear Endless River"),
        bytes32("Linear Hersheys"),
        bytes32("Linear Metalic Toad"),
        bytes32("Linear Predawn"),
        bytes32("Linear Purple Bliss"),
        bytes32("Linear Red Mist"),
        bytes32("Linear Shore"),
        bytes32("Meeting Room"),
        bytes32("Mobile Office"),
        bytes32("Modern Office Space"),
        bytes32("Monitoring Room"),
        bytes32("Office Desk"),
        bytes32("Open Office Space"),
        bytes32("Park"),
        bytes32("Radial Aqua"),
        bytes32("Radial Blue"),
        bytes32("Radial Gold"),
        bytes32("Radial Green"),
        bytes32("Radial Grey"),
        bytes32("Radial Mint"),
        bytes32("Radial Pink"),
        bytes32("Radial Purple"),
        bytes32("Radial Red"),
        bytes32("Radial Yellow"),
        bytes32("Rooftop Terrace"),
        bytes32("Sales Presentation"),
        bytes32("Sunny Desk"),
        bytes32("Trading Desk"),
        bytes32("University Campus"),
        bytes32("Yacht")
    ];
    bytes32[19] public eyes = [
        bytes32("Amber Blue"),
        bytes32("Amber Grey"),
        bytes32("Amber"),
        bytes32("Blue"),
        bytes32("Bright Green"),
        bytes32("Brown"),
        bytes32("Dark Green"),
        bytes32("Deep Blue"),
        bytes32("Deep Brown"),
        bytes32("Deep Green"),
        bytes32("Gold"),
        bytes32("Green-Brown"),
        bytes32("Green-Blue"),
        bytes32("Green"),
        bytes32("Grey"),
        bytes32("Hazel"),
        bytes32("Sea Blue"),
        bytes32("Starlake"),
        bytes32("Steel-Blue")
    ];
    bytes32[34] public hair = [
        bytes32("Black Hat"),
        bytes32("Black"),
        bytes32("Blonde Light"),
        bytes32("Blonde Long"),
        bytes32("Blonde Short"),
        bytes32("Blonde"),
        bytes32("Brown"),
        bytes32("Cap Green"),
        bytes32("Cap Grey"),
        bytes32("Cap Hodl"),
        bytes32("Cap Hype"),
        bytes32("Cap KOL Green"),
        bytes32("Cap KOL Pink"),
        bytes32("Cap Orange"),
        bytes32("Cap Pink"),
        bytes32("Cap Red"),
        bytes32("Cap Swag"),
        bytes32("Cap Work X"),
        bytes32("Dark Brown"),
        bytes32("Grey"),
        bytes32("Headphones"),
        bytes32("Light Brown"),
        bytes32("Light Orange"),
        bytes32("Orange"),
        bytes32("Pencil"),
        bytes32("Purple"),
        bytes32("Red Hat"),
        bytes32("Red Long"),
        bytes32("Red"),
        bytes32("White Hat"),
        bytes32("Anonymous"),
        bytes32("Fire"),
        bytes32("White"),
        bytes32("VR Glasses")
    ];
    bytes32[7] public mouth = [
        bytes32("Full"),
        bytes32("Neutral"),
        bytes32("Slight Smile"),
        bytes32("Smile"),
        bytes32("Thin Smile"),
        bytes32("Thin"),
        bytes32("Wide Smile")
    ];
    bytes32[8] public complexion = [
        bytes32("Blush Ligh"),
        bytes32("Blush Strong"),
        bytes32("Clear"),
        bytes32("Freckles Light"),
        bytes32("Freckles Strong"),
        bytes32("Beauty Spot Cheek"),
        bytes32("Beauty Spot Eye"),
        bytes32("Beauty Spot Lip")
    ];
    bytes32[8] public item = [bytes32("Business Suit")];
    bytes32[8] public clothes = [bytes32("A/B Testing")];
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
    function getLevelCapped(uint256 _staked, uint256 _tier) public view returns (uint256) {
        uint256 level = getLevel(_staked);
        if ((_tier + 1) * 10 < level) {
            return (_tier + 1) * 10;
        }
        return level;
    }

    /**
     * @notice Returns the amount of tokens required to reach a specific level.
     * @dev Gets the tokens from the level array and multiplies it by 1e18.
     * @param _level The level to get the tokens required for.
     * @return The amount of tokens required to reach the level.
     **/
    function getTokensRequiredForLevel(uint256 _level) public view returns (uint256) {
        require(_level <= levels.length, "Level must be less than or equal to max level");
        return levels[_level - 1] * ONE_E18;
    }

    /**
     * @notice Returns the amount of tokens required to reach a specific tier.
     * @dev Gets the tokens from the level array and multiplies it by 1e18.
     * @param _tier The tier to get the tokens required for.
     * @return The amount of tokens required to reach the tier.
     **/
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

    /**
     * @notice Decodes the attributes from the encoded attributes bytes32.
     * @param _encodedAttributes The encoded attributes bytes.
     * @return _attributes The array of attributes.
     **/
    function decodeAttributes(bytes32 _encodedAttributes) public view returns (bytes32[11] memory _attributes) {
        uint8[11] memory i = this.splitBytes(abi.encode(_encodedAttributes));
        _attributes[0] = gender[i[0]];
        _attributes[1] = body[i[1]];
        _attributes[2] = profession[i[2]];
        _attributes[3] = accessories[i[3]];
        _attributes[4] = background[i[4]];
        _attributes[5] = eyes[i[5]];
        _attributes[6] = hair[i[6]];
        _attributes[7] = mouth[i[7]];
        _attributes[8] = complexion[i[8]];
        _attributes[9] = item[i[9]];
        _attributes[10] = clothes[i[9]];
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
        string calldata _imageUri
    ) public view returns (string memory) {
        bytes32[11] memory attributes = decodeAttributes(_encodedAttributes);
        string memory id = Strings.toString(_tokenId);

        string memory combinedStr2 = string(
            abi.encodePacked('"attributes":', '[{"trait_type": "Level",', '"value":', Strings.toString(_level))
        );

        string memory combinedStr3 = string(
            abi.encodePacked(
                '},{"trait_type": "Tier",',
                '"value":',
                Strings.toString(_tier),
                '},{"trait_type": "$WORK Staked",',
                '"value":',
                Strings.toString(_staked / ONE_E18)
            )
        );

        string memory combinedStr4 = string(
            abi.encodePacked(
                '},{"trait_type": "Gender",',
                '"value":"',
                attributes[0],
                '"},{"trait_type": "Body",',
                '"value":"',
                attributes[1],
                '"},{"trait_type": "Profession",',
                '"value":"',
                attributes[2],
                '"},'
            )
        );

        string memory combinedStr5 = string(
            abi.encodePacked(
                '{"display_type": "boost_number", "trait_type": "Shares",',
                '"value":',
                Strings.toString(_shares),
                '},{"display_type": "date", "trait_type": "Tokens Unlock",',
                '"value":',
                Strings.toString(_unlockTime),
                "}]",
                "}"
            )
        );

        string memory info = string(
            abi.encodePacked(
                '{"name":"Work X Genesis NFT", "description":"This Work X Genesis NFT was earned by being an early Work X adopter.", "image":"',
                string.concat(_imageUri, id),
                '", '
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
