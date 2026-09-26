import re, json, sys

pattern = re.compile(r"CHAPTER[ \t]+(\d+)[ \t]+([A-Z][A-Z'’-]*(?:[ \t]+[A-Z][A-Z'’-]*)*)\b")
chapters, current = [], None

with open(sys.argv[1], encoding="utf-8") as f:
    for line in f:
        if m := pattern.match(line.strip()):
            current = {"chapter": int(m[1]), "title": m[2], "text": ""}
            chapters.append(current)
            line = line.strip()[m.end():]  # keep any text after the title on the same line
        if current:
            current["text"] += line

for ch in chapters:
    ch["text"] = ch["text"].strip()

with open('output.json', 'w+', encoding='utf-8') as f:
    f.write(json.dumps({"chapters": chapters}, indent=2, ensure_ascii=False))