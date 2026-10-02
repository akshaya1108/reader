import os
import json
import re
import datetime
import html
from flask import Flask, request, jsonify, render_template, send_from_directory
from dotenv import load_dotenv

from ai_glossary import extract_characters_from_text, slugify, get_gemini_client
from scraper import scrape_fandom_character_list, scrape_fandom_data, sanitize_wiki_data_with_gemini, extract_title_from_url, lookup_single_entity

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")
GLOSSARY_DIR = os.path.join(DATA_DIR, "glossary")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
MOBILE_DIR = os.path.join(BASE_DIR, "mobile")
MOBILE_STATIC_DIR = os.path.join(MOBILE_DIR, "static")
MOBILE_TEMPLATES_DIR = os.path.join(MOBILE_DIR, "templates")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(GLOSSARY_DIR, exist_ok=True)
os.makedirs(CHAPTERS_DIR, exist_ok=True)

def load_books():
    if not os.path.exists(BOOKS_FILE):
        return []
    with open(BOOKS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_books(books):
    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2, ensure_ascii=False)

def get_glossary_file(book_id):
    return os.path.join(GLOSSARY_DIR, f"{book_id}.json")

CANONICAL_CATEGORIES = [
    "Character",
    "Weapon / Item",
    "Clan / Sect",
    "Location / Realm",
    "Concept / Lore",
]

CATEGORY_NORMALIZATION_MAP = {
    "character": "Character",
    "animal": "Character",
    "creature": "Character",
    "weapon / item": "Weapon / Item",
    "weapon / artifact": "Weapon / Item",
    "weapon/artifact": "Weapon / Item",
    "weapon": "Weapon / Item",
    "artifact": "Weapon / Item",
    "item": "Weapon / Item",
    "tool": "Weapon / Item",
    "clan / sect": "Clan / Sect",
    "cultivation sect / faction": "Clan / Sect",
    "sect": "Clan / Sect",
    "clan": "Clan / Sect",
    "faction": "Clan / Sect",
    "organization": "Clan / Sect",
    "location / realm": "Location / Realm",
    "location": "Location / Realm",
    "canonical location": "Location / Realm",
    "location / lore": "Location / Realm",
    "canonical location/lore": "Location / Realm",
    "realm": "Location / Realm",
    "place": "Location / Realm",
    "concept / lore": "Concept / Lore",
    "lore": "Concept / Lore",
    "lore / technique": "Concept / Lore",
    "lore / cultivation": "Concept / Lore",
    "technique": "Concept / Lore",
    "concept": "Concept / Lore",
}

def normalize_category(raw_category):
    if not raw_category:
        return "Character"
    raw_lower = str(raw_category).strip().lower()
    return CATEGORY_NORMALIZATION_MAP.get(raw_lower, "Character")

def load_glossary(book_id):
    path = get_glossary_file(book_id)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Normalize entries: ensure affiliation, category, and merge pinyin_or_chinese into aliases
    for entry in data:
        entry["category"] = normalize_category(entry.get("category"))
        if not entry.get("affiliation"):
            entry["affiliation"] = entry.get("sect_or_affiliation", "")
        if not entry.get("sect_or_affiliation"):
            entry["sect_or_affiliation"] = entry.get("affiliation", "")
        
        pinyin = (entry.get("pinyin_or_chinese") or "").strip()
        if pinyin:
            aliases = entry.get("aliases", [])
            if not isinstance(aliases, list):
                aliases = [aliases] if aliases else []
            aliases_lower = [a.lower() for a in aliases if isinstance(a, str)]
            if pinyin.lower() not in aliases_lower and pinyin.lower() != entry.get("name", "").lower():
                aliases.append(pinyin)
            entry["aliases"] = aliases
    return data

def save_glossary(book_id, glossary):
    path = get_glossary_file(book_id)

    # 1. Automatic rolling snapshot backup
    try:
        if os.path.exists(path) and os.path.getsize(path) > 10:
            backup_dir = os.path.join(GLOSSARY_DIR, "backups")
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = os.path.join(backup_dir, f"{book_id}_{timestamp}.json")
            with open(path, "r", encoding="utf-8") as rf, open(backup_file, "w", encoding="utf-8") as wf:
                wf.write(rf.read())
            
            # Keep only the last 15 backups for this book
            existing_backups = sorted(
                [f for f in os.listdir(backup_dir) if f.startswith(f"{book_id}_") and f.endswith(".json")]
            )
            while len(existing_backups) > 15:
                oldest = os.path.join(backup_dir, existing_backups.pop(0))
                try:
                    os.remove(oldest)
                except Exception:
                    pass
    except Exception as e:
        print(f"Notice: Glossary backup snapshot encountered ({e})")

    # 2. Clean, deduplicate and save
    seen_ids = set()
    cleaned_glossary = []
    for entry in glossary:
        entry["category"] = normalize_category(entry.get("category"))
        if not entry.get("affiliation"):
            entry["affiliation"] = entry.get("sect_or_affiliation", "")
        if not entry.get("sect_or_affiliation"):
            entry["sect_or_affiliation"] = entry.get("affiliation", "")
        
        # Deduplicate aliases and include pinyin
        raw_aliases = entry.get("aliases", [])
        if not isinstance(raw_aliases, list):
            raw_aliases = [raw_aliases] if raw_aliases else []
        
        pinyin = (entry.get("pinyin_or_chinese") or "").strip()
        if pinyin:
            raw_aliases.append(pinyin)

        clean_aliases = []
        seen_lower = set()
        primary_lower = entry.get("name", "").strip().lower()
        for a in raw_aliases:
            if isinstance(a, str) and a.strip():
                a_str = a.strip()
                a_low = a_str.lower()
                if a_low != primary_lower and a_low not in seen_lower:
                    seen_lower.add(a_low)
                    clean_aliases.append(a_str)
        entry["aliases"] = clean_aliases
        
        # Ensure unique IDs
        base_id = entry.get("id") or slugify(entry.get("name", "entry"))
        cand_id = base_id
        counter = 1
        while cand_id in seen_ids:
            cand_id = f"{base_id}-{counter}"
            counter += 1
        entry["id"] = cand_id
        seen_ids.add(cand_id)
        cleaned_glossary.append(entry)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(cleaned_glossary, f, indent=2, ensure_ascii=False)

