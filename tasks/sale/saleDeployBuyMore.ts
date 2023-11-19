import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { STABLECOIN_ADDRESSES, STABLECOIN_NAMES, FUNDS_ADDRESSES } from "../constants/sale.constants";

// example: yarn hardhat sale:deploy:buymore --network sepolia

task("sale:deploy:buymore").setAction(async function (_, hre) {
  const stablecoinNames = <string[]>STABLECOIN_NAMES[hre.network.name as keyof typeof STABLECOIN_NAMES];
  const stablecoinAddresses = <string[]>STABLECOIN_ADDRESSES[hre.network.name as keyof typeof STABLECOIN_ADDRESSES];
  const workXFundsAddress = <string>FUNDS_ADDRESSES[hre.network.name as keyof typeof FUNDS_ADDRESSES];

  const privateSale = await (
    await hre.ethers.getContractFactory("BuyMore")
  ).deploy(workXFundsAddress, stablecoinNames, stablecoinAddresses);
  await privateSale.deployed();

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ BuyMore deployed to:", privateSale.address);
  console.log("║ On network:", hre.network.name);
  console.log("╚══════════════════════════════════════════════════════════════════════");
  console.log("");

  // await hre.run("verify:verify", {
  //   contract: "contracts/wrkx/BuyMore.sol:BuyMore",
  //   address: privateSale.address,
  //   constructorArguments: [
  //     workXFundsAddress,
  //     stablecoinNames,
  //     stablecoinAddresses,
  //   ],
  // });

  // console.log("");
  // console.log("╔══════════════════════════════════════════════════════════════════════");
  // console.log("║ BuyMore contract has been verified.");
  // console.log("╚══════════════════════════════════════════════════════════════════════");
  // console.log("");
});
