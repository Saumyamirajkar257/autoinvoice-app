export const CURRENCY_SYMBOLS = {
  'USD - US Dollar': '$',
  'INR - Indian Rupee': '₹',
  'EUR - Euro': '€',
  'GBP - British Pound': '£',
  'USD': '$',
  'INR': '₹',
  'EUR': '€',
  'GBP': '£'
};

export function getCurrencySymbol(currencyString) {
  if (!currencyString) return '$';
  for (const [key, symbol] of Object.entries(CURRENCY_SYMBOLS)) {
    if (currencyString.includes(key)) {
      return symbol;
    }
  }
  return '$';
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
