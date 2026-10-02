import os
import json
import uuid
import datetime
import html
import re
import zipfile
import bs4
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters", "mo-dao-zu-shi")
GLOSSARY_FILE = os.path.join(DATA_DIR, "glossary", "mo-dao-zu-shi.json")
OUTPUT_EPUB = os.path.join(BASE_DIR, "Mo_Dao_Zu_Shi_Chapters_1-113.epub")

BOOK_TITLE = "Mo Dao Zu Shi (Grandmaster of Demonic Cultivation)"
BOOK_AUTHOR = "Mo Xiang Tong Xiu"
BOOK_LANGUAGE = "en"
BOOK_UUID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "modaozushi.library.translation"))
MODIFIED_TIME = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def clean_chapter_content(raw_html: str) -> list:
    """Extracts and normalizes paragraphs from raw chapter HTML into clean strings."""
    if not raw_html:
        return []
    
    # 1. Unescape HTML entities into real unicode
    raw = html.unescape(raw_html)
    soup = bs4.BeautifulSoup(raw, "html.parser")
    
    # 2. Decompose scripts, styles, font tags
    for tag in soup(["script", "style", "font"]):
        tag.decompose()
        
    # 3. Strip tracking and app-specific attributes
    for tag in soup.find_all(True):
        allowed = ["href", "src", "alt", "class"]
        attrs_to_remove = [k for k in tag.attrs if k not in allowed]
        for k in attrs_to_remove:
            del tag[k]
        if "class" in tag.attrs and isinstance(tag["class"], list):
            tag["class"] = [c for c in tag["class"] if not c.startswith("_ng") and not c.startswith("char-tag")]
            if not tag["class"]:
                del tag["class"]

    # 4. Extract paragraphs
    paragraphs = []
    p_tags = soup.find_all("p")
    if len(p_tags) >= 5:
        for p in p_tags:
            t = p.get_text(strip=True)
            if t:
                paragraphs.append(p)
    else:
        # Check leaf divs
        divs = soup.find_all("div")
        for div in divs:
            if not div.find("div"):
                t = div.get_text(strip=True)
                if t:
                    div.name = "p"
                    paragraphs.append(div)
        if len(paragraphs) < 5:
            # Fallback: split on br
            parts = re.split(r"<br\s*/?>", soup.decode_contents())
            for part in parts:
                s = bs4.BeautifulSoup(part, "html.parser")
                t = s.get_text(strip=True)
                if t:
                    p = soup.new_tag("p")
                    p.string = t
                    paragraphs.append(p)
                    
    # Format each paragraph cleanly with minimal escaping
    clean_p_strings = []
    for p in paragraphs:
        rendered = p.decode(formatter="minimal").strip()
        if rendered:
            clean_p_strings.append(rendered)
            
    return clean_p_strings

