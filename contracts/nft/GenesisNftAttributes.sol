// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

contract GenesisNftAttributes {
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
        bytes32("Blush Light"),
        bytes32("Blush Strong"),
        bytes32("Clear"),
        bytes32("Freckles Light"),
        bytes32("Freckles Strong"),
        bytes32("Beauty Spot Cheek"),
        bytes32("Beauty Spot Eye"),
        bytes32("Beauty Spot Lip")
    ];

    bytes32[1] public item = [bytes32("A/B Testing")];

    bytes32[1] public clothes = [bytes32("Business Suit")];
}
