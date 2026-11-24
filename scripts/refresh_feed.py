"""Build data/monie-feed.json for the Monie chat.

Merges the static facts in data/monie-base.json with live pulls (weekly):
  - Indeed Hiring Lab Job Postings Index by state (CC BY 4.0)
  - CDC/NCHS marriage and divorce rates by state (latest year in the PDFs)
  - Census Business Formation Statistics, business applications by state
and a watcher over the article sources (WalletHub, SmartAsset, The Knot ...)
that flags when a page publishes a new edition, so a person can update the Sheet.

Run locally or from the GitHub Action (.github/workflows/refresh-monie.yml).
"""
import csv
import hashlib
import io
import json
import re
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEED = "https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/state_job_postings_us.csv"
NAMES = {
    "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas", "ca": "California", "co": "Colorado",
    "ct": "Connecticut", "de": "Delaware", "dc": "District of Columbia", "fl": "Florida", "ga": "Georgia",
    "hi": "Hawaii", "id": "Idaho", "il": "Illinois", "in": "Indiana", "ia": "Iowa", "ks": "Kansas",
    "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland", "ma": "Massachusetts",
    "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi", "mo": "Missouri", "mt": "Montana",
    "ne": "Nebraska", "nv": "Nevada", "nh": "New Hampshire", "nj": "New Jersey", "nm": "New Mexico",
    "ny": "New York", "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio", "ok": "Oklahoma",
    "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina", "sd": "South Dakota",
    "tn": "Tennessee", "tx": "Texas", "ut": "Utah", "vt": "Vermont", "va": "Virginia", "wa": "Washington",
    "wv": "West Virginia", "wi": "Wisconsin", "wy": "Wyoming",
}


def indeed_live():
    with urllib.request.urlopen(INDEED, timeout=60) as r:
        rows = list(csv.DictReader(io.TextIOWrapper(r, encoding="utf-8")))
    last = max(x["date"] for x in rows)
    ago = (date.fromisoformat(last) - timedelta(days=364)).isoformat()
    cur = {x["state"]: float(x["indeed_job_postings_index"]) for x in rows if x["date"] == last}
    prev = {x["state"]: float(x["indeed_job_postings_index"]) for x in rows if x["date"] == ago}
    states = [
        {"state": NAMES.get(s, s.upper()), "code": s.upper(), "index": round(v, 1),
         "vsYearAgo": round(v - prev[s], 1) if s in prev else None}
        for s, v in sorted(cur.items(), key=lambda kv: -kv[1])
    ]
    return {
        "label": "Job postings vs. Feb 1, 2020 (100 = pre-pandemic level)",
        "asOf": last,
        "source": ["Indeed Hiring Lab Job Postings Index", "https://github.com/hiring-lab/job_postings_tracker"],
        "license": "CC BY 4.0: credit Indeed Hiring Lab",
        "states": states,
    }


UA = {"User-Agent": "Mozilla/5.0 (MoveMe data feed; +https://theindieconsultant.github.io/moveme/)"}
CDC_MARRIAGE = "https://www.cdc.gov/nchs/data/dvs/marriage-divorce/state-marriage-rates-90-95-00-{yy}.pdf"
CDC_DIVORCE = "https://www.cdc.gov/nchs/data/dvs/marriage-divorce/state-divorce-rates-90-95-00-{yy}.pdf"
BFS = "https://www.census.gov/econ/bfs/csv/bfs_monthly.csv"
WATCH = [
    ["dates", "WalletHub: Best Places for Valentine's Day 2026 (LongIsland.com)", "https://www.longisland.com/news/02-04-26/2-in-5-people-say-valentines-day-activities-are-not-affordable-this-year-best-places-for-valentines-day-2026.html"],
    ["singles", "SmartAsset: Where Most People Are Single or Married, 2026", "https://smartasset.com/data-studies/single-married-2026"],
    ["singles", "Time Out: WalletHub best cities for singles 2026", "https://www.timeout.com/usa/news/here-are-the-worst-and-best-cities-for-singles-in-the-u-s-120325"],
    ["married", "The Knot: average wedding cost", "https://www.theknot.com/content/most-expensive-weddings-and-cheapest-weddings"],
    ["married", "Self: wedding costs by state", "https://www.self.inc/info/average-wedding-costs/"],
    ["hiring", "BLS: job openings rates by state, 2025", "https://www.bls.gov/opub/ted/2026/job-openings-rate-5-5-percent-in-georgia-5-4-percent-in-alaska-during-2025.htm"],
    ["business", "KTVU: WalletHub best large cities to start a business 2026", "https://www.ktvu.com/news/best-large-cities-to-start-business-2026"],
    ["fortune500", "Fortune: Texas leads Fortune 500 HQs, 2026", "https://fortune.com/2026/06/03/which-state-has-the-most-fortune-500-companies-texas-2026/"],
    ["business", "LendingTree: business applications study", "https://www.lendingtree.com/business/small/starting-business-study/"],
]


