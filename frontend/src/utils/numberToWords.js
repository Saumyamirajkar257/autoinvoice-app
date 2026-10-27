/**
 * Converts numeric currency amounts into formal capitalized words.
 * Supports both Indian numbering system (Lakhs, Crores) and Western system (Millions, Billions).
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ONES[n % 10] : '');
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

/**
 * Indian Numbering Format: Crores, Lakhs, Thousands, Hundreds
 */
export function numberToIndianWords(amount) {
  const num = Math.floor(Math.abs(Number(amount) || 0));
  const paise = Math.round((Math.abs(Number(amount) || 0) - num) * 100);

  if (num === 0 && paise === 0) return 'Zero Rupees Only';

  let words = '';

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  if (crore > 0) {
    words += convertBelowThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertBelowThousand(remainder) + ' ';
  }

  words = words.trim();
  if (!words) words = 'Zero';

  let result = words + ' Rupees';

  if (paise > 0) {
    result += ' and ' + convertBelowThousand(paise) + ' Paise';
  }

  return result + ' Only';
}

/**
 * International Numbering Format: Billions, Millions, Thousands, Hundreds
 */
export function numberToInternationalWords(amount, currencyName = 'Dollars', subUnit = 'Cents') {
  const num = Math.floor(Math.abs(Number(amount) || 0));
  const cents = Math.round((Math.abs(Number(amount) || 0) - num) * 100);

  if (num === 0 && cents === 0) return `Zero ${currencyName} Only`;

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let words = '';
  if (billions > 0) words += convertBelowThousand(billions) + ' Billion ';
  if (millions > 0) words += convertBelowThousand(millions) + ' Million ';
  if (thousands > 0) words += convertBelowThousand(thousands) + ' Thousand ';
  if (remainder > 0) words += convertBelowThousand(remainder) + ' ';

  words = words.trim();
  if (!words) words = 'Zero';

  let result = `${words} ${currencyName}`;
  if (cents > 0) {
    result += ` and ${convertBelowThousand(cents)} ${subUnit}`;
  }

  return result + ' Only';
}

/**
 * Universal Currency to Words Formatter
 */
export function amountInWords(amount, currencyString = 'INR - Indian Rupee') {
  const str = String(currencyString || '').toUpperCase();
  if (str.includes('INR') || str.includes('RUPEE')) {
    return numberToIndianWords(amount);
  } else if (str.includes('EUR') || str.includes('EURO')) {
    return numberToInternationalWords(amount, 'Euros', 'Cents');
  } else if (str.includes('GBP') || str.includes('POUND')) {
    return numberToInternationalWords(amount, 'Pounds', 'Pence');
  } else if (str.includes('CAD')) {
    return numberToInternationalWords(amount, 'Canadian Dollars', 'Cents');
  } else if (str.includes('AUD')) {
    return numberToInternationalWords(amount, 'Australian Dollars', 'Cents');
  } else {
    return numberToInternationalWords(amount, 'US Dollars', 'Cents');
  }
}
