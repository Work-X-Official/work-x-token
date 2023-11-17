# Work X

## Pre Requisites

Before running any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. Follow the example in `.env.example`.

Then, proceed with installing dependencies:

```sh
yarn
```

## Compile

Compile the smart contracts with Hardhat:

```sh
yarn compile
```

## Generate Types

Generate the smart contract types with TypeChain:

```sh
yarn typechain
```

## Lint Solidity

Lint the Solidity code:

```sh
yarn lint:sol
```

## Lint TypeScript

Lint the TypeScript code:

```sh
yarn lint:ts
```

## Test

```sh
yarn test
```