def get(url, timeout=60):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read(), dict(r.headers)


def cdc_rates(tmpl):
    """Return (year, {state: rate or None}) from the newest CDC state table that exists."""
    from pypdf import PdfReader
    this = date.today().year
    for y in range(this, this - 4, -1):
        try:
            raw, _ = get(tmpl.format(yy=str(y)[2:]))
        except Exception:
            continue
        text = "\n".join(pg.extract_text() or "" for pg in PdfReader(io.BytesIO(raw)).pages)
        out = {}
        for name in sorted(set(NAMES.values()), key=len, reverse=True):
            m = re.search(r"(?m)^\s*" + re.escape(name) + r"\s*\d?\s+(---|\d+(?:\.\d+)?)", text)
            if m and name not in out:
                out[name] = None if m.group(1) == "---" else float(m.group(1))
        if len(out) >= 45:
            return y, out
    raise RuntimeError("no CDC table parsed")


def cdc_live():
    my, mar = cdc_rates(CDC_MARRIAGE)
    dy, div = cdc_rates(CDC_DIVORCE)
    rows = [{"state": s, "marriageRate": mar.get(s), "divorceRate": div.get(s)} for s in sorted(mar, key=lambda k: -(mar[k] or 0))]
    return {
        "label": "Marriages and divorces per 1,000 residents (counted in the state where they happen)",
        "asOf": str(my), "divorceYear": str(dy),
        "source": ["CDC/NCHS National Vital Statistics System", "https://www.cdc.gov/nchs/nvss/marriage-divorce.htm"],
        "states": rows,
    }


def bfs_live():
    raw, _ = get(BFS, timeout=120)
    rdr = csv.DictReader(io.StringIO(raw.decode("utf-8", "replace")))
    cols = {c.lower().strip(): c for c in rdr.fieldnames}
    months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    need = ["series", "geo", "year"]
    if not all(k in cols for k in need) or not all(m in cols for m in months):
        raise RuntimeError("unexpected BFS columns: %s" % rdr.fieldnames)
    codes = {k.upper() for k in NAMES} | {"US"}
    data = {}
    for r in rdr:
        if r[cols["series"]].strip().upper() != "BA_BA":
            continue
        if "sa" in cols and r[cols["sa"]].strip().upper() not in ("A", "SA", "Y", "1", "TRUE"):
            continue
        if "naics_sector" in cols and r[cols["naics_sector"]].strip().upper() not in ("TOTAL", ""):
            continue
        geo = r[cols["geo"]].strip().upper()
        if geo not in codes:
            continue
        for i, m in enumerate(months):
            v = r[cols[m]].strip().replace(",", "")
            if v and re.fullmatch(r"\d+(\.\d+)?", v):
                data[(geo, int(r[cols["year"]]), i + 1)] = float(v)
    us = sorted(k for k in data if k[0] == "US")
    if not us:
        raise RuntimeError("no BFS rows matched")
    _, y, m = us[-1]
    states = []
    for code in sorted(codes - {"US"}):
        cur, prev = data.get((code, y, m)), data.get((code, y - 1, m))
        if cur is None:
            continue
        states.append({"state": NAMES[code.lower()], "code": code, "applications": int(cur),
                       "vsYearAgoPct": round((cur / prev - 1) * 100, 1) if prev else None})
    states.sort(key=lambda d: -(d["vsYearAgoPct"] if d["vsYearAgoPct"] is not None else -999))
    return {
        "label": "New business applications, seasonally adjusted (EIN filings)",
        "asOf": "%d-%02d" % (y, m),
        "us": int(data[("US", y, m)]),
        "usVsYearAgoPct": round((data[("US", y, m)] / data[("US", y - 1, m)] - 1) * 100, 1) if ("US", y - 1, m) in data else None,
        "source": ["U.S. Census Bureau, Business Formation Statistics", "https://www.census.gov/econ/bfs/current/index.html"],
        "statesByGrowth": states,
    }


def page_signature(html):
    t = html.decode("utf-8", "replace")
    pick = lambda pat: (re.search(pat, t, re.I | re.S) or [None, ""])[1].strip()
    title = re.sub(r"\s+", " ", pick(r"<title[^>]*>(.*?)</title>"))
    modified = (pick(r'"dateModified"\s*:\s*"([^"]+)"') or pick(r'article:modified_time"\s+content="([^"]+)"')
                or pick(r'"datePublished"\s*:\s*"([^"]+)"'))
    return title, modified


