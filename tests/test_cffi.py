from curl_cffi import requests

r = requests.get(
    "https://www.topcv.vn/tim-viec-lam-data-analyst?type_keyword=1&page=1&sba=1",
    impersonate="chrome",
)
print(r.status_code)
