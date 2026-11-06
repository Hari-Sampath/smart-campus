"""Optional real-browser check (needs: pip install playwright && playwright install chromium).
Usage: python tests/e2e_browser.py [url]   default: opens static/index.html straight from disk (offline demo mode)"""
import os, sys
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "index.html"))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 800}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_selector("#main h1", timeout=8000)
    assert pg.inner_text("#main h1") == "Campus energy", "overview should render on a fresh load"
    for name, title in [("classrooms", "Classroom AC"), ("servers", "Server scheduling"), ("data", "Data")]:
        pg.click(f'nav a[data-v="{name}"]'); pg.wait_for_function(f'document.querySelector("#main h1").innerText=="{title}"')
    pg.click("#tg"); assert "min" in pg.get_attribute("#side", "class"), "sidebar collapses"
    assert not errs, errs
    print("browser checks passed:", url); b.close()