def sanitize_html(raw_html):
    if not raw_html:
        return ""
    cleaned = re.sub(r'<font[^>]*>', '', raw_html, flags=re.IGNORECASE)
    cleaned = re.sub(r'</font>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*style\s*=\s*(["\'][^"\']*["\']|[^\s>]+)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*class\s*=\s*(["\'][^"\']*["\']|[^\s>]+)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*(color|bgcolor|face|text)\s*=\s*(["\'][^"\']*["\']|[^\s>]+)', '', cleaned, flags=re.IGNORECASE)
    return cleaned

def count_words(html_or_text):
    text = re.sub(r'<[^>]+>', ' ', html_or_text)
    words = re.findall(r'\b\w+\b', text)
    return len(words)

# Routes
@app.route("/")
def index():
    return render_template("index.html")

# Mobile PWA Routes
@app.route("/m")
@app.route("/m/")
def mobile_index():
    return send_from_directory(MOBILE_TEMPLATES_DIR, "mobile.html")

@app.route("/m/static/<path:filename>")
def mobile_static(filename):
    return send_from_directory(MOBILE_STATIC_DIR, filename)

@app.route("/m/manifest.json")
@app.route("/manifest.json")
def pwa_manifest():
    return send_from_directory(MOBILE_STATIC_DIR, "manifest.json", mimetype="application/manifest+json")

@app.route("/m/sw.js")
@app.route("/sw.js")
def pwa_sw():
    return send_from_directory(MOBILE_STATIC_DIR, "sw.js", mimetype="application/javascript")


@app.route("/api/status")
def status():
    load_dotenv(override=True)
    has_key = bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here")
    return jsonify({
        "gemini_configured": has_key,
        "model": "gemini-3.6-flash"
    })

# Books CRUD
@app.route("/api/books", methods=["GET"])
def list_books():
    books = load_books()
    # Enrich with chapter counts and total words
    for book in books:
        book.setdefault("enable_glossary", True)
        b_id = book["id"]
        ch_dir = os.path.join(CHAPTERS_DIR, b_id)
        if os.path.exists(ch_dir):
            ch_files = [f for f in os.listdir(ch_dir) if f.endswith(".json")]
            book["chapters_count"] = len(ch_files)
            total_words = 0
            for cf in ch_files:
                try:
                    with open(os.path.join(ch_dir, cf), "r", encoding="utf-8") as f:
                        cdata = json.load(f)
                        total_words += cdata.get("word_count", 0)
                except Exception:
                    pass
            book["total_words"] = total_words
        else:
            book["chapters_count"] = 0
            book["total_words"] = 0
    return jsonify(books)

@app.route("/api/books", methods=["POST"])
def create_book():
    data = request.json or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    
    books = load_books()
    book_id = slugify(title)
    existing_ids = {b["id"] for b in books}
    counter = 1
    base_id = book_id
    while book_id in existing_ids:
        book_id = f"{base_id}-{counter}"
        counter += 1

    palette = ["#ba6d78", "#5c8672", "#c4884d", "#647b9a", "#8c6b96"]
    color = data.get("color") or palette[len(books) % len(palette)]
    today_str = datetime.datetime.now().strftime("%d/%m/%Y")

    new_book = {
        "id": book_id,
        "title": title,
        "author": data.get("author", "Unknown Author").strip() or "Unknown Author",
        "genre": data.get("genre", "Web Novel").strip() or "Web Novel",
        "color": color,
        "created_at": today_str,
        "last_read_chapter": 1,
        "enable_glossary": bool(data.get("enable_glossary", True))
    }
    books.append(new_book)
    save_books(books)
    os.makedirs(os.path.join(CHAPTERS_DIR, book_id), exist_ok=True)
    save_glossary(book_id, [])
    return jsonify(new_book), 201

@app.route("/api/books/<book_id>", methods=["PUT"])
def update_book(book_id):
    data = request.json or {}
    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    
    if "title" in data and data["title"].strip():
        book["title"] = data["title"].strip()
    if "author" in data:
        book["author"] = data["author"].strip()
    if "genre" in data:
        book["genre"] = data["genre"].strip()
    if "color" in data:
        book["color"] = data["color"].strip()
    if "last_read_chapter" in data:
        book["last_read_chapter"] = data["last_read_chapter"]
    if "bookmark" in data:
        book["bookmark"] = data["bookmark"]
    if "enable_glossary" in data:
        book["enable_glossary"] = bool(data["enable_glossary"])
    
    save_books(books)
    return jsonify(book)

@app.route("/api/books/<book_id>", methods=["DELETE"])
def delete_book(book_id):
    books = load_books()
    books = [b for b in books if b["id"] != book_id]
    save_books(books)
    return jsonify({"success": True})

@app.route("/api/books/<book_id>/export-epub", methods=["GET"])
def export_epub_endpoint(book_id):
    epub_filename = "Mo_Dao_Zu_Shi_Chapters_1-113.epub"
    epub_path = os.path.join(BASE_DIR, epub_filename)
    if os.path.exists(epub_path):
        return send_from_directory(BASE_DIR, epub_filename, as_attachment=True)
    return jsonify({"error": "EPUB file not found"}), 404

