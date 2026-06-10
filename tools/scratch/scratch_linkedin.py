import random
import re
import time
from datetime import datetime
from urllib.parse import quote

import pandas as pd
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

BASE = "https://www.linkedin.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "keep-alive",
}

def build_session() -> cffi_requests.Session:
    s = cffi_requests.Session(impersonate="chrome")
    s.headers.update(HEADERS)
    return s

def get_html(session, url: str) -> str:
    for attempt in range(1, 4):
        try:
            print(f"GET {url}")
            r = session.get(url, timeout=30)
            print(f"Status Code: {r.status_code}")
            if r.status_code in [429, 999]:
                wait = 10 * attempt + random.uniform(2.0, 5.0)
                print(f"Blocked! Waiting {wait}s")
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.text
        except Exception as e:
            print(f"Exception: {e}")
            time.sleep(5)
    return ""

s = build_session()
qtpl = "https://www.linkedin.com/jobs/search?keywords={keyword}&location=Vietnam&position=1&pageNum=0&start={start}"
url = qtpl.format(keyword=quote("data engineer"), start=0)
html = get_html(s, url)
if html:
    soup = BeautifulSoup(html, "html.parser")
    links = soup.select("a.base-card__full-link")
    print(f"Found {len(links)} jobs")
else:
    print("HTML is empty")