def build_style_css() -> str:
    return """@charset "utf-8";

@page {
  margin: 1.5em 1em;
}

body {
  font-family: "Georgia", "Palatino", "Charis SIL", serif;
  line-height: 1.7;
  color: #1a1a1a;
  background-color: #ffffff;
  margin: 0;
  padding: 0 4%;
  text-align: justify;
}

/* Title Page */
.titlepage {
  text-align: center;
  margin-top: 18vh;
  margin-bottom: 5vh;
}

.book-title {
  font-size: 2.2em;
  font-weight: 700;
  margin-bottom: 0.3em;
  line-height: 1.25;
  color: #1b3628;
}

.book-subtitle {
  font-size: 1.2em;
  font-style: italic;
  color: #4a5568;
  margin-top: 0.4em;
  margin-bottom: 2em;
}

.book-author {
  font-size: 1.15em;
  font-weight: 600;
  margin-bottom: 0.5em;
  color: #2d3748;
}

.book-meta {
  font-size: 0.95em;
  color: #718096;
  margin-top: 4em;
}

.titlepage-divider {
  width: 60px;
  height: 2px;
  background-color: #5c8672;
  margin: 2em auto;
}

/* Chapter Headers */
.chapter-header {
  text-align: center;
  margin-top: 3.5em;
  margin-bottom: 2.5em;
}

.chapter-number {
  font-size: 0.85em;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #5c8672;
  font-weight: 700;
  margin-bottom: 0.4em;
  text-indent: 0 !important;
  text-align: center;
}

.chapter-title {
  font-size: 1.6em;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
  line-height: 1.3;
  text-indent: 0 !important;
  text-align: center;
}

.chapter-divider {
  width: 40px;
  height: 2px;
  background-color: #5c8672;
  margin: 1.2em auto 0 auto;
}

/* Paragraphs */
p {
  margin-top: 0;
  margin-bottom: 0;
  text-indent: 1.5em;
  line-height: 1.7;
}

.chapter-header + p,
p:first-of-type,
hr + p,
.scene-break + p {
  text-indent: 0;
}

em, i {
  font-style: italic;
}

strong, b {
  font-weight: bold;
}

blockquote {
  margin: 1em 2em;
  padding-left: 1em;
  border-left: 3px solid #cbd5e0;
  font-style: italic;
  color: #4a5568;
}

.scene-break {
  text-align: center;
  margin: 2em 0;
  font-size: 1.1em;
  letter-spacing: 0.3em;
  color: #718096;
  text-indent: 0 !important;
}

/* Translator Notes */
.translator-notes {
  margin-top: 2.5em;
  padding: 1.2em;
  background-color: #f7fafc;
  border-left: 4px solid #5c8672;
  border-radius: 4px;
  font-size: 0.9em;
  line-height: 1.5;
}

/* Table of Contents */
nav ol {
  list-style-type: none;
  padding-left: 0;
}

nav li {
  margin-bottom: 0.7em;
  padding-bottom: 0.3em;
  border-bottom: 1px dotted #e2e8f0;
}

nav a {
  text-decoration: none;
  color: #2d3748;
}

/* Glossary Appendix */
.glossary-cat-title {
  font-size: 1.3em;
  color: #1b3628;
  border-bottom: 2px solid #5c8672;
  padding-bottom: 0.3em;
  margin-top: 2em;
  text-indent: 0;
}

.glossary-entry {
  margin-bottom: 1.2em;
  padding-bottom: 0.8em;
  border-bottom: 1px solid #edf2f7;
}

.glossary-term {
  font-size: 1.1em;
  font-weight: bold;
  color: #2d3748;
  text-indent: 0;
}

.glossary-pinyin {
  font-style: italic;
  color: #718096;
  margin-left: 0.5em;
}

.glossary-meta {
  font-size: 0.9em;
  color: #4a5568;
  text-indent: 0;
  margin-top: 0.2em;
}

.glossary-summary {
  font-size: 0.95em;
  color: #2d3748;
  margin-top: 0.3em;
  text-indent: 0;
}
"""

