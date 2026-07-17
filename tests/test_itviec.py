from curl_cffi import requests

s = requests.Session(impersonate="chrome110")
r = s.get("https://itviec.com/it-jobs/data-analyst")
print(r.status_code)
print(r.text[:500])
