"""List Instantly inboxes that are not attached to any campaign.

Usage:
    INSTANTLY_API_KEY=your_key python3 instantly_unassigned_inboxes.py

Uses the Instantly API v2. Only reads data. Changes nothing.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = "https://api.instantly.ai/api/v2"
KEY = os.environ.get("INSTANTLY_API_KEY", "proxy-injected")


def get_all(path, params=None):
    """Fetch every page of a list endpoint."""
    items, cursor = [], None
    while True:
        q = dict(params or {}, limit=100)
        if cursor:
            q["starting_after"] = cursor
        req = urllib.request.Request(
            f"{BASE}{path}?{urllib.parse.urlencode(q)}",
            headers={"Authorization": f"Bearer {KEY}"},
        )
        with urllib.request.urlopen(req) as r:
            data = json.load(r)
        items += data.get("items", [])
        cursor = data.get("next_starting_after")
        if not cursor:
            return items


def main():
    accounts = get_all("/accounts")
    campaigns = get_all("/campaigns")

    used = {}
    for c in campaigns:
        for email in c.get("email_list") or []:
            used.setdefault(email.lower(), []).append(c.get("name", "?"))

    free = [a for a in accounts if a["email"].lower() not in used]

    print(f"Inboxes: {len(accounts)}  Campaigns: {len(campaigns)}")
    print(f"Not attached to any campaign: {len(free)}\n")
    for a in sorted(free, key=lambda a: a["email"]):
        warm = "warmup on" if a.get("warmup_status") == 1 else "warmup off"
        print(f"  {a['email']:<45} {warm}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        sys.exit(f"API error {e.code}: {e.read().decode()[:300]}")
