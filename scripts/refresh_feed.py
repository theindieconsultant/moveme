"""Build data/monie-feed.json for the Monie chat.

Merges the static facts in data/monie-base.json with live pulls:
  - Indeed Hiring Lab Job Postings Index by state (weekly, CC BY 4.0)

Run locally or from the GitHub Action (.github/workflows/refresh-monie.yml).
"""
import csv
import io
import json
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


def main():
    feed = json.loads((ROOT / "data" / "monie-base.json").read_text())
    try:
        feed["topics"]["hiring"]["live"] = indeed_live()
    except Exception as e:  # keep the last good live block if a pull fails
        old = ROOT / "data" / "monie-feed.json"
        if old.exists():
            feed["topics"]["hiring"]["live"] = json.loads(old.read_text())["topics"]["hiring"].get("live")
        print("Indeed pull failed:", e)
    feed["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (ROOT / "data" / "monie-feed.json").write_text(json.dumps(feed, ensure_ascii=False, indent=1) + "\n")
    print("wrote data/monie-feed.json")


if __name__ == "__main__":
    main()
