import "@nomiclabs/hardhat-waffle";
import { task } from "hardhat/config";
import { WORK_TOKEN_ADDRESSES } from "../constants/workToken.constants";

task("balance:kucoin", "Gets the final buyers").setAction(async ({ _ }, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );

  const kucoinAddresses = [
    "0x2B5634C42055806a59e9107ED44D43c426E58258",
    "0x689C56AEf474Df92D44A1B70850f808488F9769C",
    "0xa1D8d972560C2f8144AF871Db508F0B0B10a3fBf",
    "0x4ad64983349C49dEfE8d7A4686202d24b25D0CE8",
    "0x1692E170361cEFD1eb7240ec13D048Fd9aF6d667",
    "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c",
    "0xe59Cd29be3BE4461d79C0881D238Cbe87D64595A",
    "0x899B5d52671830f567BF43A14684Eb14e1f945fe",
    "0xf16E9B0D03470827A95CDfd0Cb8a8A3b46969B91",
    "0xcaD621da75a66c7A8f4FF86D30A2bF981Bfc8FdD",
    "0xeC30d02f10353f8EFC9601371f56e808751f396F",
    "0x738cF6903E6c4e699D1C2dd9AB8b67fcDb3121eA",
    "0xd89350284c7732163765b23338f2ff27449E0Bf5",
    "0x88Bd4D3e2997371BCEEFE8D9386c6B5B4dE60346",
    "0xb8e6D31e7B212b2b7250EE9c26C56cEBBFBe6B23",
    "0x41e29c02713929F800419AbE5770fAa8A5b4dADC",
    "0x45300136662dD4e58fc0DF61E6290DFfD992B785",
    "0x83C41363cBee0081dab75cB841FA24f3dB46627e",
    "0x7491f26A0FCb459111b3a1db2fbFC4035D096933",
    "0x58edF78281334335EfFa23101bBe3371b6a36A51",
    "0xf97DeB1C0BB4536ff16617D29E5F4B340fE231Df",
  ];

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ On '" + hre.network.name + "'");
  console.log("║ WorkToken contract:", workToken.address);
  for (let i = 0; i < kucoinAddresses.length; i++) {
    const balance = await workToken.balanceOf(kucoinAddresses[i]);
    console.log(`║ Kucoin #${i + 1} ${kucoinAddresses[i]} ${hre.ethers.utils.formatEther(balance).toString()}`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

task("balance:mexc", "Gets the final buyers").setAction(async ({ _ }, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );

  const mexcAddresses = [
    "0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB",
    "0x0211f3ceDbEf3143223D3ACF0e589747933e8527",
    "0x2e8F79aD740de90dC5F5A9F0D8D9661a60725e64",
  ];

  console.log("╔══════════════════════════════════════════════════════════════════════");
  console.log("║ On '" + hre.network.name + "'");
  console.log("║ WorkToken contract:", workToken.address);
  const totalBalance = 0;
  for (let i = 0; i < mexcAddresses.length; i++) {
    const b = await workToken.balanceOf(mexcAddresses[i]);
    const e = hre.ethers.utils.formatEther(b);
    const balance = Math.round(Number(e));
    console.log(`║ Mexc #${i + 1} ${mexcAddresses[i]} ${balance}`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════════");
});

task("balance", "Gets the final buyers").setAction(async ({ _ }, hre) => {
  const workToken = (await hre.ethers.getContractFactory("WorkToken")).attach(
    WORK_TOKEN_ADDRESSES[hre.network.name as keyof typeof WORK_TOKEN_ADDRESSES],
  );
  let totalBalance: number = 0;
  let subTotal = 0;
  const kucoinHotAddresses = [
    "0xcD5F3c15120a1021155174719Ec5FCf2c75aDf5b",
    "0x53f78A071d04224B8e254E243fFfc6D9f2f3Fa23",
  ];

  const kucoinAddresses = [
    "0x2B5634C42055806a59e9107ED44D43c426E58258",
    "0x689C56AEf474Df92D44A1B70850f808488F9769C",
    "0xa1D8d972560C2f8144AF871Db508F0B0B10a3fBf",
    "0x4ad64983349C49dEfE8d7A4686202d24b25D0CE8",
    "0x1692E170361cEFD1eb7240ec13D048Fd9aF6d667",
    "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c",
    "0xe59Cd29be3BE4461d79C0881D238Cbe87D64595A",
    "0x899B5d52671830f567BF43A14684Eb14e1f945fe",
    "0xf16E9B0D03470827A95CDfd0Cb8a8A3b46969B91",
    "0xcaD621da75a66c7A8f4FF86D30A2bF981Bfc8FdD",
    "0xeC30d02f10353f8EFC9601371f56e808751f396F",
    "0x738cF6903E6c4e699D1C2dd9AB8b67fcDb3121eA",
    "0xd89350284c7732163765b23338f2ff27449E0Bf5",
    "0x88Bd4D3e2997371BCEEFE8D9386c6B5B4dE60346",
    "0xb8e6D31e7B212b2b7250EE9c26C56cEBBFBe6B23",
    "0x41e29c02713929F800419AbE5770fAa8A5b4dADC",
    "0x45300136662dD4e58fc0DF61E6290DFfD992B785",
    "0x83C41363cBee0081dab75cB841FA24f3dB46627e",
    "0x7491f26A0FCb459111b3a1db2fbFC4035D096933",
    "0x58edF78281334335EfFa23101bBe3371b6a36A51",
    "0xf97DeB1C0BB4536ff16617D29E5F4B340fE231Df",
  ];

  const mexcAddresses = [
    "0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB",
    "0x0211f3ceDbEf3143223D3ACF0e589747933e8527",
    "0x2e8F79aD740de90dC5F5A9F0D8D9661a60725e64",
  ];

  const gateAddresses = ["0x0D0707963952f2fBA59dD06f2b425ace40b492Fe"];

  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  const totalSupply = Math.round(Number(hre.ethers.utils.formatEther(await workToken.totalSupply())));
  console.log(
    `║ ${fill16("$WORK on " + hre.network.name)} ║ ${workToken.address} ║ ${leftpad12(totalSupply.toString())} ║`,
  );
  console.log("╠══════════════════╦════════════════════════════════════════════╦══════════════╣");
  for (let i = 0; i < kucoinHotAddresses.length; i++) {
    const balance = Math.round(Number(hre.ethers.utils.formatEther(await workToken.balanceOf(kucoinHotAddresses[i]))));
    subTotal += balance;
    if (balance > 0)
      console.log(
        `║ ${fill16("Kucoin Hot #" + (i + 1))} ║ ${kucoinHotAddresses[i]} ║ ${leftpad12(balance.toString())} ║`,
      );
  }
  for (let i = 0; i < kucoinAddresses.length; i++) {
    const balance = Math.round(Number(hre.ethers.utils.formatEther(await workToken.balanceOf(kucoinAddresses[i]))));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Kucoin #" + (i + 1))} ║ ${kucoinAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Kucoin Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");
  totalBalance += subTotal;
  subTotal = 0;
  for (let i = 0; i < mexcAddresses.length; i++) {
    const b = await workToken.balanceOf(mexcAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Mexc #" + (i + 1))} ║ ${mexcAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Mexc Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");
  totalBalance += subTotal;
  subTotal = 0;
  for (let i = 0; i < gateAddresses.length; i++) {
    const b = await workToken.balanceOf(gateAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Gate.io #" + (i + 1))} ║ ${gateAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Gate Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );

  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");
  totalBalance += subTotal;
  subTotal = 0;
  const dwfAddresses = ["0xB439823C805f7A4866BE43dab445458a3ecB24a2"];
  for (let i = 0; i < dwfAddresses.length; i++) {
    const b = await workToken.balanceOf(dwfAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("DWF #" + (i + 1))} ║ ${dwfAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("DWF Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");
  totalBalance += subTotal;
  subTotal = 0;
  const liqAddresses = ["0xEec688f1388808055747F961Df120e57DA716354"];
  for (let i = 0; i < liqAddresses.length; i++) {
    const b = await workToken.balanceOf(liqAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Liquidity #" + (i + 1))} ║ ${liqAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Liquidity Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");

  totalBalance += subTotal;
  subTotal = 0;
  const contractAddresses = [
    "0x17A30350771d02409046A683b18Fe1C13cCFC4A8",
    "0xc4754dAc9c047E3772ddfFB8DC641Bf15689Cd2F",
    "0x1f013e2f73e7f6143A3d0484Ba25D52d24cc2665",
    "0x8Be47a54E10AD809b3014fb7DAb0A006E40427a6",
    "0x436CE2ce8d8d2Ccc062f6e92faF410DB4d397905",
    "0x82e17dE42B6e9429A3f354ffC1eF92b5DEeC375F",
    "0x8Ccbf019a95956cd888C91ab74D0e3506d57F972",
    "0xd7a6cf7759169E925Ec1851B8d66568906bd5D14",
    "0x420EBe180b87142fFf7891d59b80ABD5526a62a8",
    "0x4e01d48e6c7F8E73578B13cFD7838763A3516256",
  ];
  for (let i = 0; i < contractAddresses.length; i++) {
    const b = await workToken.balanceOf(contractAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Contract #" + (i + 1))} ║ ${contractAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Contract Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");

  totalBalance += subTotal;
  subTotal = 0;
  const bridgeAddresses = [
    "0x999996ED22948B075a3bEE8dbA325661ab22529E",
    "0x333333848Cfd27d989ECe8394aAFE0EB222e7077",
    "0x343F4Ef4532a99bB6441f9Fa71AAB982cC583B62",
  ];
  for (let i = 0; i < bridgeAddresses.length; i++) {
    const b = await workToken.balanceOf(bridgeAddresses[i]);
    const balance = Math.round(Number(hre.ethers.utils.formatEther(b)));
    subTotal += balance;
    if (balance > 0)
      console.log(`║ ${fill16("Bridge #" + (i + 1))} ║ ${bridgeAddresses[i]} ║ ${leftpad12(balance.toString())} ║`);
  }
  console.log(
    `║ ${fill16("Bridge Total:")} ║                                            ║ ${leftpad12(subTotal.toString())} ║`,
  );
  console.log("╠══════════════════╬════════════════════════════════════════════╬══════════════╣");

  totalBalance += subTotal;

  console.log(
    `║ ${fill16("Grand Total:")} ║                                            ║ ${leftpad12(totalBalance.toString())} ║`,
  );
  console.log("╚══════════════════╩════════════════════════════════════════════╩══════════════╝");
});

const fill16 = (s: string) => {
  return s + "                ".slice(s.length);
};

const leftpad12 = (s: string) => {
  return "            ".slice(s.length) + s;
};
