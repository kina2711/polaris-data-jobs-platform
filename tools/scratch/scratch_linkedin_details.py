import re
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "keep-alive",
}

def extract_text(el) -> str:
    if not el: return ""
    t = el.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", t) if t else ""

s = cffi_requests.Session(impersonate="chrome")
s.headers.update(HEADERS)

# Test job url
url = "https://vn.linkedin.com/jobs/view/senior-data-engineer-at-trustonic-4389730562"
r = s.get(url)
print(f"Status Code: {r.status_code}")
html = r.text

soup = BeautifulSoup(html, "html.parser")
title = extract_text(soup.select_one("h1.top-card-layout__title"))
company = extract_text(soup.select_one("a.topcard__org-name-link"))
location = extract_text(soup.select_one("span.topcard__flavor--bullet"))
description = extract_text(soup.select_one("div.description__text, div.show-more-less-html__markup"))

print(f"TITLE: {title}")
print(f"COMPANY: {company}")
print(f"LOCATION: {location}")
print(f"DESCRIPTION LEN: {len(description)}")
