# A no-JavaScript click-through: reads the page HTML, finds a server-action form, posts it like a browser would.
import re, sys, os, html, json, urllib.request, urllib.parse, http.cookiejar, uuid
BASE = os.environ.get("CLICK_BASE", "http://localhost:3100")
import os, tempfile
jar = http.cookiejar.MozillaCookieJar(os.environ.get("CLICK_COOKIES", os.path.join(tempfile.gettempdir(), "dataroom-click-cookies.txt")))
try: jar.load(ignore_discard=True, ignore_expires=True)
except Exception: pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)

def get(path):
    try: r = opener.open(BASE + path)
    except urllib.error.HTTPError as e: r = e
    body = r.read().decode("utf-8", "replace"); jar.save(ignore_discard=True, ignore_expires=True)
    return r.status, body, r.headers.get("Location")

def forms(body):
    out = []
    for m in re.finditer(r"<form([^>]*)>(.*?)</form>", body, re.S):
        attrs, inner = m.group(1), m.group(2)
        fields = {}
        for i in re.finditer(r"<input([^>]*)/?>", inner):
            a = i.group(1)
            n = re.search(r'name="([^"]*)"', a); v = re.search(r'value="([^"]*)"', a)
            if n and "type=\"file\"" not in a: fields[html.unescape(n.group(1))] = html.unescape(v.group(1)) if v else ""
        text = re.sub(r"<[^>]+>", " ", inner); text = re.sub(r"\s+", " ", html.unescape(text)).strip()
        out.append((fields, text))
    return out

def submit(path, match, extra=None, files=None):
    st, body, _ = get(path)
    cand = [f for f in forms(body) if match in f[1]]
    if not cand: raise SystemExit(f"no form matching {match!r} on {path}: {[f[1][:60] for f in forms(body)]}")
    fields = dict(cand[0][0]); fields.update(extra or {})
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        vals = v if isinstance(v, list) else [v]
        for vv in vals: parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{vv}\r\n'.encode())
    for k, (name, data) in (files or {}).items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE + path, data=b"".join(parts), method="POST", headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try: r = opener.open(req)
    except urllib.error.HTTPError as e: r = e
    out = r.read().decode("utf-8", "replace"); jar.save(ignore_discard=True, ignore_expires=True)
    return r.status, r.headers.get("Location") or r.headers.get("x-action-redirect"), out

def text(body):
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S); body = re.sub(r"<style.*?</style>", " ", body, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body))).strip()
