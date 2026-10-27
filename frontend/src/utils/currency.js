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
  const str = String(currencyString).toUpperCase();
  if (str.includes('USD') || str === '$') return 'USD';
  if (str.includes('EUR') || str === '€') return 'EUR';
  if (str.includes('GBP') || str === '£') return 'GBP';
  if (str.includes('CAD')) return 'CAD';
  if (str.includes('AUD')) return 'AUD';
  if (str.includes('INR') || str === '₹') return 'INR';
  return 'INR';
}

export function getCurrencySymbol(currencyString) {
  const code = getCurrencyCode(currencyString);
  return CURRENCY_SYMBOLS[code] || '₹';
}

export function formatCurrency(amount, currencyString) {
  const code = getCurrencyCode(currencyString);
  const symbol = CURRENCY_SYMBOLS[code] || '₹';
  const num = Number(amount || 0);

  // Use Indian number formatting (Lakhs/Crores) for INR, and standard for others
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  const formattedNumber = num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${symbol}${formattedNumber}`;
}

export function formatNumberOnly(amount, currencyString) {
  const code = getCurrencyCode(currencyString);
  const num = Number(amount || 0);
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  return num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
    formatted: `${CURRENCY_SYMBOLS[toCurrencyCode] || ''}${convertedAmount.toLocaleString(toCurrencyCode === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  };
}
