export const CURRENCY_SYMBOLS = {
  'USD - US Dollar': '$',
  'INR - Indian Rupee': '₹',
  'EUR - Euro': '€',
  'GBP - British Pound': '£',
  'CAD - Canadian Dollar': 'CA$',
  'AUD - Australian Dollar': 'A$',
  'USD': '$',
  'INR': '₹',
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
  if (!currencyString) return 'USD';
  if (currencyString.includes('INR')) return 'INR';
  if (currencyString.includes('EUR')) return 'EUR';
  if (currencyString.includes('GBP')) return 'GBP';
  if (currencyString.includes('CAD')) return 'CAD';
  if (currencyString.includes('AUD')) return 'AUD';
  return 'USD';
}

export function getCurrencySymbol(currencyString) {
  const code = getCurrencyCode(currencyString);
  return CURRENCY_SYMBOLS[code] || '$';
}

export function formatCurrency(amount, currencyString) {
  const symbol = getCurrencySymbol(currencyString);
  const num = Number(amount || 0);
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol}${formattedNumber}`;
}

export function convertCurrency(amount, fromCurrencyString, toCurrencyCode) {
  const fromCode = getCurrencyCode(fromCurrencyString);
  const fromRate = EXCHANGE_RATES_USD[fromCode] || 1.0;
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
