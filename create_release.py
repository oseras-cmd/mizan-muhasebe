#!/usr/bin/env python3
"""Create GitHub Release with EXE attachment"""
import json, os, sys, urllib.request, urllib.error

TOKEN = os.environ.get("GH_TOKEN", "")
REPO = "oseras-cmd/mizan-muhasebe"
API = f"https://api.github.com/repos/{REPO}"
EXE_PATH = "release/Mizan-Portable-1.0.0.exe"

def api(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_err": True, "code": e.code, "msg": e.read().decode()[:300]}

# Step 1: Create release
print("Creating release v1.0.0...")
r = api("POST", f"{API}/releases", {
    "tag_name": "v1.0.0",
    "name": "Mizan v1.0.0",
    "body": "Mizan - Bulut Tabanli On Muhasebe Programi\n\nOzellikler:\n- Dashboard, Odemeler, Kasa/Banka, Rapor\n- Doviz kuru destegi (TRY/USD/EUR)\n- Bildirim sistemi\n- Filtreleme ve raporlama\n- Electron EXE destegi\n\nKurulum:\n1. Mizan-Portable-1.0.0.exe dosyasini indirin\n2. Calistirin",
    "draft": False,
    "prerelease": False
})
if r.get("_err"):
    print(f"Release error: {r['msg']}")
    sys.exit(1)

upload_url = r.get("upload_url", "").replace("{?name,label}", "")
release_url = r.get("html_url", "")
print(f"Release created: {release_url}")

# Step 2: Upload EXE asset
if not os.path.exists(EXE_PATH):
    print(f"EXE not found at {EXE_PATH}")
    sys.exit(1)

exe_size = os.path.getsize(EXE_PATH)
print(f"Uploading EXE ({exe_size / 1024 / 1024:.1f} MB)...")

url = f"{upload_url}?name=Mizan-Portable-1.0.0.exe"
with open(EXE_PATH, "rb") as f:
    data = f.read()

req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"token {TOKEN}")
req.add_header("Content-Type", "application/octet-stream")
req.add_header("Content-Length", str(len(data)))

try:
    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read())
        print(f"Uploaded! URL: {result.get('browser_download_url', 'ok')}")
except urllib.error.HTTPError as e:
    print(f"Upload error: {e.code} - {e.read().decode()[:200]}")

print(f"\nRelease page: {release_url}")
