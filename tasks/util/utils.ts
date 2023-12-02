export const workBought = (
  round: number,
  amount: string | number,
  poolSize: string | number,
  presalePrivate: boolean,
) => {
  if (amount === "0" || poolSize === "0") {
    return 0;
  }

  const startPrices = [0.08, 0.14, 0.16];
  const startPrice = startPrices[round] - (round === 2 && presalePrivate ? 0.01 : 0);
  const priceChangePerStep = 0.004;
  const poolStepsArr = [0, 25_000, 75_000, 150_000, 250_000];
  const poolStepDifferences = [25_000, 50_000, 75_000, 100_000];
  const poolStep = poolStepsArr.findIndex(step => step >= Number(poolSize)) - 1;
  const highestPrice = startPrice + priceChangePerStep * 4;
  const currStartPrice = highestPrice - priceChangePerStep * poolStep;
  const poolSizeAlong = Number(poolSize) - poolStepsArr[poolStep];
  const fullStep = poolStepDifferences[poolStep];
  const fractionAlong = Math.floor((Number(poolSizeAlong) * 10000) / fullStep) / 10000;
  const buyPrice = currStartPrice - priceChangePerStep * fractionAlong;
  const calculatedAmount = Number(amount) / buyPrice;

  return Math.ceil(calculatedAmount);
};