def watch_sources(old):
    prev = {w["url"]: w for w in (old or [])}
    today = date.today().isoformat()
    out = []
    for topic, label, url in WATCH:
        p = prev.get(url, {})
        rec = {"topic": topic, "label": label, "url": url, "checked": today,
               "title": p.get("title"), "modified": p.get("modified"), "sig": p.get("sig"),
               "lastChanged": p.get("lastChanged"), "needsReview": p.get("needsReview", False), "status": None}
        try:
            html, _ = get(url, timeout=45)
            title, modified = page_signature(html)
            sig = hashlib.sha256((title + "|" + modified).encode()).hexdigest()[:16]
            rec["status"] = "ok"
            if p.get("sig") and p["sig"] != sig:
                rec["lastChanged"], rec["needsReview"] = today, True
            rec.update(title=title, modified=modified, sig=sig)
        except Exception as e:
            rec["status"] = "unreachable: %s" % type(e).__name__
        out.append(rec)
    return out


def fmt_list(items):
    return ", ".join(items[:-1]) + " and " + items[-1] if len(items) > 1 else "".join(items)


def says_now(feed):
    """Turn live blocks into ready-to-say lines for the chat (saysNow), keeping the static 'says' as backup."""
    t = feed["topics"]
    h = t["hiring"].get("live")
    if h and h.get("states"):
        top = ["%s (%s)" % (x["state"], x["index"]) for x in h["states"][:3]]
        low = ["%s (%s)" % (x["state"], x["index"]) for x in h["states"][-3:]]
        t["hiring"]["saysNow"] = ("Right now job postings are furthest above their pre-pandemic level in %s, where 100 = Feb 2020. "
                                  "They're weakest in %s. (Indeed Hiring Lab, week of %s.)" % (fmt_list(top), fmt_list(low), h["asOf"]))
    m = t["married"].get("live")
    if m and m.get("states"):
        top = ["%s (%s)" % (x["state"], x["marriageRate"]) for x in m["states"][:5] if x["marriageRate"]]
        t["married"]["saysNow"] = (t["married"]["says"] + " Most weddings per 1,000 residents in %s: %s (CDC)." % (m["asOf"], fmt_list(top)))
        div = sorted([x for x in m["states"] if x["divorceRate"]], key=lambda x: x["divorceRate"])[:5]
        t["family"]["saysNow"] = (t["family"]["says"] + " Lowest divorce rates in %s: %s per 1,000 residents (CDC)."
                                  % (m["divorceYear"], fmt_list(["%s (%s)" % (x["state"], x["divorceRate"]) for x in div])))
    b = t["business"].get("live")
    if b and b.get("statesByGrowth"):
        fast = ["%s (+%s%%)" % (x["state"], x["vsYearAgoPct"]) for x in b["statesByGrowth"][:3] if x["vsYearAgoPct"] is not None]
        yo = b.get("usVsYearAgoPct")
        t["business"]["saysNow"] = (t["business"]["says"] + " Latest month (%s): %s U.S. business applications%s. Fastest growth vs. a year ago: %s (Census)."
                                    % (b["asOf"], format(b["us"], ","), "" if yo is None else " (%+.1f%% vs. a year ago)" % yo, fmt_list(fast)))
    for k, v in t.items():
        v.setdefault("saysNow", v.get("says"))


def main():
    feed = json.loads((ROOT / "data" / "monie-base.json").read_text())
    try:
        feed["topics"]["hiring"]["live"] = indeed_live()
    except Exception as e:  # keep the last good live block if a pull fails
        old = ROOT / "data" / "monie-feed.json"
        if old.exists():
            feed["topics"]["hiring"]["live"] = json.loads(old.read_text())["topics"]["hiring"].get("live")
        print("Indeed pull failed:", e)
    old_feed = {}
    old = ROOT / "data" / "monie-feed.json"
    if old.exists():
        old_feed = json.loads(old.read_text())
    for topic, key, fn in [("married", "live", cdc_live), ("business", "live", bfs_live)]:
        try:
            feed["topics"][topic][key] = fn()
        except Exception as e:
            feed["topics"][topic][key] = old_feed.get("topics", {}).get(topic, {}).get(key)
            print(topic, "pull failed:", e)
    feed["topics"]["family"]["live"] = {"see": "married.live (divorce rates)"}
    feed["sourceWatch"] = watch_sources(old_feed.get("sourceWatch"))
    flagged = [w for w in feed["sourceWatch"] if w["needsReview"] and w["lastChanged"] == date.today().isoformat()]
    if flagged:
        (ROOT / "changed_sources.md").write_text(
            "These Monie sources published something new this week. Update the matching Monie tab in the Sheet, "
            "then set `needsReview` to false in data/monie-feed.json.\n\n"
            + "\n".join("- **%s** (%s): [%s](%s)" % (w["topic"], w["title"] or "", w["label"], w["url"]) for w in flagged) + "\n")
    says_now(feed)
    feed["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (ROOT / "data" / "monie-feed.json").write_text(json.dumps(feed, ensure_ascii=False, indent=1) + "\n")
    print("wrote data/monie-feed.json")


if __name__ == "__main__":
    main()
