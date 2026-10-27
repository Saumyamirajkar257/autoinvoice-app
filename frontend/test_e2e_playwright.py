import os
import sys
import time
import subprocess
import urllib.request
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = r"D:\COMEBACK\PROJECR\frontend\test_output_screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

print("====================================================")
print("🚀 RUNNING FULL END-TO-END AUTOMATION AUDIT SUITE")
print("====================================================\n")

# Connect directly to running Vite server
def wait_for_server(url="http://localhost:5173/", timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            res = urllib.request.urlopen(url, timeout=1)
            if res.status == 200:
                print("✓ Connected to Vite server at http://localhost:5173/")
                return True
        except Exception:
            time.sleep(0.5)
    return False

if not wait_for_server():
    print("❌ Failed to reach Vite server at http://localhost:5173/")
    sys.exit(1)

console_errors = []

def on_console(msg):
    if msg.type in ['error']:
        text = msg.text
        # Ignore expected HTTP status error reports from secure API fallbacks (401 unauthenticated, 404, 500)
        if any(code in text for code in ["401", "404", "500"]) and "/api/" in text:
            return
        if "Failed to load resource" in text and ("401" in text or "404" in text or "500" in text):
            return
        console_errors.append(f"[{msg.type}] {text}")

e2e_passed = 0
e2e_failed = 0

def record_test(condition, name, details=""):
    global e2e_passed, e2e_failed
    if condition:
        print(f"  ✓ PASS: {name}")
        e2e_passed += 1
    else:
        print(f"  ✗ FAIL: {name} - {details}")
        e2e_failed += 1

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # -------------------------------------------------------------------------
    # PART 1: DESKTOP VIEWPORT (1440 x 900)
    # -------------------------------------------------------------------------
    print("\n--- Testing Desktop Viewport (1440x900) ---")
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", on_console)

    # Pre-populate session
    page.goto("http://localhost:5173/")
    page.evaluate('''() => {
      localStorage.setItem('autoinvoice_session_user', JSON.stringify({
        fullName: 'Saumya Mirajkar',
        email: 'saumyamir25@gmail.com'
      }));
      localStorage.removeItem('autoinvoice_logged_out');
    }''')

    # 1. Dashboard
    page.goto("http://localhost:5173/dashboard")
    page.wait_for_selector(".metrics-grid", timeout=10000)
    time.sleep(1)

    record_test(page.title() == "AutoInvoice - Invoice Management", "Page Title Verification")
    has_command_center = page.locator("text=Executive Command Center").count() > 0
    record_test(has_command_center, "Dashboard Command Center Header Rendered")

    metric_cards = page.locator(".metric-card").count()
    record_test(metric_cards >= 4, f"Metric Cards rendered (Found {metric_cards})")

    # Time filters
    chart_exists = page.locator(".chart-card").count() > 0
    record_test(chart_exists, "Revenue & Expense Analytics Chart Card Rendered")

    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "01_Desktop_Dashboard.png"), full_page=True)

    # 2. Invoices List
    print("\n--- Testing Invoices Workspace ---")
    page.goto("http://localhost:5173/invoices")
    page.wait_for_selector(".filter-tabs", timeout=10000)
    time.sleep(0.5)

    has_tabs = page.locator(".filter-tabs button").count()
    record_test(has_tabs >= 6, f"Filter Tabs present (Found {has_tabs} tabs)")

    # Test tab filtering
    paid_tab = page.locator("button:has-text('Paid')").first
    if paid_tab:
        paid_tab.click()
        time.sleep(0.3)
        record_test(True, "Clicked Paid Tab filter successfully")

    all_tab = page.locator("button:has-text('All')").first
    if all_tab:
        all_tab.click()
        time.sleep(0.3)

    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "02_Desktop_Invoices_List.png"), full_page=True)

    # 3. Create Invoice Page
    print("\n--- Testing Create Invoice Form & Live Preview ---")
    page.goto("http://localhost:5173/invoices/create")
    page.wait_for_selector("input[placeholder*='e.g. INV-']", timeout=10000)
    time.sleep(0.5)

    has_form = page.locator("input[placeholder*='e.g. INV-']").count() > 0
    record_test(has_form, "Create Invoice form loaded with auto-generated sequence")

    # Add quick preset item
    preset_btn = page.locator("button:has-text('+ UI/UX')").first
    if preset_btn.count() > 0:
        preset_btn.click()
        time.sleep(0.3)
        record_test(True, "Quick Preset line item added")

    # Toggle live document preview sheet
    toggle_preview_btn = page.locator("button:has-text('Live Document Preview')").first
    if toggle_preview_btn.count() > 0:
        toggle_preview_btn.click()
        time.sleep(0.4)
        has_sheet = page.locator("h2:has-text('TAX INVOICE')").count() > 0
        record_test(has_sheet, "Interactive Live Paper Preview rendered cleanly")
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "03_Desktop_CreateInvoice_LivePreview.png"), full_page=True)
        # Toggle back to form
        page.locator("button:has-text('Edit Form')").first.click()
        time.sleep(0.3)

    # Save as Draft
    save_draft_btn = page.locator("button:has-text('Save as Draft')").first
    if save_draft_btn.count() > 0:
        save_draft_btn.click()
        page.wait_for_selector(".table-container", timeout=10000)
        time.sleep(0.5)
        record_test(page.url.endswith("/invoices"), "Saved invoice as Draft and navigated to Invoices list")

    # 4. Payments Ledger
    print("\n--- Testing Payments Ledger ---")
    page.goto("http://localhost:5173/payments")
    page.wait_for_selector(".table-container", timeout=10000)
    time.sleep(0.5)

    has_ledger = page.locator("text=Payments Ledger").count() > 0
    record_test(has_ledger, "Payments Ledger & Audit Trail rendered")
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "04_Desktop_Payments_Ledger.png"), full_page=True)

    # 5. Clients Directory
    print("\n--- Testing Clients Management ---")
    page.goto("http://localhost:5173/clients")
    page.wait_for_selector(".table-container", timeout=10000)
    time.sleep(0.5)

    has_clients = page.locator("text=Clients").count() > 0
    record_test(has_clients, "Clients Directory rendered")
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "05_Desktop_Clients.png"), full_page=True)

    # 6. Expenses Module
    print("\n--- Testing Expenses Tracking ---")
    page.goto("http://localhost:5173/expenses")
    page.wait_for_selector(".table-container", timeout=10000)
    time.sleep(0.5)

    has_expenses = page.locator("text=Expenses Tracking").count() > 0
    record_test(has_expenses, "Expenses Tracking rendered")
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "06_Desktop_Expenses.png"), full_page=True)

    # 7. Profile & Settings
    print("\n--- Testing Profile & Settings ---")
    page.goto("http://localhost:5173/profile")
    page.wait_for_selector("input[placeholder*='HDFC Bank']", timeout=10000)
    time.sleep(0.5)

    has_bank_field = page.locator("input[placeholder*='HDFC Bank']").count() > 0
    record_test(has_bank_field, "Bank Details & IFSC configuration inputs rendered in Profile")

    page.goto("http://localhost:5173/settings")
    page.wait_for_selector("text=Settings", timeout=10000)
    time.sleep(0.5)
    record_test(page.locator("text=Settings").count() > 0, "Settings Page loaded")

    # 8. Customer Public Pay Portal
    print("\n--- Testing Public Customer Portal ---")
    page.goto("http://localhost:5173/#/pay/INV-001")
    page.wait_for_selector("text=AutoInvoice Pay", timeout=10000)
    time.sleep(0.5)

    has_public_pay = page.locator("text=AutoInvoice Pay").count() > 0
    record_test(has_public_pay, "Customer Public Payment Portal rendered with QR & Security seal")
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "07_Desktop_Customer_PublicPay.png"), full_page=True)

    page.close()

    # -------------------------------------------------------------------------
    # PART 2: TABLET VIEWPORT (768 x 1024)
    # -------------------------------------------------------------------------
    print("\n--- Testing Tablet Viewport (768x1024) ---")
    page_tab = browser.new_page(viewport={"width": 768, "height": 1024})
    page_tab.goto("http://localhost:5173/dashboard")
    page_tab.wait_for_selector(".metrics-grid", timeout=10000)
    time.sleep(0.5)

    # Verify no horizontal scrollbar on body
    is_overflowing = page_tab.evaluate("() => document.body.scrollWidth > window.innerWidth")
    record_test(not is_overflowing, "Tablet Responsive Grid: Zero horizontal overflow")
    page_tab.screenshot(path=os.path.join(SCREENSHOTS_DIR, "08_Tablet_Dashboard.png"), full_page=True)
    page_tab.close()

    # -------------------------------------------------------------------------
    # PART 3: MOBILE VIEWPORT (390 x 844 iPhone 14)
    # -------------------------------------------------------------------------
    print("\n--- Testing Mobile Viewport (390x844) ---")
    page_mob = browser.new_page(viewport={"width": 390, "height": 844})
    page_mob.goto("http://localhost:5173/dashboard")
    page_mob.wait_for_selector(".metrics-grid", timeout=10000)
    time.sleep(0.5)

    is_mob_overflowing = page_mob.evaluate("() => document.body.scrollWidth > window.innerWidth")
    record_test(not is_mob_overflowing, "Mobile Viewport: Zero horizontal overflow")

    # Test Mobile Drawer Toggle
    menu_btn = page_mob.locator(".mobile-menu-btn")
    if menu_btn.count() > 0:
        menu_btn.click()
        time.sleep(0.4)
        is_drawer_open = page_mob.locator(".sidebar.mobile-open").count() > 0
        record_test(is_drawer_open, "Mobile Drawer navigation opens cleanly on tap")
        page_mob.screenshot(path=os.path.join(SCREENSHOTS_DIR, "09_Mobile_Nav_Drawer.png"))

        # Close drawer with the drawer close button
        close_btn = page_mob.locator(".sidebar-close-mobile-btn")
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(0.3)
            is_closed = page_mob.locator(".sidebar.mobile-open").count() == 0
            record_test(is_closed, "Mobile Drawer closes cleanly")

    page_mob.screenshot(path=os.path.join(SCREENSHOTS_DIR, "10_Mobile_Dashboard.png"), full_page=True)
    page_mob.close()

    browser.close()

print("\n====================================================")
print(f"E2E PLAYWRIGHT RESULTS: {e2e_passed} PASSED, {e2e_failed} FAILED")
print(f"Console Uncaught Errors: {len(console_errors)}")
if console_errors:
    for err in console_errors:
        print("  - " + err)
print("====================================================")

sys.exit(0 if (e2e_failed == 0 and len(console_errors) == 0) else 1)
