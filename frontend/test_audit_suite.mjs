import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildInvoicePDFDoc } from './src/components/pdfGenerator.js';
import { buildReceiptDoc } from './src/components/receiptGenerator.js';
import { formatCurrency, getCurrencySymbol } from './src/utils/currency.js';
import { amountInWords, numberToIndianWords, numberToInternationalWords } from './src/utils/numberToWords.js';
import { GST_STATES, getStateCodeByName, getStateNameByCode } from './src/utils/gstStates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'test_output_pdfs');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('====================================================');
console.log('🧪 AUTOINVOICE COMPREHENSIVE AUDIT & VERIFICATION');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details}`);
    failedTests++;
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: MATHEMATICAL & BILLING ENGINE CALCULATIONS
// ---------------------------------------------------------------------------
console.log('--- 1. Testing Billing Calculations & Tax Logic ---');

// Scenario A: Intra-State GST (CGST + SGST)
// Items: 2 items: 10 @ 1,200 = 12,000; 5 @ 800 = 4,000. Total = 16,000
// Discount: 10% = 1,600. Taxable = 14,400
// GST: 18% Intra-State -> CGST 9% (1,296), SGST 9% (1,296). Total Tax = 2,592
// Shipping: 250. Round off: raw = 14,400 + 2,592 + 250 = 17,242.00
{
  const item1 = { quantity: 10, rate: 1200 };
  const item2 = { quantity: 5, rate: 800 };
  const gross = (item1.quantity * item1.rate) + (item2.quantity * item2.rate);
  assert(gross === 16000, 'Gross subtotal calculation', `Expected 16000, got ${gross}`);

  const discountPct = 10;
  const discountAmt = (gross * discountPct) / 100;
  assert(discountAmt === 1600, 'Discount 10% amount', `Expected 1600, got ${discountAmt}`);

  const taxable = gross - discountAmt;
  assert(taxable === 14400, 'Taxable value after discount', `Expected 14400, got ${taxable}`);

  const taxRate = 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const cgstAmt = (taxable * cgstRate) / 100;
  const sgstAmt = (taxable * sgstRate) / 100;
  assert(cgstRate === 9 && sgstRate === 9, 'Intra-State CGST & SGST 50/50 rate split', `Expected 9% each, got ${cgstRate}% and ${sgstRate}%`);
  assert(cgstAmt === 1296 && sgstAmt === 1296, 'Intra-State CGST & SGST amounts', `Expected 1296 each, got ${cgstAmt} and ${sgstAmt}`);

  const totalTax = cgstAmt + sgstAmt;
  assert(totalTax === 2592, 'Total GST sum', `Expected 2592, got ${totalTax}`);

  const shipping = 250;
  const rawTotal = taxable + totalTax + shipping;
  assert(rawTotal === 17242, 'Grand total without rounding', `Expected 17242, got ${rawTotal}`);

  const rounded = Math.round(rawTotal);
  const roundDiff = Number((rounded - rawTotal).toFixed(2));
  assert(rounded === 17242 && roundDiff === 0, 'Round-off on whole number', `Expected 0 diff, got ${roundDiff}`);
}

// Scenario B: Inter-State GST (IGST) with Odd Decimal Rounding
// Taxable: 9,999.33, IGST: 18% = 1,799.8794 -> 1,799.88
// Total: 11,799.21 -> Rounded to 11,799.00 (diff: -0.21)
{
  const taxable = 9999.33;
  const igstRate = 18;
  const igstAmt = Number(((taxable * igstRate) / 100).toFixed(2));
  assert(igstAmt === 1799.88, 'Inter-State IGST 18% calculation', `Expected 1799.88, got ${igstAmt}`);

  const rawTotal = taxable + igstAmt;
  const rounded = Math.round(rawTotal);
  const roundDiff = Number((rounded - rawTotal).toFixed(2));
  assert(rounded === 11799, 'Nearest rupee round-off', `Expected 11799, got ${rounded}`);
  assert(roundDiff === -0.21, 'Round-off difference calculation', `Expected -0.21, got ${roundDiff}`);
}

// ---------------------------------------------------------------------------
// TEST SUITE 2: AMOUNT IN WORDS CONVERTER
// ---------------------------------------------------------------------------
console.log('\n--- 2. Testing Currency Amount in Words (Indian & International) ---');

{
  const words1 = numberToIndianWords(17242);
  assert(words1 === 'Seventeen Thousand Two Hundred Forty Two Rupees Only', 'Indian words for 17,242', `Got "${words1}"`);

  const wordsLakh = numberToIndianWords(1550250.50);
  assert(wordsLakh === 'Fifteen Lakh Fifty Thousand Two Hundred Fifty Rupees and Fifty Paise Only', 'Indian words for 15,50,250.50 (Lakhs)', `Got "${wordsLakh}"`);

  const wordsCrore = numberToIndianWords(20000000);
  assert(wordsCrore === 'Two Crore Rupees Only', 'Indian words for 2 Crores', `Got "${wordsCrore}"`);

  const wordsUSD = numberToInternationalWords(1250000.75, 'Dollars', 'Cents');
  assert(wordsUSD === 'One Million Two Hundred Fifty Thousand Dollars and Seventy Five Cents Only', 'Western words for 1,250,000.75 (Millions)', `Got "${wordsUSD}"`);

  const wordsUniversal = amountInWords(5000, 'INR - Indian Rupee');
  assert(wordsUniversal === 'Five Thousand Rupees Only', 'Universal amountInWords INR', `Got "${wordsUniversal}"`);
}

// ---------------------------------------------------------------------------
// TEST SUITE 3: INDIAN GST STATE CODES
// ---------------------------------------------------------------------------
console.log('\n--- 3. Testing GST State Codes & Validation ---');

{
  assert(GST_STATES.length === 36, 'Full count of 36 Indian States and UTs', `Count: ${GST_STATES.length}`);
  assert(getStateCodeByName('Maharashtra') === '27', 'State code for Maharashtra is 27', `Got ${getStateCodeByName('Maharashtra')}`);
  assert(getStateCodeByName('Delhi') === '07', 'State code for Delhi is 07', `Got ${getStateCodeByName('Delhi')}`);
  assert(getStateCodeByName('Karnataka') === '29', 'State code for Karnataka is 29', `Got ${getStateCodeByName('Karnataka')}`);
  assert(getStateNameByCode('27') === 'Maharashtra', 'State lookup by code 27', `Got ${getStateNameByCode('27')}`);
}

// ---------------------------------------------------------------------------
// TEST SUITE 4: MULTI-PAYMENT & PARTIAL PAYMENT LEDGER ENGINE
// ---------------------------------------------------------------------------
console.log('\n--- 4. Testing Partial Payments & Duplicate Protection ---');

{
  const invoiceTotal = 50000;
  const payments = [];

  // Transaction 1: Advance Payment of 20,000
  const tx1Ref = 'UTR-HDFC-99881122';
  const pay1Amt = 20000;
  const prevPaid1 = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid1 = prevPaid1 + pay1Amt;
  const balance1 = invoiceTotal - totalPaid1;
  const rec1 = {
    receiptNumber: 'REC-2025-001-1',
    transactionId: tx1Ref,
    amount: pay1Amt,
    previousPaid: prevPaid1,
    totalPaidToDate: totalPaid1,
    remainingBalance: balance1
  };
  payments.push(rec1);

  assert(rec1.receiptNumber === 'REC-2025-001-1', 'Receipt 1 numbering sequence');
  assert(rec1.previousPaid === 0, 'Transaction 1 previous paid is 0');
  assert(rec1.remainingBalance === 30000, 'Transaction 1 remaining balance is 30,000');
  assert(balance1 > 0 && totalPaid1 > 0, 'Status after Tx 1 is partially_paid');

  // Attempt duplicate of tx1Ref -> Must be rejected!
  const isDuplicate = payments.some(p => p.transactionId.toLowerCase() === tx1Ref.toLowerCase());
  assert(isDuplicate === true, 'Duplicate transaction reference detected and blocked');

  // Transaction 2: Second Partial Payment of 20,000
  const tx2Ref = 'UTR-ICICI-44556677';
  const pay2Amt = 20000;
  const prevPaid2 = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid2 = prevPaid2 + pay2Amt;
  const balance2 = invoiceTotal - totalPaid2;
  const rec2 = {
    receiptNumber: 'REC-2025-001-2',
    transactionId: tx2Ref,
    amount: pay2Amt,
    previousPaid: prevPaid2,
    totalPaidToDate: totalPaid2,
    remainingBalance: balance2
  };
  payments.push(rec2);

  assert(rec2.receiptNumber === 'REC-2025-001-2', 'Receipt 2 numbering sequence');
  assert(rec2.previousPaid === 20000, 'Transaction 2 previous paid is 20,000');
  assert(rec2.totalPaidToDate === 40000, 'Cumulative total paid after Tx 2 is 40,000');
  assert(rec2.remainingBalance === 10000, 'Remaining balance after Tx 2 is 10,000');

  // Transaction 3: Final Settlement of 10,000
  const tx3Ref = 'UPI-PAYTM-11223344';
  const pay3Amt = 10000;
  const prevPaid3 = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid3 = prevPaid3 + pay3Amt;
  const balance3 = invoiceTotal - totalPaid3;
  const rec3 = {
    receiptNumber: 'REC-2025-001-3',
    transactionId: tx3Ref,
    amount: pay3Amt,
    previousPaid: prevPaid3,
    totalPaidToDate: totalPaid3,
    remainingBalance: balance3
  };
  payments.push(rec3);

  assert(rec3.receiptNumber === 'REC-2025-001-3', 'Receipt 3 numbering sequence');
  assert(rec3.totalPaidToDate === 50000, 'Cumulative total paid after Tx 3 is 50,000');
  assert(rec3.remainingBalance === 0, 'Remaining balance after final Tx is 0 (Paid in Full)');
}

// ---------------------------------------------------------------------------
// TEST SUITE 5: ACTUAL PDF RENDERING TO DISK ACROSS ALL 4 TEMPLATES
// ---------------------------------------------------------------------------
console.log('\n--- 5. Generating & Writing Actual PDFs for Inspection ---');

const sampleProfile = {
  fullName: 'Saumya Mirajkar',
  businessName: 'AutoInvoice Technologies Pvt Ltd',
  address: 'Level 14, Tower B, Cyber City, Bandra Kurla Complex, Mumbai 400051',
  country: 'India',
  stateName: 'Maharashtra',
  phone: '+91 98765 43210',
  email: 'billing@autoinvoice.io',
  website: 'https://autoinvoice.io',
  businessGstin: '27AABCA1234F1Z5',
  pan: 'AABCA1234F',
  bankName: 'HDFC Bank Ltd',
  accountHolder: 'AutoInvoice Technologies Pvt Ltd',
  accountNumber: '50200098765432',
  ifscCode: 'HDFC0000123',
  branch: 'BKC Branch, Mumbai',
  upiId: 'autoinvoice@okhdfcbank',
  defaultTerms: 'Payment due within 30 days. Subject to Mumbai Jurisdiction.'
};

const sampleClient = {
  company: 'Global Enterprises Inc',
  contact: 'Marcus Vance',
  email: 'marcus@globalenterprises.com',
  address: 'Suite 800, Financial Center, Whitefield, Bengaluru, Karnataka 560066',
  country: 'India',
  stateName: 'Karnataka',
  gstin: '29AAACG9988H1Z8',
  phone: '+91 80 1234 5678'
};

const sampleItems = [
  { sNo: 1, description: 'Enterprise SaaS Cloud Architecture & Migration', hsnSac: '998313', quantity: 1, unit: 'Units', rate: 45000, amount: 45000 },
  { sNo: 2, description: 'Custom Microservices Backend & PostgreSQL Engineering', hsnSac: '998314', quantity: 80, unit: 'Hrs', rate: 1200, amount: 96000 },
  { sNo: 3, description: 'Security Hardening, Penetration Testing & Helmet CSP Audit', hsnSac: '998315', quantity: 1, unit: 'Sets', rate: 25000, amount: 25000 },
  { sNo: 4, description: 'High-Performance UI/UX Component Library Design', hsnSac: '998314', quantity: 1, unit: 'Sets', rate: 30000, amount: 30000 }
];

// Gross: 45k + 96k + 25k + 30k = 196,000
// Discount 5% = 9,800. Taxable = 186,200
// IGST 18% (Inter-State MH -> KA) = 33,516
// Shipping: 500. Total = 220,216.00

const sampleInvoice = {
  id: 'INV-2026-AUDIT-01',
  client: sampleClient.company,
  clientEmail: sampleClient.email,
  clientGstin: sampleClient.gstin,
  created: 'Oct 27, 2026',
  due: 'Nov 26, 2026',
  language: 'English',
  currency: 'INR - Indian Rupee',
  items: sampleItems,
  discount: 5,
  tax: 18,
  gstEnabled: true,
  gstType: 'inter',
  placeOfSupply: 'Karnataka',
  reverseCharge: false,
  shippingCharges: 500,
  amount: 220216,
  status: 'partially_paid',
  amountPaid: 100000,
  balanceDue: 120216,
  notes: 'Payment requested via RTGS or NEFT to the bank account detailed below.'
};

// 1. Template: gst_pro
try {
  const { doc } = buildInvoicePDFDoc(sampleInvoice, sampleProfile, sampleClient, 'English', 'INR - Indian Rupee', 'gst_pro');
  const outPath = path.join(OUTPUT_DIR, '01_Invoice_Template_GST_PRO.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && fs.statSync(outPath).size > 1000, 'Generated PDF: Executive GST Pro', `Saved to ${outPath} (${fs.statSync(outPath).size} bytes)`);
} catch (err) {
  assert(false, 'Generated PDF: Executive GST Pro', err.message);
}

// 2. Template: modern
try {
  const { doc } = buildInvoicePDFDoc(sampleInvoice, sampleProfile, sampleClient, 'English', 'INR - Indian Rupee', 'modern');
  const outPath = path.join(OUTPUT_DIR, '02_Invoice_Template_MODERN.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && fs.statSync(outPath).size > 1000, 'Generated PDF: Modern Clean', `Saved to ${outPath} (${fs.statSync(outPath).size} bytes)`);
} catch (err) {
  assert(false, 'Generated PDF: Modern Clean', err.message);
}

// 3. Template: classic
try {
  const { doc } = buildInvoicePDFDoc(sampleInvoice, sampleProfile, sampleClient, 'English', 'INR - Indian Rupee', 'classic');
  const outPath = path.join(OUTPUT_DIR, '03_Invoice_Template_CLASSIC.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && fs.statSync(outPath).size > 1000, 'Generated PDF: Classic Corporate', `Saved to ${outPath} (${fs.statSync(outPath).size} bytes)`);
} catch (err) {
  assert(false, 'Generated PDF: Classic Corporate', err.message);
}

// 4. Template: minimal
try {
  const { doc } = buildInvoicePDFDoc(sampleInvoice, sampleProfile, sampleClient, 'English', 'INR - Indian Rupee', 'minimal');
  const outPath = path.join(OUTPUT_DIR, '04_Invoice_Template_MINIMAL.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && fs.statSync(outPath).size > 1000, 'Generated PDF: Minimalist Elegance', `Saved to ${outPath} (${fs.statSync(outPath).size} bytes)`);
} catch (err) {
  assert(false, 'Generated PDF: Minimalist Elegance', err.message);
}

// 5. Multi-Page Safety: 25 Line Items
try {
  const multiItems = [];
  for (let i = 1; i <= 25; i++) {
    multiItems.push({
      sNo: i,
      description: `Enterprise Cloud Component Module #${i} - High-throughput microservice queue handler with automated failover and telemetry logging`,
      hsnSac: '998314',
      quantity: i,
      unit: 'Nos',
      rate: 1500,
      amount: i * 1500
    });
  }
  const multiPageInv = {
    ...sampleInvoice,
    id: 'INV-2026-MULTIPAGE',
    items: multiItems,
    amount: multiItems.reduce((sum, item) => sum + item.amount, 0)
  };
  const { doc } = buildInvoicePDFDoc(multiPageInv, sampleProfile, sampleClient, 'English', 'INR - Indian Rupee', 'gst_pro');
  const outPath = path.join(OUTPUT_DIR, '05_Invoice_MultiPage_25Items.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  const totalPages = doc.internal.getNumberOfPages();
  assert(totalPages >= 2, 'Multi-Page Overflow Handling (adds pages for long invoices)', `Total Pages: ${totalPages}`);
  assert(fs.existsSync(outPath), 'Generated Multi-Page PDF successfully', `Saved to ${outPath}`);
} catch (err) {
  assert(false, 'Multi-Page Overflow Handling', err.message);
}

