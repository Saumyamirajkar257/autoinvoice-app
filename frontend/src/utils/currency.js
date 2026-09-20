export const CURRENCY_SYMBOLS = {
  'INR - Indian Rupee': '₹',
  'USD - US Dollar': '$',
  'EUR - Euro': '€',
  'GBP - British Pound': '£',
  'CAD - Canadian Dollar': 'CA$',
  'AUD - Australian Dollar': 'A$',
  'INR': '₹',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'CAD': 'CA$',
  'AUD': 'A$'
};

// Base FX Exchange Rates against USD (1 USD =)
export const EXCHANGE_RATES_USD = {
  'USD': 1.0,
  'INR': 83.50,
  'EUR': 0.92,
  'GBP': 0.79,
  'CAD': 1.36,
  'AUD': 1.51
};

export function getCurrencyCode(currencyString) {
  if (!currencyString) return 'INR';
  if (currencyString.includes('USD')) return 'USD';
  if (currencyString.includes('EUR')) return 'EUR';
  if (currencyString.includes('GBP')) return 'GBP';
  if (currencyString.includes('CAD')) return 'CAD';
  if (currencyString.includes('AUD')) return 'AUD';
  if (currencyString.includes('INR')) return 'INR';
  return 'INR';
}

export function getCurrencySymbol(currencyString) {
  const code = getCurrencyCode(currencyString);
  return CURRENCY_SYMBOLS[code] || '₹';
}

export function formatCurrency(amount, currencyString) {
  const symbol = getCurrencySymbol(currencyString);
  const num = Number(amount || 0);
  const formattedNumber = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol}${formattedNumber}`;
}

export function convertCurrency(amount, fromCurrencyString, toCurrencyCode) {
  const fromCode = getCurrencyCode(fromCurrencyString);
  const fromRate = EXCHANGE_RATES_USD[fromCode] || 83.50;
  const toRate = EXCHANGE_RATES_USD[toCurrencyCode] || 1.0;

  // Convert to USD then to target currency
  const amountInUSD = Number(amount || 0) / fromRate;
  const convertedAmount = amountInUSD * toRate;

  return {
    code: toCurrencyCode,
    symbol: CURRENCY_SYMBOLS[toCurrencyCode] || toCurrencyCode,
    amount: convertedAmount,
    formatted: `${CURRENCY_SYMBOLS[toCurrencyCode] || ''}${convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  };
}
