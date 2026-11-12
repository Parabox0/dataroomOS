# End-to-end check of a running Dataroom OS, with no browser.
# Usage: CLICK_BASE=http://localhost:3100 python3 scripts/e2e.py
# Walks the main paths: public pages, the sample room, sign-up, a new room with an upload,
# Ask, Check the room, a person's link opened as that person, and signing in again.
import os, re, sys, time, uuid, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("CLICK_COOKIES", os.path.join(tempfile.mkdtemp(), "cookies.txt"))
import click
from click import get, submit, forms, text, BASE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
failures = []

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok: failures.append(name)

def room_from(loc):
    m = re.search(r"/rooms/([a-z0-9]+)", loc or "")
    return m.group(1) if m else None

# 1. Public pages
for p in ["/sign-in", "/sign-up"]:
    st, body, _ = get(p)
    check(f"page {p} loads", st == 200, st)
st, body, _ = get("/")
check("home sends you to sign in", st in (302, 303, 307) or "Sign in" in text(body), st)

# 2. The sample room
click.jar.clear()
st, loc, out = submit("/sign-in", "Open the sample room")
sample = room_from(loc)
check("sample room opens", bool(sample), f"{st} {loc}")
if sample:
    R = f"/rooms/{sample}"
    for p in ["/checklist", "/documents", "/ask", "/check", "/questions", "/people", "/history"]:
        st, body, _ = get(R + p)
        check(f"sample {p} loads", st == 200, st)
    st, body, _ = get(R + "/documents")
    check("sample room lists its files", "Pitch deck" in text(body))
    st, body, _ = get(R + "/people")
    check("sample people have summaries", "Read for" in text(body))

# 3. Sign up, with a short password refused first
click.jar.clear()
email = f"e2e-{uuid.uuid4().hex[:8]}@test.example"
pw = "e2e-" + uuid.uuid4().hex[:12]
st, loc, out = submit("/sign-up", "Create account", {"name": "Test Founder", "email": email, "password": "short"})
check("short password refused", "8 characters" in out)
st, loc, out = submit("/sign-up", "Create account", {"name": "Test Founder", "email": email, "password": pw})
check("sign-up works", st in (200, 303) and bool(loc), f"{st} {loc}")

# 4. A new room with an upload
st, loc, out = submit("/rooms?new=1", "Create room", {"company": "Acme Test", "name": "Seed", "purpose": "sell"})
NR = room_from(loc)
check("new room created", bool(NR), f"{st} {loc}")
if NR:
    R = f"/rooms/{NR}"
    pdf = open(os.path.join(ROOT, "seed", "files", "brightloaf-financial-summary.pdf"), "rb").read()
    st, loc, out = submit(R + "/documents", "Add file", {"folderId": "auto"}, files={"files": ("acme financial summary.pdf", pdf)})
    check("PDF upload works", "Added" in out or "went to" in out or st in (200, 303), st)
    check("Sort for me filed it in Financials", "went to Financials" in text(out), text(out)[:200])
    st, loc, out = submit(R + "/documents", "Add file", {}, files={"files": ("notes.pdf", b"not a pdf")})
    check("non-PDF upload refused", "Couldn" in out)
    st, body, _ = get(R + "/documents")
    check("upload is listed", "Acme financial summary" in text(body) or "acme financial summary" in text(body).lower())
    doc = re.search(rf"/rooms/{NR}/documents/([a-z0-9]+)", body)
    check("upload has its own page", bool(doc))
    if doc:
        st, b, _ = get(f"/rooms/{NR}/documents/{doc.group(1)}")
        check("file page loads", st == 200, st)
        img = re.search(r'src="(/api/pages/[^"]+)"', b)
        if img:
            r = click.opener.open(BASE + img.group(1).replace("&amp;", "&"))
            check("page image renders", r.status == 200 and len(r.read()) > 1000, r.status)
    st, body, _ = get(R + "/checklist?view=done")
    check("checklist ticked itself", "Financial" in text(body))
    # Ask
    st, loc, out = submit(R + "/ask", "Ask", {"q": "What is the runway?"})
    st, body, _ = get(loc) if loc else (st, out, None)
    check("Ask answers with a source", st == 200 and "page 1" in text(body), st)
    # Check the room
    st, loc, out = submit(R + "/check", "Check")
    st, body, _ = get(R + "/check")
    check("Check the room runs", st == 200 and ("Add " in text(body) or "Nothing to fix" in text(body)), st)
    # A person's link, opened as that person
    st, loc, out = submit(R + "/people", "Make link", {"kind": "person", "name": "Test Investor", "email": "ti@fund.example", "company": "Test Fund"})
    check("person link made", bool(loc), f"{st} {loc}")
    if loc:
        st, b, _ = get(loc.split("?")[0])
        slug = re.search(r"/r/([A-Za-z0-9]{16,})", b)
        check("person page shows their link", bool(slug))
        if slug:
            owner_cookies = list(click.jar)
            click.jar.clear()
            st, loc2, out2 = submit("/r/" + slug.group(1), "Open the room", {"email": "ti@fund.example"})
            st, b, _ = get("/r/" + slug.group(1))
            check("viewer can open the room", st == 200 and "Acme" in text(b), st)
            for c in owner_cookies: click.jar.set_cookie(c)

    # The short room address
    st, loc, out = submit(R + "/people", "Turn on")
    check("room address turned on", bool(loc), f"{st} {loc}")
    st, b, _ = get(R + "/people")
    check("people page shows the room address", "/acme-test" in text(b), text(b)[:300])
    owner_cookies = list(click.jar)
    click.jar.clear()
    st, b, _ = get("/acme-test")
    check("room address opens the room", st == 200 and "Acme Test" in text(b), st)
    for c in owner_cookies: click.jar.set_cookie(c)

click.jar.clear()
st, b, _ = get("/brightloaf")
check("sample room address opens", st == 200 and "Brightloaf" in text(b), st)
st, b, _ = get("/no-such-room-here")
check("unknown address is a 404", st == 404, st)

# 5. Sign in again with the new account
click.jar.clear()
st, loc, out = submit("/sign-in", "Sign in", {"email": email, "password": "wrong-password"})
check("wrong password refused", "match" in out)
st, loc, out = submit("/sign-in", "Sign in", {"email": email, "password": pw})
check("sign-in works", bool(loc) and "/rooms" in loc, f"{st} {loc}")

print(f"\n{len(failures)} failed" if failures else "\nAll checks passed")
sys.exit(1 if failures else 0)
