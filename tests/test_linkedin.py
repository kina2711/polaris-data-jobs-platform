from curl_cffi import requests

s = requests.Session(impersonate="chrome110")
# LinkedIn public search page
r = s.get(
    "https://www.linkedin.com/jobs/search?keywords=data%20analyst&location=Vietnam"
)
print(r.status_code)
print(r.text[:500])
