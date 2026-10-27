import os
import sys
import re
from pypdf import PdfReader

PDF_DIR = r"D:\COMEBACK\PROJECR\frontend\test_output_pdfs"

files = [
    "01_Invoice_Template_GST_PRO.pdf",
    "02_Invoice_Template_MODERN.pdf",
    "03_Invoice_Template_CLASSIC.pdf",
    "04_Invoice_Template_MINIMAL.pdf",
    "05_Invoice_MultiPage_25Items.pdf",
    "06_Payment_Receipt_Partial.pdf",
    "07_Payment_Receipt_FullSettlement.pdf"
]

print("====================================================")
print("🔍 PYPDF DETAILED INSPECTION OF GENERATED PDF FILES")
print("====================================================\n")

all_checks_passed = True

def check_contains(text, expected, label):
    global all_checks_passed
    # Normalize whitespaces and newlines
    norm_text = re.sub(r'\s+', ' ', text).lower()
    norm_expected = re.sub(r'\s+', ' ', expected).lower()
    if norm_expected in norm_text:
        print(f"  ✓ Found '{expected}' in {label}")
    else:
        print(f"  ✗ MISSING '{expected}' in {label}")
        all_checks_passed = False

for filename in files:
    filepath = os.path.join(PDF_DIR, filename)
    if not os.path.exists(filepath):
        print(f"✗ File missing: {filename}")
        all_checks_passed = False
        continue

    reader = PdfReader(filepath)
    num_pages = len(reader.pages)
    print(f"\n📄 File: {filename} ({num_pages} Page{'s' if num_pages > 1 else ''}, {os.path.getsize(filepath):,} bytes)")

    full_text = "\n".join([page.extract_text() for page in reader.pages])

    if filename == "01_Invoice_Template_GST_PRO.pdf":
        check_contains(full_text, "TAX INVOICE", filename)
        check_contains(full_text, "AutoInvoice Technologies", filename)
        check_contains(full_text, "27AABCA1234F1Z5", filename)
        check_contains(full_text, "HDFC Bank", filename)
        check_contains(full_text, "50200098765432", filename)
        check_contains(full_text, "HDFC0000123", filename)
        check_contains(full_text, "IGST", filename)
        check_contains(full_text, "Two Lakh Twenty Thousand Two Hundred Sixteen Rupees Only", filename)
        check_contains(full_text, "Authorized Signatory", filename)
        check_contains(full_text, "2,20,216.00", filename)

    elif filename == "02_Invoice_Template_MODERN.pdf":
        check_contains(full_text, "INVOICE", filename)
        check_contains(full_text, "Global Enterprises Inc", filename)
        check_contains(full_text, "2,20,216.00", filename)

    elif filename == "03_Invoice_Template_CLASSIC.pdf":
        check_contains(full_text, "INVOICE", filename)
        check_contains(full_text, "AutoInvoice Technologies", filename)
        check_contains(full_text, "2,20,216.00", filename)

    elif filename == "04_Invoice_Template_MINIMAL.pdf":
        check_contains(full_text, "INVOICE", filename)
        check_contains(full_text, "2,20,216.00", filename)

    elif filename == "05_Invoice_MultiPage_25Items.pdf":
        if num_pages >= 2:
            print(f"  ✓ Multi-page overflow verified: {num_pages} pages for 25 large items")
        else:
            print(f"  ✗ Expected >= 2 pages, got {num_pages}")
            all_checks_passed = False
        page2_text = reader.pages[1].extract_text()
        check_contains(page2_text, "DESCRIPTION", "Page 2 header")

    elif filename == "06_Payment_Receipt_Partial.pdf":
        check_contains(full_text, "PAYMENT RECEIPT", filename)
        check_contains(full_text, "REC-2026-AUDIT-01-1", filename)
        check_contains(full_text, "PARTIAL PAYMENT RECEIVED", filename)
        check_contains(full_text, "1,00,000.00", filename)
        check_contains(full_text, "1,20,216.00", filename)
        check_contains(full_text, "One Lakh Rupees Only", filename)
        check_contains(full_text, "UTR-HDFC-8822991100", filename)

    elif filename == "07_Payment_Receipt_FullSettlement.pdf":
        check_contains(full_text, "PAYMENT RECEIPT", filename)
        check_contains(full_text, "REC-2026-AUDIT-01-2", filename)
        check_contains(full_text, "PAID IN FULL", filename)
        check_contains(full_text, "2,20,216.00", filename)
        check_contains(full_text, "UPI-SBI-334455667788", filename)

print("\n====================================================")
if all_checks_passed:
    print("🎉 ALL PDF INSPECTION CRITERIA VERIFIED AND PASSED!")
    sys.exit(0)
else:
    print("❌ SOME PDF CHECKS FAILED.")
    sys.exit(1)