def generate_epub():
    print("Beginning EPUB generation for Mo Dao Zu Shi (Prologue to Ch 113)...")
    
    # 1. Gather chapters 1 to 113
    chapters = []
    for i in range(1, 114):
        p = os.path.join(CHAPTERS_DIR, f"{i}.json")
        if not os.path.exists(p):
            raise FileNotFoundError(f"Missing chapter file: {p}")
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            chapters.append({
                "index": i,
                "chapter_number": data.get("chapter_number", i),
                "title": data.get("title", f"Chapter {i}").strip(),
                "content": data.get("content", ""),
                "word_count": data.get("word_count", 0)
            })

    total_words = sum(c["word_count"] for c in chapters)
    print(f"Loaded {len(chapters)} chapters ({total_words:,} words).")

    # 2. Gather Glossary for Appendix
    glossary = []
    if os.path.exists(GLOSSARY_FILE):
        with open(GLOSSARY_FILE, "r", encoding="utf-8") as f:
            glossary = json.load(f)
    print(f"Loaded {len(glossary)} glossary entries for Appendix.")

    # 3. Create Title Page XHTML
    titlepage_html = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{html.escape(BOOK_TITLE)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <div class="titlepage">
    <h1 class="book-title">Mo Dao Zu Shi</h1>
    <h2 class="book-subtitle">Grandmaster of Demonic Cultivation<br />(魔道祖师)</h2>
    <div class="titlepage-divider"></div>
    <p class="book-author">By {html.escape(BOOK_AUTHOR)}</p>
    <p class="book-meta">Translated Edition<br />Chapters 1–113 (Prologue to Main Story Finale)<br />Total Words: {total_words:,}</p>
  </div>
</body>
</html>"""

    # 4. Generate Chapter XHTML files
    chapter_files = []
    for c in chapters:
        i = c["index"]
        ch_num = c["chapter_number"]
        raw_title = c["title"]
        clean_title = html.escape(raw_title)
        
        # Format chapter header
        if i == 1 and raw_title.lower() == "prologue":
            header_html = f"""<div class="chapter-header">
  <h1 class="chapter-title">Prologue</h1>
  <div class="chapter-divider"></div>
</div>"""
            toc_label = "Prologue"
        else:
            header_html = f"""<div class="chapter-header">
  <p class="chapter-number">Chapter {ch_num}</p>
  <h1 class="chapter-title">{clean_title}</h1>
  <div class="chapter-divider"></div>
</div>"""
            toc_label = f"Chapter {ch_num}: {raw_title}"

        paragraphs = clean_chapter_content(c["content"])
        body_content = "\n".join(paragraphs)

        ch_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>{clean_title}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
{header_html}
<div class="chapter-body">
{body_content}
</div>
</body>
</html>"""
        # Validate XML with ElementTree
        try:
            test_xml = ch_xhtml.split("<!DOCTYPE html>")[1].strip()
            ET.fromstring(test_xml)
        except Exception as err:
            raise ValueError(f"XML Validation Error in Chapter {i} ({clean_title}): {err}")

        filename = f"chapter_{i:03d}.xhtml"
        chapter_files.append({
            "id": f"ch_{i:03d}",
            "filename": filename,
            "toc_label": toc_label,
            "content": ch_xhtml
        })

    # 5. Generate Appendix Glossary XHTML
    glossary_by_cat = {}
    cat_order = ["Character", "Weapon / Item", "Clan / Sect", "Location / Realm", "Concept / Lore"]
    for cat in cat_order:
        glossary_by_cat[cat] = []

    for entry in glossary:
        c = entry.get("category", "Character")
        if c not in glossary_by_cat:
            glossary_by_cat[c] = []
        glossary_by_cat[c].append(entry)

    glossary_sections = []
    cat_labels = {
        "Character": "Characters & Figures",
        "Weapon / Item": "Weapons, Artifacts & Items",
        "Clan / Sect": "Clans & Cultivation Sects",
        "Location / Realm": "Locations, Towns & Realms",
        "Concept / Lore": "Cultivation Concepts & Lore"
    }

    for cat in cat_order:
        items = glossary_by_cat.get(cat, [])
        if not items:
            continue
        items.sort(key=lambda x: x.get("name", "").lower())
        cat_html = [f'<h2 class="glossary-cat-title">{html.escape(cat_labels.get(cat, cat))} ({len(items)})</h2>']
        for item in items:
            name = html.escape(item.get("name", ""))
            pinyin = html.escape(item.get("pinyin_or_chinese", ""))
            pinyin_span = f'<span class="glossary-pinyin">({pinyin})</span>' if pinyin else ""
            
            meta_parts = []
            affil = item.get("affiliation") or item.get("sect_or_affiliation")
            if affil:
                meta_parts.append(f'<strong>Affiliation:</strong> {html.escape(affil)}')
            aliases = [a for a in item.get("aliases", []) if a and a.lower() != item.get("name", "").lower()]
            if aliases:
                meta_parts.append(f'<strong>Aliases:</strong> {html.escape(", ".join(aliases[:6]))}')
            
            meta_html = f'<p class="glossary-meta">{" | ".join(meta_parts)}</p>' if meta_parts else ""
            summary = html.escape(item.get("summary", ""))
            summary_html = f'<p class="glossary-summary">{summary}</p>' if summary else ""
            
            cat_html.append(f"""<div class="glossary-entry">
  <p class="glossary-term">{name} {pinyin_span}</p>
  {meta_html}
  {summary_html}
</div>""")
        glossary_sections.append("\n".join(cat_html))

    glossary_body = "\n".join(glossary_sections)
    glossary_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>Appendix: Novel Glossary</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
<div class="chapter-header">
  <p class="chapter-number">Appendix</p>
  <h1 class="chapter-title">Novel Glossary</h1>
  <div class="chapter-divider"></div>
</div>
<div class="chapter-body">
{glossary_body}
</div>
</body>
</html>"""
    ET.fromstring(glossary_xhtml.split("<!DOCTYPE html>")[1].strip())

    # 6. Generate EPUB 3 Navigation Document (nav.xhtml)
    nav_li_items = ['<li><a href="titlepage.xhtml">Title Page</a></li>']
    for cf in chapter_files:
        nav_li_items.append(f'<li><a href="{cf["filename"]}">{html.escape(cf["toc_label"])}</a></li>')
    nav_li_items.append('<li><a href="appendix_glossary.xhtml">Appendix: Novel Glossary</a></li>')

    nav_xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1 class="chapter-title" style="margin-top: 2em; margin-bottom: 1.5em; text-align: center;">Table of Contents</h1>
    <ol>
      {"".join(nav_li_items)}
    </ol>
  </nav>
</body>
</html>"""
    ET.fromstring(nav_xhtml.split("<!DOCTYPE html>")[1].strip())

    # 7. Generate EPUB 2 Navigation Control (toc.ncx)
    ncx_points = ["""    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>Title Page</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>"""]

    play_order = 2
    for cf in chapter_files:
        ncx_points.append(f"""    <navPoint id="navpoint-{play_order}" playOrder="{play_order}">
      <navLabel><text>{html.escape(cf["toc_label"])}</text></navLabel>
      <content src="{cf["filename"]}"/>
    </navPoint>""")
        play_order += 1

    ncx_points.append(f"""    <navPoint id="navpoint-{play_order}" playOrder="{play_order}">
      <navLabel><text>Appendix: Novel Glossary</text></navLabel>
      <content src="appendix_glossary.xhtml"/>
    </navPoint>""")

    toc_ncx = f"""<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="{BOOK_UUID}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>{html.escape(BOOK_TITLE)}</text>
  </docTitle>
  <docAuthor>
    <text>{html.escape(BOOK_AUTHOR)}</text>
  </docAuthor>
  <navMap>
{chr(10).join(ncx_points)}
  </navMap>
</ncx>"""

    # 8. Generate OPF Package Document (content.opf)
    manifest_items = [
        '<item id="style" href="style.css" media-type="text/css"/>',
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>'
    ]
    spine_items = [
        '<itemref idref="titlepage"/>',
        '<itemref idref="nav"/>'
    ]

    for cf in chapter_files:
        manifest_items.append(f'<item id="{cf["id"]}" href="{cf["filename"]}" media-type="application/xhtml+xml"/>')
        spine_items.append(f'<itemref idref="{cf["id"]}"/>')

    manifest_items.append('<item id="appendix_glossary" href="appendix_glossary.xhtml" media-type="application/xhtml+xml"/>')
    spine_items.append('<itemref idref="appendix_glossary"/>')

    content_opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookID" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookID">urn:uuid:{BOOK_UUID}</dc:identifier>
    <dc:title>{html.escape(BOOK_TITLE)}</dc:title>
    <dc:creator id="creator">{html.escape(BOOK_AUTHOR)}</dc:creator>
    <dc:language>{BOOK_LANGUAGE}</dc:language>
    <dc:publisher>Translated by User</dc:publisher>
    <meta property="dcterms:modified">{MODIFIED_TIME}</meta>
  </metadata>
  <manifest>
    {chr(10).join(manifest_items)}
  </manifest>
  <spine toc="ncx">
    {chr(10).join(spine_items)}
  </spine>
</package>"""

    # 9. META-INF/container.xml
    container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""

    # 10. Package into EPUB Zip Archive
    print(f"Packaging {len(chapter_files) + 6} files into {OUTPUT_EPUB}...")
    with zipfile.ZipFile(OUTPUT_EPUB, "w") as zf:
        # Step 1: Write mimetype uncompressed at offset 0 (CRITICAL EPUB standard rule)
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        
        # Step 2: Write container and OEBPS files compressed
        zf.writestr("META-INF/container.xml", container_xml, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/content.opf", content_opf, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/toc.ncx", toc_ncx, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/nav.xhtml", nav_xhtml, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/style.css", build_style_css(), compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("OEBPS/titlepage.xhtml", titlepage_html, compress_type=zipfile.ZIP_DEFLATED)
        
        for cf in chapter_files:
            zf.writestr(f"OEBPS/{cf['filename']}", cf["content"], compress_type=zipfile.ZIP_DEFLATED)
            
        zf.writestr("OEBPS/appendix_glossary.xhtml", glossary_xhtml, compress_type=zipfile.ZIP_DEFLATED)

    file_size_mb = os.path.getsize(OUTPUT_EPUB) / (1024 * 1024)
    print(f"SUCCESS: EPUB created successfully at: {OUTPUT_EPUB} ({file_size_mb:.2f} MB)")
    return OUTPUT_EPUB

if __name__ == "__main__":
    generate_epub()
