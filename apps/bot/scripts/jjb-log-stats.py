"""Reply-shape stats for jjb from a DiscordChatExporter HTML export.

Usage: python -I scripts/jjb-log-stats.py <export.html> [more exports...]

Prints, per day: replies, median words, % of 4 words or fewer, % opening "X. Y",
% ending in "?", % with any reaction, and how often each crutch phrase came up.
Baselines and targets are in apps/bot/docs/jjb-personality-review-2.md.
"""

import html
import re
import sys
from collections import defaultdict
from datetime import datetime

BOT_ID = "1465304830011637811"

# Keep in step with CRUTCH_PHRASES in src/modules/reply-log.ts.
CRUTCH_PHRASES = [
    "oh ur alive", "load bearing", "noted", "what do u want", "dont get used to it",
    "thin ice", "im stealing", "that cat is", "has seen things", "judging", "war crime",
    "crime", "professionally lazy", "snack", "mango", "dumpling", "hand it over", "legally",
]


def strip_tags(fragment):
    fragment = re.sub(r'<img[^>]*alt="?([^" >]*)"?[^>]*>', r"\1", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).strip()


def bot_messages(path):
    data = open(path, encoding="utf-8").read()
    author = None
    for part in data.split("<div id=chatlog__message-container-")[1:]:
        found = re.search(r"class=chatlog__author[^>]*data-user-id=(\d+)>", part)
        if found:
            author = found.group(1)
        if author != BOT_ID:
            continue
        stamp = re.search(r'chatlog__(?:short-)?timestamp title="([^"]+)"', part)
        body = re.search(
            r'<div class="chatlog__content chatlog__markdown">(.*?)</div>(?:<div class=chatlog__|</div></div>)',
            part,
            re.S,
        )
        if not stamp or not body:
            continue
        text = re.sub(r"\(edited\)$", "", strip_tags(body.group(1))).strip()
        # Wordle and slash-command output are multi-line blocks, not chat.
        if not text or (len(text) > 120 and text.count("\n") >= 2):
            continue
        day = datetime.strptime(stamp.group(1).split(", ", 1)[1], "%B %d, %Y %I:%M %p").date()
        reacted = "chatlog__reaction" in part
        yield day, text, reacted


def normalise(text):
    return " " + re.sub(r"[^a-z0-9]+", " ", text.lower()).strip() + " "


def main(paths):
    days = defaultdict(list)
    for path in paths:
        for day, text, reacted in bot_messages(path):
            days[day].append((text, reacted))
    print("day         n  medW  <=4w  X.Y   ?end  react  crutches")
    for day in sorted(days):
        rows = days[day]
        n = len(rows)
        words = sorted(len(text.split()) for text, _ in rows)
        short = sum(1 for w in words if w <= 4)
        two_beat = sum(1 for text, _ in rows if re.match(r"^[^.?!]{1,60}\.\s+\S", text))
        question = sum(1 for text, _ in rows if text.rstrip().rstrip(")").endswith("?"))
        reacted = sum(1 for _, r in rows if r)
        crutches = {
            phrase: count
            for phrase in CRUTCH_PHRASES
            if (count := sum(1 for text, _ in rows if f" {phrase} " in normalise(text)))
        }
        pct = lambda k: f"{100 * k / n:4.0f}%"
        top = ", ".join(f"{p}:{c}" for p, c in sorted(crutches.items(), key=lambda x: -x[1])[:4])
        print(f"{day}  {n:3d}  {words[n // 2]:4d}  {pct(short)} {pct(two_beat)} {pct(question)} {pct(reacted)}  {top}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