@app.route("/api/books/import-epub", methods=["POST"])
def import_epub_endpoint():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    filename = file.filename or ""
    if not filename.lower().endswith(".epub"):
        return jsonify({"error": "Only EPUB files (.epub) are supported"}), 400

    import zipfile
    import bs4
    import xml.etree.ElementTree as ET

    try:
        with zipfile.ZipFile(file) as z:
            container_xml = z.read("META-INF/container.xml")
            container_root = ET.fromstring(container_xml)
            rootfile_el = container_root.find(".//{*}rootfile")
            if rootfile_el is None:
                return jsonify({"error": "Invalid EPUB: Missing rootfile in container.xml"}), 400
            opf_path = rootfile_el.attrib["full-path"]
            opf_dir = os.path.dirname(opf_path)
            opf_root = ET.fromstring(z.read(opf_path))

            # Extract Title & Author - strip junk suffixes like "retail-pdf", "scan" etc.
            title_el = opf_root.find(".//{*}title")
            title = (title_el.text or "").strip() if title_el is not None else ""
            if not title:
                title = os.path.splitext(filename)[0].replace("_", " ").title()
            # Clean up title: remove trailing junk like "- Retail Pdf", "(scan)", etc.
            title = re.sub(r'\s*[-_:]\s*(retail|scan|ocr|hocr|pdf|epub)\b.*$', '', title, flags=re.IGNORECASE).strip()
            title = re.sub(r'\s*\(retail\)\s*$', '', title, flags=re.IGNORECASE).strip()

            creator_el = opf_root.find(".//{*}creator")
            author = (creator_el.text or "").strip() if creator_el is not None else "Unknown Author"

            # Parse manifest & spine
            manifest_items = opf_root.findall(".//{*}item")
            manifest = {}
            for item in manifest_items:
                item_id = item.attrib.get("id", "")
                href = item.attrib.get("href", "")
                media_type = item.attrib.get("media-type", "")
                manifest[item_id] = {"href": href, "media-type": media_type}

            spine = [itemref.attrib["idref"] for itemref in opf_root.findall(".//{*}itemref")]

            # ---------------------------------------------------------------
            # Build a chapter-boundary map from TOC (toc.ncx or nav.xhtml)
            # Each entry: normalized filename -> chapter title from TOC
            # ---------------------------------------------------------------
            toc_chapter_starts = {}  # normalized path -> chapter title

            # Try toc.ncx first
            toc_ncx_id = None
            for item in manifest_items:
                mt = item.attrib.get("media-type", "")
                props = item.attrib.get("properties", "")
                if mt == "application/x-dtbncx+xml" or item.attrib.get("href", "").endswith(".ncx"):
                    toc_ncx_id = item.attrib.get("id")
                    break
            # Also check spine toc attribute
            spine_el = opf_root.find(".//{*}spine")
            if spine_el is not None and "toc" in spine_el.attrib:
                toc_ncx_id = spine_el.attrib["toc"]

            if toc_ncx_id and toc_ncx_id in manifest:
                ncx_href = manifest[toc_ncx_id]["href"]
                ncx_full = os.path.normpath(os.path.join(opf_dir, ncx_href))
                try:
                    ncx_root = ET.fromstring(z.read(ncx_full))
                    for navPoint in ncx_root.findall(".//{*}navPoint"):
                        label_el = navPoint.find(".//{*}text")
                        content_el = navPoint.find(".//{*}content")
                        if label_el is not None and content_el is not None:
                            src = content_el.attrib.get("src", "")
                            src_file = src.split("#")[0]  # strip fragment
                            norm_src = os.path.normpath(os.path.join(opf_dir, src_file))
                            label = (label_el.text or "").strip()
                            toc_chapter_starts[norm_src] = label
                except Exception:
                    pass

            # Try nav.xhtml (EPUB3)
            if not toc_chapter_starts:
                for item in manifest_items:
                    props = item.attrib.get("properties", "")
                    if "nav" in props:
                        nav_href = item.attrib.get("href", "")
                        nav_full = os.path.normpath(os.path.join(opf_dir, nav_href))
                        try:
                            nav_content = z.read(nav_full).decode("utf-8", errors="ignore")
                            nav_soup = bs4.BeautifulSoup(nav_content, "html.parser")
                            toc_nav = nav_soup.find("nav", attrs={"epub:type": "toc"}) or nav_soup.find("nav")
                            if toc_nav:
                                for a in toc_nav.find_all("a", href=True):
                                    href_val = a["href"].split("#")[0]
                                    norm_src = os.path.normpath(os.path.join(opf_dir, href_val))
                                    label = a.get_text(strip=True)
                                    if label:
                                        toc_chapter_starts[norm_src] = label
                        except Exception:
                            pass
                        break

            # Create Book ID
            books = load_books()
            base_id = slugify(title) or "imported-novel"
            book_id = base_id
            existing_ids = {b["id"] for b in books}
            counter = 1
            while book_id in existing_ids:
                book_id = f"{base_id}-{counter}"
                counter += 1

            book_chapters_dir = os.path.join(CHAPTERS_DIR, book_id)
            os.makedirs(book_chapters_dir, exist_ok=True)
            save_glossary(book_id, [])

            ch_number = 1
            total_words = 0

            # ---------------------------------------------------------------
            # Group spine items into chapters using TOC boundaries
            # If we have TOC data: group consecutive items until next TOC entry
            # If no TOC: detect chapter headings or treat each item as a chapter
            # ---------------------------------------------------------------
            CHAPTER_HEADING_RE = re.compile(
                r'^(chapter|prologue|epilogue|book|part|section|interlude|appendix)\b',
                re.IGNORECASE
            )

            # Build ordered spine items with resolved paths
            spine_items = []
            for item_id in spine:
                if item_id not in manifest:
                    continue
                href = manifest[item_id]["href"]
                full_path = os.path.normpath(os.path.join(opf_dir, href))
                spine_items.append((item_id, full_path))

            use_toc = len(toc_chapter_starts) > 0

            if use_toc:
                # Group consecutive spine items per TOC chapter
                groups = []  # list of (ch_title, [full_paths])
                current_group_title = None
                current_group_paths = []

                for item_id, full_path in spine_items:
                    if full_path in toc_chapter_starts:
                        # New chapter boundary
                        if current_group_paths:
                            groups.append((current_group_title, current_group_paths))
                        current_group_title = toc_chapter_starts[full_path]
                        current_group_paths = [full_path]
                    elif current_group_paths:
                        current_group_paths.append(full_path)
                    else:
                        # Before first TOC entry - skip front matter or attach to first group
                        current_group_paths.append(full_path)
                        current_group_title = "Front Matter"

                if current_group_paths:
                    groups.append((current_group_title, current_group_paths))

                for ch_title, paths in groups:
                    combined_parts = []
                    for fp in paths:
                        try:
                            raw = z.read(fp).decode("utf-8", errors="ignore")
                        except Exception:
                            continue
                        soup = bs4.BeautifulSoup(raw, "html.parser")
                        for unwanted in soup(["script", "style", "nav"]):
                            unwanted.decompose()
                        body = soup.find("body") or soup
                        for p in body.find_all("p"):
                            p_text = p.get_text(strip=True)
                            if p_text:
                                combined_parts.append(f"<p>{html.escape(p_text)}</p>")

                    if not combined_parts:
                        continue

                    ch_html = "\n".join(combined_parts)
                    ch_words = count_words(ch_html)
                    total_words += ch_words

                    ch_data = {
                        "chapter_number": ch_number,
                        "title": ch_title or f"Chapter {ch_number}",
                        "content": ch_html,
                        "word_count": ch_words,
                        "created_at": datetime.datetime.now().strftime("%d/%m/%Y")
                    }
                    ch_file = os.path.join(book_chapters_dir, f"{ch_number}.json")
                    with open(ch_file, "w", encoding="utf-8") as f:
                        json.dump(ch_data, f, indent=2, ensure_ascii=False)
                    ch_number += 1

            else:
                # No TOC: process spine items one by one, detect chapter headings
                # Items that are too short (front matter / page breaks) get merged into
                # the previous chapter.
                pending_parts = []
                pending_title = None

                def flush_chapter(parts, title):
                    nonlocal ch_number, total_words
                    if not parts:
                        return
                    ch_html = "\n".join(parts)
                    ch_words = count_words(ch_html)
                    total_words += ch_words
                    ch_data = {
                        "chapter_number": ch_number,
                        "title": title or f"Chapter {ch_number}",
                        "content": ch_html,
                        "word_count": ch_words,
                        "created_at": datetime.datetime.now().strftime("%d/%m/%Y")
                    }
                    ch_file = os.path.join(book_chapters_dir, f"{ch_number}.json")
                    with open(ch_file, "w", encoding="utf-8") as f:
                        json.dump(ch_data, f, indent=2, ensure_ascii=False)
                    ch_number += 1

                for item_id, full_path in spine_items:
                    try:
                        raw = z.read(full_path).decode("utf-8", errors="ignore")
                    except Exception:
                        continue
                    soup = bs4.BeautifulSoup(raw, "html.parser")
                    for unwanted in soup(["script", "style", "nav"]):
                        unwanted.decompose()
                    body = soup.find("body") or soup
                    text_content = body.get_text(strip=True)
                    words_in_item = count_words(text_content)

                    # Skip near-empty items (cover pages, blank pages)
                    if words_in_item < 40:
                        continue

                    # Detect chapter heading
                    heading = body.find(["h1", "h2", "h3"])
                    heading_text = heading.get_text(strip=True) if heading else ""
                    is_new_chapter = bool(heading_text and CHAPTER_HEADING_RE.match(heading_text))

                    p_tags = body.find_all("p")
                    clean_parts = []
                    for p in p_tags:
                        p_text = p.get_text(strip=True)
                        if p_text:
                            clean_parts.append(f"<p>{html.escape(p_text)}</p>")
                    if not clean_parts:
                        lines = [ln.strip() for ln in text_content.splitlines() if ln.strip()]
                        clean_parts = [f"<p>{html.escape(ln)}</p>" for ln in lines]

                    if is_new_chapter:
                        # Flush previous chapter
                        flush_chapter(pending_parts, pending_title)
                        pending_parts = clean_parts
                        pending_title = heading_text
                        if heading:
                            heading.decompose()
                    else:
                        pending_parts.extend(clean_parts)
                        if not pending_title:
                            pending_title = f"Chapter {ch_number}"

                # Flush last chapter
                flush_chapter(pending_parts, pending_title)

            chapters_count = ch_number - 1
            if chapters_count == 0:
                chapters_count = 1
                ch_data = {
                    "chapter_number": 1,
                    "title": "Chapter 1",
                    "content": "<p>Content imported from EPUB.</p>",
                    "word_count": 4,
                    "created_at": datetime.datetime.now().strftime("%d/%m/%Y")
                }
                with open(os.path.join(book_chapters_dir, "1.json"), "w", encoding="utf-8") as f:
                    json.dump(ch_data, f, indent=2, ensure_ascii=False)

            palette = ["#ba6d78", "#5c8672", "#c4884d", "#647b9a", "#8c6b96"]
            color = palette[len(books) % len(palette)]
            today_str = datetime.datetime.now().strftime("%d/%m/%Y")

            new_book = {
                "id": book_id,
                "title": title,
                "author": author,
                "genre": "Web Novel",
                "color": color,
                "created_at": today_str,
                "last_read_chapter": 1,
                "last_chapter": 1,
                "chapters_count": chapters_count,
                "total_words": total_words,
                "enable_glossary": True
            }

            books.append(new_book)
            save_books(books)

            return jsonify({
                "success": True,
                "book": new_book,
                "chapters_count": chapters_count
            }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to parse EPUB: {str(e)}"}), 500


def generate_rich_snippet(content, max_chars=260):
    if not content:
        return ""
    text = re.sub(r'</(p|div|h[1-6]|li|blockquote)>', ' ', content, flags=re.IGNORECASE)
    text = re.sub(r'<br\s*/?>', ' ', text, flags=re.IGNORECASE)
    
    allowed = {'b', 'strong', 'i', 'em', 'u', 's'}
    def filter_tag(match):
        is_close = bool(match.group(1))
        tag_name = match.group(2).lower()
        if tag_name in allowed:
            return f"</{tag_name}>" if is_close else f"<{tag_name}>"
        return ""
    
    cleaned = re.sub(r'<(/)?([a-zA-Z0-9]+)[^>]*>', filter_tag, text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    if len(cleaned) > max_chars:
        truncated = cleaned[:max_chars]
        for t in ['b', 'strong', 'i', 'em', 'u', 's']:
            open_count = len(re.findall(f'<{t}>', truncated))
            close_count = len(re.findall(f'</{t}>', truncated))
            if open_count > close_count:
                truncated += f"</{t}>" * (open_count - close_count)
        return truncated + "..."
    return cleaned

# Chapters CRUD
@app.route("/api/books/<book_id>/chapters", methods=["GET"])
def list_chapters(book_id):
    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    if not os.path.exists(ch_dir):
        return jsonify([])
    
    chapters = []
    for f in os.listdir(ch_dir):
        if f.endswith(".json"):
            try:
                with open(os.path.join(ch_dir, f), "r", encoding="utf-8") as file:
                    cdata = json.load(file)
                    content = cdata.get("content", "")
                    cdata["snippet"] = generate_rich_snippet(content)
                    chapters.append(cdata)
            except Exception as e:
                print(f"Error reading chapter {f}: {e}")
                
    chapters.sort(key=lambda x: x.get("chapter_number", 0))
    return jsonify(chapters)

@app.route("/api/books/<book_id>/chapters/<int:ch_num>", methods=["GET"])
def get_chapter(book_id, ch_num):
    filepath = os.path.join(CHAPTERS_DIR, book_id, f"{ch_num}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "Chapter not found"}), 404
    with open(filepath, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))

@app.route("/api/books/<book_id>/chapters", methods=["POST"])
def save_chapter(book_id):
    data = request.json or {}
    try:
        ch_num = int(data.get("chapter_number", 1))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid chapter number"}), 400

    title = data.get("title", "").strip() or f"Chapter {ch_num}"
    content = sanitize_html(data.get("content", "").strip())
    auto_scan = data.get("auto_scan", True)
    
    words = count_words(content)
    today_str = datetime.datetime.now().strftime("%d/%m/%Y")
    
    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    os.makedirs(ch_dir, exist_ok=True)
    filepath = os.path.join(ch_dir, f"{ch_num}.json")
    
    chapter_data = {
        "chapter_number": ch_num,
        "title": title,
        "content": content,
        "word_count": words,
        "created_at": today_str
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(chapter_data, f, indent=2, ensure_ascii=False)
        
    # Run Gemini Character extraction if requested and enabled
    new_characters = []
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    glossary_enabled = curr_book.get("enable_glossary", True) if curr_book else True

    if auto_scan and content and glossary_enabled:
        glossary = load_glossary(book_id)
        # Convert HTML to raw text for AI scan
        raw_text = re.sub(r'<[^>]+>', ' ', content)
        updated_glossary, new_characters = extract_characters_from_text(raw_text, glossary)
        save_glossary(book_id, updated_glossary)

    # Update last read / total words
    for b in books:
        if b["id"] == book_id:
            b["last_read_chapter"] = ch_num
    save_books(books)

    return jsonify({
        "success": True,
        "chapter": chapter_data,
        "new_characters": new_characters
    })

@app.route("/api/books/<book_id>/chapters/<int:ch_num>", methods=["DELETE"])
def delete_chapter(book_id, ch_num):
    filepath = os.path.join(CHAPTERS_DIR, book_id, f"{ch_num}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
    return jsonify({"success": True})

# --- FULL-TEXT CHAPTER & LORE SEARCH ENGINE ---
def extract_chapter_search_matches(content_html: str, query: str) -> list:
    if not content_html or not query:
        return []

    p_pattern = re.compile(r'<p[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL)
    raw_paragraphs = p_pattern.findall(content_html)
    if not raw_paragraphs:
        clean = re.sub(r'<br\s*/?>', '\n', content_html, flags=re.IGNORECASE)
        raw_paragraphs = [p.strip() for p in clean.split('\n') if p.strip()]

    matches = []
    q_lower = query.lower()

    for p_idx, p_html in enumerate(raw_paragraphs):
        text = re.sub(r'<[^>]+>', '', p_html)
        text = html.unescape(text).strip()
        if not text:
            continue

        text_lower = text.lower()
        start = 0
        while True:
            pos = text_lower.find(q_lower, start)
            if pos == -1:
                break

            match_text = text[pos:pos + len(query)]

            before_str = text[:pos]
            after_str = text[pos + len(query):]

            before_words = before_str.split()
            after_words = after_str.split()

            if len(before_words) > 14:
                snippet_before = "..." + " ".join(before_words[-14:]) + " "
            else:
                snippet_before = before_str

            if len(after_words) > 14:
                snippet_after = " " + " ".join(after_words[:14]) + "..."
            else:
                snippet_after = after_str

            safe_before = html.escape(snippet_before)
            safe_match = f'<mark class="search-match">{html.escape(match_text)}</mark>'
            safe_after = html.escape(snippet_after)
            snippet_html = f"{safe_before}{safe_match}{safe_after}"

            matches.append({
                "paragraph_index": p_idx,
                "snippet_html": snippet_html,
                "text_before": snippet_before,
                "match_text": match_text,
                "text_after": snippet_after
            })

            start = pos + len(query)

    return matches

def search_glossary_entries(glossary: list, query: str) -> list:
    if not glossary or not query:
        return []

    q_lower = query.lower()
    results = []

    for entry in glossary:
        name = entry.get("name", "")
        aliases = entry.get("aliases", [])
        pinyin = entry.get("pinyin_or_chinese", "")
        summary = entry.get("summary", "")
        sect = entry.get("affiliation") or entry.get("sect_or_affiliation", "")
        category = entry.get("category", "Character")

        matched_field = None
        matched_alias = None

        if q_lower in name.lower():
            matched_field = "name"
        elif any(q_lower in a.lower() for a in aliases):
            matched_field = "alias"
            matched_alias = next((a for a in aliases if q_lower in a.lower()), None)
        elif pinyin and q_lower in pinyin.lower():
            matched_field = "pinyin"
        elif summary and q_lower in summary.lower():
            matched_field = "summary"
        elif sect and q_lower in sect.lower():
            matched_field = "sect"

        if matched_field:
            results.append({
                "id": entry.get("id"),
                "name": name,
                "category": category,
                "pinyin_or_chinese": pinyin,
                "aliases": aliases,
                "affiliation": sect,
                "sect_or_affiliation": sect,
                "summary": summary,
                "matched_field": matched_field,
                "matched_alias": matched_alias
            })

    return results

@app.route("/api/books/<book_id>/search", methods=["GET"])
def search_book(book_id):
    query = request.args.get("q", "").strip()
    ch_filter = request.args.get("ch")
    scope = request.args.get("scope", "all")

    try:
        ch_filter = int(ch_filter) if ch_filter else None
    except ValueError:
        ch_filter = None

    glossary = load_glossary(book_id)

    if not query:
        if scope == "lore":
            return jsonify({
                "query": "",
                "glossary_matches": glossary,
                "chapter_matches": [],
                "total_lore_matches": len(glossary),
                "total_chapter_matches": 0,
                "total_matches": len(glossary)
            })
        return jsonify({
            "query": "",
            "glossary_matches": [],
            "chapter_matches": [],
            "total_lore_matches": 0,
            "total_chapter_matches": 0,
            "total_matches": 0
        })

    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    enable_glossary = book.get("enable_glossary", True) if book else True

    glossary_matches = []
    if enable_glossary and scope in ("all", "lore"):
        glossary_matches = search_glossary_entries(glossary, query)

    chapter_matches = []
    total_chapter_matches = 0

    if scope in ("all", "chapters", "all_chapters", "this_chapter"):
        ch_dir = os.path.join(CHAPTERS_DIR, book_id)
        if os.path.exists(ch_dir):
            files = [f for f in os.listdir(ch_dir) if f.endswith(".json")]
            def get_ch_num(fname):
                try:
                    return int(fname.split(".")[0])
                except ValueError:
                    return 999999
            files.sort(key=get_ch_num)

            for f in files:
                f_ch_num = get_ch_num(f)
                if ch_filter is not None and f_ch_num != ch_filter:
                    continue

                filepath = os.path.join(ch_dir, f)
                try:
                    with open(filepath, "r", encoding="utf-8") as file:
                        cdata = json.load(file)
                        content = cdata.get("content", "")
                        title = cdata.get("title", "") or f"Chapter {f_ch_num}"
                        snippets = extract_chapter_search_matches(content, query)
                        if snippets:
                            total_chapter_matches += len(snippets)
                            chapter_matches.append({
                                "chapter_number": f_ch_num,
                                "title": title,
                                "match_count": len(snippets),
                                "snippets": snippets
                            })
                except Exception as e:
                    print(f"Error searching chapter {f}: {e}")

    return jsonify({
        "query": query,
        "glossary_matches": glossary_matches,
        "chapter_matches": chapter_matches,
        "total_lore_matches": len(glossary_matches),
        "total_chapter_matches": total_chapter_matches,
        "total_matches": len(glossary_matches) + total_chapter_matches
    })

def norm_alias(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[\s\-_’\'"]+', '', s).lower().strip()

GENERIC_ALIAS_IGNORE = {
    "location", "locations", "character", "characters", "weapon", "weapons",
    "item", "items", "clan", "clans", "sect", "sects", "concept", "concepts",
    "lore", "cast", "all", "wiki", "novel", "realm", "place", "mountains", "mountain"
}

def find_matching_glossary_entry(glossary: list, query_name: str, incoming_item: dict = None) -> dict | None:
    """
    Finds if an entry already exists in the glossary by checking:
    1. Exact ID or slugified query name.
    2. Primary name (case and punctuation insensitive).
    3. Aliases of existing entries containing query_name.
    4. Cross-alias and name overlap between incoming_item and existing entries.
    5. Matching Chinese Hanzi or Pinyin.
    """
    if not glossary:
        return None

    q_norm = norm_alias(query_name)
    q_slug = slugify(query_name) if query_name else ""

    inc_name = incoming_item.get("name", "") if incoming_item else ""
    inc_norm = norm_alias(inc_name)
    inc_slug = (incoming_item.get("id") or (slugify(inc_name) if inc_name else "")) if incoming_item else ""
    inc_aliases = [norm_alias(a) for a in incoming_item.get("aliases", []) if a and norm_alias(a) not in GENERIC_ALIAS_IGNORE] if incoming_item else []
    inc_hanzi = norm_alias(incoming_item.get("pinyin_or_chinese")) if incoming_item else ""

    # Priority 1: Match with query_name directly (if not generic)
    if q_norm and q_norm not in GENERIC_ALIAS_IGNORE:
        for entry in glossary:
            if entry.get("id") and entry.get("id") == q_slug:
                return entry
            if norm_alias(entry.get("name")) == q_norm:
                return entry
            e_aliases = [norm_alias(a) for a in entry.get("aliases", []) if a]
            if q_norm in e_aliases:
                return entry

    # Priority 2: Match with incoming_item details (resolved by AI/wiki)
    if incoming_item:
        inc_cat = normalize_category(incoming_item.get("category")) if incoming_item.get("category") else ""
        for entry in glossary:
            e_cat = normalize_category(entry.get("category")) if entry.get("category") else ""
            # Cross-category matching is strictly forbidden
            if inc_cat and e_cat and inc_cat != e_cat:
                continue

            e_id = entry.get("id", "")
            e_norm = norm_alias(entry.get("name"))
            e_aliases = [norm_alias(a) for a in entry.get("aliases", []) if a]
            e_hanzi = norm_alias(entry.get("pinyin_or_chinese"))

            if inc_slug and e_id == inc_slug:
                return entry
            if inc_norm and (e_norm == inc_norm or inc_norm in e_aliases):
                return entry
            if e_norm and e_norm in inc_aliases:
                return entry
            # Check overlap between incoming aliases and existing aliases (strictly non-generic)
            for a in inc_aliases:
                if a in e_aliases and a not in GENERIC_ALIAS_IGNORE and len(a) >= 3:
                    return entry
            # Check Hanzi / pinyin match if meaningful
            if inc_hanzi and e_hanzi and (inc_hanzi in e_hanzi or e_hanzi in inc_hanzi) and len(inc_hanzi) >= 2:
                return entry

    return None

def merge_glossary_entry(existing: dict, incoming: dict, query_name: str = None) -> dict:
    """
    Intelligently merges incoming character/item data into an existing entry:
    - NEVER overwrites an existing summary! Keeps the user's/existing description.
    - Merges aliases: preserves ALL existing aliases, appends query_name and any new incoming aliases.
    - Deduplicates aliases case-insensitively while preserving original casing and order.
    - Backfills pinyin or sect/affiliation if existing was blank.
    """
    # 1. Aliases: Start with all current aliases
    existing_aliases = existing.get("aliases", [])
    if not isinstance(existing_aliases, list):
        existing_aliases = [existing_aliases] if existing_aliases else []

    merged_aliases = list(existing_aliases)
    seen_lower = {norm_alias(a): a for a in merged_aliases if a}
    primary_name_norm = norm_alias(existing.get("name", ""))

    # Candidate aliases to merge
    candidates = []
    if query_name and query_name.strip() and norm_alias(query_name) not in GENERIC_ALIAS_IGNORE:
        candidates.append(query_name.strip())
    
    if incoming:
        inc_name = incoming.get("name", "").strip()
        if inc_name and norm_alias(inc_name) not in GENERIC_ALIAS_IGNORE:
            candidates.append(inc_name)
        for a in incoming.get("aliases", []):
            if isinstance(a, str) and a.strip() and norm_alias(a) not in GENERIC_ALIAS_IGNORE:
                candidates.append(a.strip())
        inc_pinyin = incoming.get("pinyin_or_chinese", "").strip()
        if inc_pinyin and norm_alias(inc_pinyin) not in GENERIC_ALIAS_IGNORE:
            candidates.append(inc_pinyin)

    for cand in candidates:
        c_norm = norm_alias(cand)
        # Do not add if it equals primary name, is generic, or already exists in aliases
        if c_norm and c_norm != primary_name_norm and c_norm not in seen_lower and c_norm not in GENERIC_ALIAS_IGNORE:
            seen_lower[c_norm] = cand
            merged_aliases.append(cand)

    existing["aliases"] = merged_aliases

    # 2. Summary: PRESERVE OLD SUMMARY!
    # Only use incoming summary if existing summary is empty or whitespace
    existing_summary = existing.get("summary", "").strip()
    incoming_summary = incoming.get("summary", "").strip() if incoming else ""
    if not existing_summary and incoming_summary:
        existing["summary"] = incoming_summary

    # 3. Pinyin / Chinese: Only backfill if existing is empty
    if not existing.get("pinyin_or_chinese", "").strip() and incoming and incoming.get("pinyin_or_chinese", "").strip():
        existing["pinyin_or_chinese"] = incoming["pinyin_or_chinese"].strip()

    # 4. Affiliation: Only backfill if existing is empty
    inc_aff = (incoming.get("affiliation") or incoming.get("sect_or_affiliation") or "").strip() if incoming else ""
    if inc_aff:
        if not existing.get("affiliation"):
            existing["affiliation"] = inc_aff
        if not existing.get("sect_or_affiliation"):
            existing["sect_or_affiliation"] = inc_aff

    # 5. Category: If existing category is missing or default "Character", and incoming is more specific
    if (not existing.get("category") or existing.get("category") == "Character") and incoming and incoming.get("category"):
        existing["category"] = incoming["category"]

    return existing

# Glossary CRUD
@app.route("/api/books/<book_id>/glossary", methods=["GET"])
def get_glossary(book_id):
    return jsonify(load_glossary(book_id))

@app.route("/api/books/<book_id>/glossary", methods=["POST"])
def add_or_update_character(book_id):
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Character name is required"}), 400
        
    glossary = load_glossary(book_id)
    char_id = data.get("id")
    
    aliases = data.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]

    affiliation = (data.get("affiliation") or data.get("sect_or_affiliation") or "").strip()

    # If an explicit char_id was passed (e.g. from editing an existing card in the drawer), update it
    if char_id:
        existing = next((c for c in glossary if c.get("id") == char_id), None)
        if existing:
            existing["name"] = name
            existing["category"] = normalize_category(data.get("category", existing.get("category", "Character")))
            if "pinyin_or_chinese" in data:
                existing["pinyin_or_chinese"] = data.get("pinyin_or_chinese", "")
            existing["aliases"] = aliases
            existing["affiliation"] = affiliation
            existing["sect_or_affiliation"] = affiliation
            existing["summary"] = data.get("summary", existing.get("summary", ""))
            save_glossary(book_id, glossary)
            return jsonify({"success": True, "glossary": glossary})

    # Otherwise, check if this character / alias already exists in the glossary
    existing = find_matching_glossary_entry(glossary, name, incoming_item={"name": name, "aliases": aliases})
    if existing:
        # Merge aliases into existing character without erasing existing summary
        merge_glossary_entry(existing, {"name": name, "aliases": aliases, "affiliation": affiliation, "sect_or_affiliation": affiliation, "summary": data.get("summary", ""), "category": normalize_category(data.get("category", "Character"))}, query_name=name)
    else:
        new_char = {
            "id": slugify(name),
            "name": name,
            "category": normalize_category(data.get("category", "Character")),
            "pinyin_or_chinese": data.get("pinyin_or_chinese", ""),
            "aliases": aliases,
            "affiliation": affiliation,
            "sect_or_affiliation": affiliation,
            "summary": data.get("summary", "")
        }
        glossary.append(new_char)
        
    save_glossary(book_id, glossary)
    return jsonify({"success": True, "glossary": glossary})

@app.route("/api/books/<book_id>/glossary/<char_id>", methods=["DELETE"])
def delete_character(book_id, char_id):
    glossary = load_glossary(book_id)
    glossary = [c for c in glossary if c.get("id") != char_id]
    save_glossary(book_id, glossary)
    return jsonify({"success": True, "glossary": glossary})

# Manual AI Scan
@app.route("/api/books/<book_id>/scan-chapter", methods=["POST"])
def scan_chapter_endpoint(book_id):
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    if curr_book and not curr_book.get("enable_glossary", True):
        return jsonify({
            "success": True,
            "new_characters": [],
            "glossary": []
        })

    data = request.json or {}
    content = data.get("content", "")
    if not content and "chapter_number" in data:
        ch_num = data["chapter_number"]
        filepath = os.path.join(CHAPTERS_DIR, book_id, f"{ch_num}.json")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                cdata = json.load(f)
                content = cdata.get("content", "")

    if not content:
        return jsonify({"error": "No content to scan"}), 400

    raw_text = re.sub(r'<[^>]+>', ' ', content)
    glossary = load_glossary(book_id)
    updated_glossary, new_characters = extract_characters_from_text(raw_text, glossary)
    save_glossary(book_id, updated_glossary)
    return jsonify({
        "success": True,
        "new_characters": new_characters,
        "glossary": updated_glossary
    })

# Wiki / Web Guide Import
@app.route("/api/books/<book_id>/scrape-wiki", methods=["POST"])
def scrape_wiki_endpoint(book_id):
    data = request.json or {}
    url_or_query = data.get("wiki_url_or_title", "").strip()
    
    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    book_title = book.get("title", "") if book else ""

    if not url_or_query and not book_title:
        return jsonify({"error": "Character name, novel title, or guide URL required"}), 400

    is_url = url_or_query.startswith("http")
    query = ""
    target_category = ""
    if is_url:
        derived = extract_title_from_url(url_or_query)
        target_title = derived or book_title or "Xianxia Novel"
        raw_text, detected_cat, page_name = scrape_fandom_data(url_or_query, target_title)
        target_category = detected_cat
        if page_name and not page_name.lower().startswith("category:"):
            query = page_name
    elif url_or_query and url_or_query.lower() != book_title.lower():
        # User entered a specific name or category query
        query = url_or_query
        target_title = book_title or url_or_query
        raw_text, detected_cat, page_name = scrape_fandom_data(url_or_query, target_title)
        target_category = detected_cat
    else:
        # User entered book title or left blank
        target_title = book_title or url_or_query
        raw_text, detected_cat, _ = scrape_fandom_data(target_title, target_title)
        target_category = detected_cat

    scraped_chars, err_msg = sanitize_wiki_data_with_gemini(raw_text, target_title, query=query, target_category=target_category)
    
    if not scraped_chars:
        detail = f": {err_msg}" if err_msg else ""
        return jsonify({"error": f"Could not generate details{detail}. Please verify your GEMINI_API_KEY in .env"}), 500

    # Non-destructively merge into glossary
    glossary = load_glossary(book_id)
    added_count = 0
    updated_count = 0
    for sc in scraped_chars:
        existing = find_matching_glossary_entry(glossary, sc.get("name", ""), incoming_item=sc)
        if existing:
            merge_glossary_entry(existing, sc, query_name=sc.get("name"))
            updated_count += 1
        else:
            glossary.append(sc)
            added_count += 1
            
    save_glossary(book_id, glossary)
    return jsonify({
        "success": True,
        "added_count": added_count + updated_count,
        "characters": scraped_chars,
        "glossary": glossary
    })

# Single Character / Item / Clan Instant AI Auto-Fill & Selection Lookup
@app.route("/api/books/<book_id>/lookup-character", methods=["POST"])
def lookup_character_endpoint(book_id):
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    book_title = book.get("title", "") if book else ""

    glossary = load_glossary(book_id)

    # STEP 1: Fast check - Is this term or alias already in the glossary?
    existing = find_matching_glossary_entry(glossary, name)
    if existing:
        if data.get("add"):
            merge_glossary_entry(existing, {}, query_name=name)
            save_glossary(book_id, glossary)
            return jsonify({
                "success": True,
                "found": True,
                "already_existed": True,
                "character": existing,
                "glossary": glossary
            })
        return jsonify({
            "success": True,
            "found": True,
            "already_existed": True,
            "character": existing
        })

    # STEP 2: Query Gemini / Wiki via isolated single-entity lookup
    scraped_chars, err_msg = lookup_single_entity(name, book_title)
    if not scraped_chars and "generic" not in (err_msg or "").lower():
        raw_text, detected_cat, _ = scrape_fandom_data(name, book_title)
        scraped_chars, err_msg = sanitize_wiki_data_with_gemini(raw_text, book_title, query=name, target_category=detected_cat)

    if scraped_chars:
        char = scraped_chars[0]

        # STEP 3: Check if the AI resolved this query to an existing character/item in the glossary
        existing_resolved = find_matching_glossary_entry(glossary, name, incoming_item=char)
        if existing_resolved:
            merge_glossary_entry(existing_resolved, char, query_name=name)
            if data.get("add"):
                save_glossary(book_id, glossary)
                return jsonify({
                    "success": True,
                    "found": True,
                    "character": existing_resolved,
                    "merged_into": existing_resolved["name"],
                    "glossary": glossary
                })
            return jsonify({
                "success": True,
                "found": True,
                "character": existing_resolved,
                "merged_into": existing_resolved["name"]
            })
        else:
            # Truly new character/item/clan!
            if data.get("add"):
                if name.strip().lower() != char.get("name", "").strip().lower():
                    if name not in char.get("aliases", []):
                        char.setdefault("aliases", []).append(name)
                glossary.append(char)
                save_glossary(book_id, glossary)
                return jsonify({
                    "success": True,
                    "found": True,
                    "character": char,
                    "glossary": glossary
                })
            return jsonify({"success": True, "found": True, "character": char})

    return jsonify({"success": False, "found": False, "error": err_msg or "Unavailable in novel glossary"}), 200

def get_server_port():
    if "PORT" in os.environ:
        return int(os.environ["PORT"])
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('0.0.0.0', 5000))
        s.close()
        port = 5000
    except Exception:
        port = 5001
    os.environ["PORT"] = str(port)
    return port

if __name__ == "__main__":
    port = get_server_port()
    print(f"Starting My Library on http://127.0.0.1:{port} ...")
    print(f"Mobile PWA available on your local Wi-Fi at: http://192.168.29.98:{port}/m")
    app.run(host="0.0.0.0", port=port, debug=True)