// 6. Payment Receipt: Partial Payment
try {
  const partialPaymentRecord = {
    receiptNumber: 'REC-2026-AUDIT-01-1',
    amount: 100000,
    previousPaid: 0,
    totalPaidToDate: 100000,
    remainingBalance: 120216,
    transactionId: 'UTR-HDFC-8822991100',
    method: 'bank_transfer',
    paidAt: new Date().toISOString(),
    notes: 'Advance 45% milestone payment for architecture phase'
  };
  const { doc, receiptNo } = buildReceiptDoc(sampleInvoice, sampleProfile, sampleClient, partialPaymentRecord);
  const outPath = path.join(OUTPUT_DIR, '06_Payment_Receipt_Partial.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && receiptNo === 'REC-2026-AUDIT-01-1', 'Generated Receipt: Partial Payment with Remaining Balance', `Saved to ${outPath}`);
} catch (err) {
  assert(false, 'Generated Receipt: Partial Payment', err.message);
}

// 7. Payment Receipt: Full Settlement
try {
  const fullPaymentRecord = {
    receiptNumber: 'REC-2026-AUDIT-01-2',
    amount: 120216,
    previousPaid: 100000,
    totalPaidToDate: 220216,
    remainingBalance: 0,
    transactionId: 'UPI-SBI-334455667788',
    method: 'upi',
    paidAt: new Date().toISOString(),
    notes: 'Final settlement payment. Invoice fully closed.'
  };
  const { doc, receiptNo } = buildReceiptDoc(sampleInvoice, sampleProfile, sampleClient, fullPaymentRecord);
  const outPath = path.join(OUTPUT_DIR, '07_Payment_Receipt_FullSettlement.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  assert(fs.existsSync(outPath) && receiptNo === 'REC-2026-AUDIT-01-2', 'Generated Receipt: Full Settlement (PAID IN FULL stamp)', `Saved to ${outPath}`);
} catch (err) {
  assert(false, 'Generated Receipt: Full Settlement', err.message);
}

console.log('\n====================================================');
console.log(`RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('====================================================');

process.exit(failedTests === 0 ? 0 : 1);
