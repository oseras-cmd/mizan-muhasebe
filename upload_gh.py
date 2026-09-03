#!/usr/bin/env python3
"""Upload project to GitHub via REST API"""
import json, os, sys, base64, time, urllib.request, urllib.error

TOKEN = os.environ.get("GH_TOKEN", "")
REPO = "oseras-cmd/mizan-muhasebe"
API = f"https://api.github.com/repos/{REPO}"

def api(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_err": True, "code": e.code, "msg": e.read().decode()[:200]}

# Step 1: Get or create initial commit
resp = api("GET", f"{API}/git/ref/heads/main")
parent_sha = None
if resp.get("_err"):
    # Repo is empty - create first file
    print("Empty repo, creating initial file...")
    b64 = base64.b64encode(b"node_modules/\ndist/\nrelease/\n.env\n").decode()
    r = api("PUT", f"{API}/contents/.gitignore", {"message": "init", "content": b64})
    if r.get("_err"):
        print(f"FATAL: {r['msg']}")
        sys.exit(1)
    time.sleep(1)
    resp = api("GET", f"{API}/git/ref/heads/main")
    parent_sha = resp.get("object", {}).get("sha")
    print(f"Initial commit: {parent_sha}")
else:
    parent_sha = resp.get("object", {}).get("sha")
    print(f"Existing branch, commit: {parent_sha}")

# Get tree SHA of parent commit
time.sleep(0.5)
resp = api("GET", f"{API}/git/commits/{parent_sha}")
parent_tree = resp.get("tree", {}).get("sha")
print(f"Parent tree: {parent_tree}")

# Step 2: Collect files
SKIP = {"node_modules","dist","release",".git","isolate",".devcontainer"}
SKIP_F = {"bun.lock","upload_to_github.sh","upload_to_github.py","upload_to_github2.py",
           "vly-toolbar-readonly.tsx","mizan-backup.zip","mizan-github-ready.zip",
           "design-backup-v1.tar.gz","full-backup-20260825-1230.tar.gz","package-lock.json"}
SKIP_E = {".png",".ico",".woff",".woff2",".ttf",".eot",".exe"}

files = []
for root, dirs, fnames in os.walk("."):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for fn in fnames:
        if fn in SKIP_F or os.path.splitext(fn)[1].lower() in SKIP_E:
            continue
        fp = os.path.join(root, fn)
        rel = fp.lstrip("./")
        if os.path.getsize(fp) > 5_000_000:
            print(f"  SKIP: {rel} (too large)")
            continue
        files.append((rel, fp))
files.sort()
print(f"\n{len(files)} files to upload")

# Step 3: Create blobs
entries = []
err_count = 0
for i, (rel, fp) in enumerate(files):
    try:
        with open(fp, "rb") as f:
            cb64 = base64.b64encode(f.read()).decode()
        r = api("POST", f"{API}/git/blobs", {"content": cb64, "encoding": "base64"})
        sha = r.get("sha")
        if sha:
            entries.append({"mode": "100644", "type": "blob", "path": rel, "sha": sha})
        else:
            err_count += 1
            if err_count <= 3:
                print(f"  ERR: {rel} - {r.get('msg','')[:100]}")
    except Exception as e:
        err_count += 1
        if err_count <= 3:
            print(f"  ERR: {rel} - {e}")
    if (i+1) % 20 == 0:
        print(f"  {i+1}/{len(files)} done ({len(entries)} ok, {err_count} err)")

print(f"\nBlobs: {len(entries)} ok, {err_count} errors")

if not entries:
    print("No blobs uploaded, aborting")
    sys.exit(1)

# Step 4: Create tree
print("Creating tree...")
r = api("POST", f"{API}/git/trees", {"base_tree": parent_tree, "tree": entries})
tree_sha = r.get("sha")
if not tree_sha:
    print(f"TREE ERR: {json.dumps(r)[:200]}")
    sys.exit(1)
print(f"Tree: {tree_sha}")

# Step 5: Create commit
print("Creating commit...")
r = api("POST", f"{API}/git/commits", {
    "message": "Mizan v1.0.0 - Bulut Tabanlı Ön Muhasebe Programı",
    "tree": tree_sha,
    "parents": [parent_sha]
})
new_sha = r.get("sha")
if not new_sha:
    print(f"COMMIT ERR: {json.dumps(r)[:200]}")
    sys.exit(1)
print(f"Commit: {new_sha}")

# Step 6: Update ref
r = api("PATCH", f"{API}/git/refs/heads/main", {"sha": new_sha, "force": True})
print(f"Ref: {'ok' if not r.get('_err') else r.get('msg','')}")

print(f"\nhttps://github.com/{REPO}")
