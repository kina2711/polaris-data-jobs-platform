import random
import re
import time
from curl_cffi import requests as cffi_requests

def build_session(headers: dict = None) -> cffi_requests.Session:
    s = cffi_requests.Session(impersonate="chrome")
    if headers:
        s.headers.update(headers)
    return s

def smart_sleep(min_s=2.0, max_s=5.0):
    time.sleep(random.uniform(min_s, max_s))

def get_html(session, url: str, timeout: int = 30) -> str:
    for attempt in range(1, 4):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code in [429, 999]:
                wait = 10 * attempt + random.uniform(2.0, 5.0)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.text
        except Exception:
            time.sleep(5)
    return ""

def extract_text(el) -> str:
    if not el:
        return ""
    t = el.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", t) if t else ""
