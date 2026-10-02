import os
import json
import re
import datetime
import html
import urllib.parse
from flask import Flask, request, jsonify, render_template, send_from_directory
from dotenv import load_dotenv

from ai_glossary import extract_characters_from_text, slugify, get_gemini_client, ai_enhance_book_metadata, is_chinese_novel, clean_entry_for_novel, CHINESE_CHAR_RE
from scraper import scrape_fandom_character_list, scrape_fandom_data, sanitize_wiki_data_with_gemini, extract_title_from_url, lookup_single_entity

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")
GLOSSARY_DIR = os.path.join(DATA_DIR, "glossary")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
TRASH_DIR = os.path.join(DATA_DIR, ".trash")
TRASH_CHAPTERS_DIR = os.path.join(TRASH_DIR, "chapters")
TRASH_BOOKS_DIR = os.path.join(TRASH_DIR, "books")
MOBILE_DIR = os.path.join(BASE_DIR, "mobile")
MOBILE_STATIC_DIR = os.path.join(MOBILE_DIR, "static")
MOBILE_TEMPLATES_DIR = os.path.join(MOBILE_DIR, "templates")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(GLOSSARY_DIR, exist_ok=True)
os.makedirs(CHAPTERS_DIR, exist_ok=True)
os.makedirs(TRASH_CHAPTERS_DIR, exist_ok=True)
os.makedirs(TRASH_BOOKS_DIR, exist_ok=True)


SUPABASE_URL = "https://giqhugtncggxansflxaz.supabase.co"
SUPABASE_KEY = "sb_publishable_qfLGtg3uwojI-ITrA_t2ig_Wc-MpjuJ"

def push_books_to_supabase_async(books):
    import threading
    def _run():
        try:
            import requests
            url = f"{SUPABASE_URL}/rest/v1/books"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }
            payload = []
            for b in books:
                bid = b.get("id")
                if not bid:
                    continue
                ch_dir = os.path.join(CHAPTERS_DIR, bid)
                actual_ch_count = 0
                if os.path.exists(ch_dir):
                    ch_files = [f for f in os.listdir(ch_dir) if f.endswith(".json")]
                    actual_ch_count = len(ch_files)
                last_read_at = b.get("last_read_at")
                if last_read_at and ("T" not in str(last_read_at) or len(str(last_read_at)) < 10):
                    last_read_at = None
                row = {
                    "id": bid,
                    "title": b.get("title", "Untitled"),
                    "author": b.get("author", "Unknown"),
                    "genre": b.get("genre", ""),
                    "total_chapters": actual_ch_count or b.get("chapters_count") or 0,
                    "word_count": b.get("total_words") or 0,
                    "cover_image": b.get("cover") or b.get("cover_image") or "",
                    "last_read_chapter": b.get("last_read_chapter") or 1,
                    "last_read_at": last_read_at,
                    "bookmark": b.get("bookmark") or None,
                    "enable_glossary": b.get("enable_glossary", True)
                }
                payload.append(row)
            if payload:
                requests.post(url, headers=headers, json=payload, timeout=6)
        except Exception as e:
            print(f"Background Supabase books push notice: {e}")
    threading.Thread(target=_run, daemon=True).start()

def push_chapters_to_supabase_async(book_id):
    import threading
    def _run():
        try:
            import sys
            scripts_path = os.path.join(BASE_DIR, "scripts")
            if scripts_path not in sys.path:
                sys.path.insert(0, scripts_path)
            from sync_to_supabase import sync_chapters
            sync_chapters(book_id)
        except Exception as e:
            print(f"Background Supabase chapters push notice: {e}")
    threading.Thread(target=_run, daemon=True).start()

def load_books():
    if not os.path.exists(BOOKS_FILE):
        return []
    with open(BOOKS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_books(books):
    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2, ensure_ascii=False)
    push_books_to_supabase_async(books)

def resolve_glossary_book_id(book_id):
    books = load_books()
    book = next((b for b in books if b.get("id") == book_id), None)
    if book and book.get("shared_glossary_id"):
        return book["shared_glossary_id"]
    return book_id

def get_glossary_file(book_id):
    target_id = resolve_glossary_book_id(book_id)
    return os.path.join(GLOSSARY_DIR, f"{target_id}.json")

CANONICAL_CATEGORIES = [
    "Character",
    "Race / Creature",
    "Weapon / Item",
    "Clan / Sect",
    "Location / Realm",
    "Concept / Lore",
]

CATEGORY_NORMALIZATION_MAP = {
    "character": "Character",
    "race / creature": "Race / Creature",
    "race/creature": "Race / Creature",
    "race": "Race / Creature",
    "creature": "Race / Creature",
    "species": "Race / Creature",
    "animal": "Race / Creature",
    "beast": "Race / Creature",
    "monster": "Race / Creature",
    "spiritual beast": "Race / Creature",
    "demonic beast": "Race / Creature",
    "spirit beast": "Race / Creature",
    "demon": "Race / Creature",
    "beasts": "Race / Creature",
    "creatures": "Race / Creature",
    "monsters": "Race / Creature",
    "races": "Race / Creature",
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

    books = load_books()
    book = next((b for b in books if b.get("id") == book_id), None)
    is_chinese = is_chinese_novel(book.get("title", ""), book.get("genre", "")) if book else False

    # Normalize entries: ensure affiliation, category, and merge pinyin_or_chinese into aliases
    for entry in data:
        entry["category"] = normalize_category(entry.get("category"))
        if not entry.get("affiliation"):
            entry["affiliation"] = entry.get("sect_or_affiliation", "")
        if not entry.get("sect_or_affiliation"):
            entry["sect_or_affiliation"] = entry.get("affiliation", "")
        
        clean_entry_for_novel(entry, is_chinese=is_chinese)

        if is_chinese:
            pinyin = (entry.get("pinyin_or_chinese") or "").strip()
            if pinyin and pinyin.lower() not in ["n/a", "none", "null"]:
                aliases = entry.get("aliases", [])
                if not isinstance(aliases, list):
                    aliases = [aliases] if aliases else []
                aliases_lower = [a.lower() for a in aliases if isinstance(a, str)]
                if pinyin.lower() not in aliases_lower and pinyin.lower() != entry.get("name", "").lower():
                    aliases.append(pinyin)
                entry["aliases"] = aliases
    return data

SUPABASE_URL = "https://giqhugtncggxansflxaz.supabase.co"
SUPABASE_KEY = "sb_publishable_qfLGtg3uwojI-ITrA_t2ig_Wc-MpjuJ"

def push_glossary_to_supabase_async(book_id, entries):
    import threading
    def _run():
        try:
            import requests
            url = f"{SUPABASE_URL}/rest/v1/glossary"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }
            payload = []
            for item in entries:
                gid = item.get("id") or item.get("name", "").lower().strip().replace(" ", "-")
                if not gid:
                    continue
                aliases = item.get("aliases") or []
                if isinstance(aliases, str):
                    aliases = [a.strip() for a in aliases.split(",") if a.strip()]
                payload.append({
                    "book_id": book_id,
                    "id": gid,
                    "name": item.get("name", ""),
                    "category": item.get("category", "Character"),
                    "pinyin_or_chinese": item.get("pinyin_or_chinese", ""),
                    "aliases": aliases,
                    "affiliation": item.get("affiliation") or item.get("sect_or_affiliation", ""),
                    "sect_or_affiliation": item.get("sect_or_affiliation") or item.get("affiliation", ""),
                    "summary": item.get("summary", ""),
                    "mentions": int(item.get("mentions") or 0)
                })
            if payload:
                requests.post(url, headers=headers, json=payload, timeout=6)
        except Exception as e:
            print(f"Background Supabase push notice: {e}")
    threading.Thread(target=_run, daemon=True).start()

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

    books = load_books()
    book = next((b for b in books if b.get("id") == book_id), None)
    is_chinese = is_chinese_novel(book.get("title", ""), book.get("genre", "")) if book else False

    # 2. Clean, deduplicate and save
    seen_ids = set()
    cleaned_glossary = []
    for entry in glossary:
        entry["category"] = normalize_category(entry.get("category"))
        if not entry.get("affiliation"):
            entry["affiliation"] = entry.get("sect_or_affiliation", "")
        if not entry.get("sect_or_affiliation"):
            entry["sect_or_affiliation"] = entry.get("affiliation", "")
        
        clean_entry_for_novel(entry, is_chinese=is_chinese)

        # Deduplicate aliases and include pinyin only if Chinese
        raw_aliases = entry.get("aliases", [])
        if not isinstance(raw_aliases, list):
            raw_aliases = [raw_aliases] if raw_aliases else []
        
        if is_chinese:
            pinyin = (entry.get("pinyin_or_chinese") or "").strip()
            if pinyin and pinyin.lower() not in ["n/a", "none", "null"]:
                raw_aliases.append(pinyin)

        clean_aliases = []
        seen_lower = set()
        primary_lower = entry.get("name", "").strip().lower()
        for a in raw_aliases:
            if isinstance(a, str) and a.strip():
                a_str = a.strip()
                a_low = a_str.lower()
                if a_low in ["n/a", "none", "null"]:
                    continue
                if not is_chinese and (CHINESE_CHAR_RE.search(a_str) or a_low == "xīfāng fēnqū"):
                    continue
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

    push_glossary_to_supabase_async(book_id, cleaned_glossary)

def sanitize_html(raw_html):
    if not raw_html:
        return ""
    cleaned = re.sub(r'<font[^>]*>', '', raw_html, flags=re.IGNORECASE)
    cleaned = re.sub(r'</font>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*style\s*=\s*(["\'][^"\']*["\']|[^\s>]+)', '', cleaned, flags=re.IGNORECASE)
    def clean_class(m):
        val = m.group(0)
        if "reader-image" in val:
            return val
        return ""
    cleaned = re.sub(r'\s*class\s*=\s*(["\'][^"\']*["\']|[^\s>]+)', clean_class, cleaned, flags=re.IGNORECASE)
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

@app.route("/api/sync-supabase", methods=["POST"])
def sync_supabase_endpoint():
    try:
        import requests
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        books = load_books()
        synced_glossary = 0
        for b in books:
            bid = b["id"]
            res = requests.get(f"{SUPABASE_URL}/rest/v1/glossary?book_id=eq.{bid}", headers=headers, timeout=6)
            if res.ok:
                remote_entries = res.json()
                if remote_entries:
                    save_glossary(bid, remote_entries)
                    synced_glossary += len(remote_entries)

        # Pull book progress
        res_books = requests.get(f"{SUPABASE_URL}/rest/v1/books", headers=headers, timeout=6)
        if res_books.ok:
            remote_books = res_books.json()
            local_books = load_books()
            book_map = {rb["id"]: rb for rb in remote_books}
            for lb in local_books:
                if lb["id"] in book_map:
                    rb = book_map[lb["id"]]
                    if rb.get("last_read_chapter"):
                        lb["last_read_chapter"] = rb["last_read_chapter"]
                    if rb.get("bookmark"):
                        lb["bookmark"] = rb["bookmark"]
                    if rb.get("last_read_at"):
                        lb["last_read_at"] = rb["last_read_at"]
            save_books(local_books)

        # Background sync of books and chapters to Supabase
        def _bg_push():
            try:
                import sys
                scripts_path = os.path.join(BASE_DIR, "scripts")
                if scripts_path not in sys.path:
                    sys.path.insert(0, scripts_path)
                from sync_to_supabase import sync_books as push_all_books, sync_chapters as push_all_chapters
                push_all_books()
                push_all_chapters()
            except Exception as ex:
                print(f"Background Supabase full push notice: {ex}")
        import threading
        threading.Thread(target=_bg_push, daemon=True).start()

        return jsonify({
            "success": True,
            "message": "Synced with Supabase successfully",
            "synced_glossary_entries": synced_glossary
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Books CRUD
@app.route("/api/books", methods=["GET"])
def list_books():
    books = load_books()
    # Enrich with chapter counts and total words
    for book in books:
        book.setdefault("enable_glossary", True)
        book.setdefault("cover", "")
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
        "enable_glossary": bool(data.get("enable_glossary", True)),
        "cover": data.get("cover", "")
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
    if "last_read_at" in data:
        book["last_read_at"] = data["last_read_at"]
    if "bookmark" in data:
        book["bookmark"] = data["bookmark"]
    if "enable_glossary" in data:
        book["enable_glossary"] = bool(data["enable_glossary"])
    if "cover" in data:
        book["cover"] = data["cover"]
    
    save_books(books)
    return jsonify(book)

@app.route("/api/books/<book_id>/glossary-link", methods=["GET"])
def get_glossary_link_info(book_id):
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    if not curr_book:
        return jsonify({"error": "Book not found"}), 404

    shared_id = curr_book.get("shared_glossary_id")
    linked_books = []
    if shared_id:
        linked_books = [b for b in books if b.get("shared_glossary_id") == shared_id]

    curr_g_count = len(load_glossary(book_id))

    all_other_books = []
    for b in books:
        if b["id"] == book_id:
            continue
        # Requirement 5: Do not allow books with glossary toggled off to be linked
        if b.get("enable_glossary") is False:
            continue

        g_count = len(load_glossary(b["id"]))
        b_shared = b.get("shared_glossary_id")
        is_linked = bool(shared_id and b_shared == shared_id)

        # Requirement 4: Zero-entry rule - only allow a book to join an existing glossary if it has 0 entries
        can_link = True
        if not is_linked and curr_g_count > 0 and g_count > 0:
            can_link = False

        other_linked_titles = []
        if b_shared:
            other_linked_titles = [ob.get("title", "Untitled") for ob in books if ob["id"] != b["id"] and ob.get("shared_glossary_id") == b_shared]

        all_other_books.append({
            "id": b["id"],
            "title": b.get("title", "Untitled"),
            "author": b.get("author", "Unknown"),
            "genre": b.get("genre", ""),
            "color": b.get("color", "#ba6d78"),
            "chapters_count": b.get("chapters_count", 0),
            "glossary_count": g_count,
            "is_linked": is_linked,
            "can_link": can_link,
            "shared_glossary_id": b_shared,
            "shared_with_titles": other_linked_titles
        })

    return jsonify({
        "current_book": {
            "id": curr_book["id"],
            "title": curr_book.get("title", ""),
            "shared_glossary_id": shared_id,
            "glossary_count": curr_g_count
        },
        "is_shared": bool(shared_id and len(linked_books) > 1),
        "linked_books": [{"id": lb["id"], "title": lb.get("title", "")} for lb in linked_books],
        "all_other_books": all_other_books
    })

@app.route("/api/books/<book_id>/glossary-link", methods=["POST"])
def update_glossary_link(book_id):
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    if not curr_book:
        return jsonify({"error": "Book not found"}), 404

    data = request.json or {}
    unlink_requested = bool(data.get("unlink", False))

    if unlink_requested:
        old_shared_id = curr_book.get("shared_glossary_id")
        if not old_shared_id:
            return jsonify({"success": True, "message": "Book is already independent."})

        # Save copy of current shared glossary to own file
        current_shared_data = load_glossary(book_id)
        own_file = os.path.join(GLOSSARY_DIR, f"{book_id}.json")
        with open(own_file, "w", encoding="utf-8") as f:
            json.dump(current_shared_data, f, indent=2, ensure_ascii=False)

        curr_book.pop("shared_glossary_id", None)

        remaining_books = [b for b in books if b.get("shared_glossary_id") == old_shared_id and b["id"] != book_id]
        if len(remaining_books) <= 1:
            for rb in remaining_books:
                rb.pop("shared_glossary_id", None)
        elif old_shared_id == book_id and remaining_books:
            new_canonical = remaining_books[0]["id"]
            new_file = os.path.join(GLOSSARY_DIR, f"{new_canonical}.json")
            with open(new_file, "w", encoding="utf-8") as f:
                json.dump(current_shared_data, f, indent=2, ensure_ascii=False)
            for rb in remaining_books:
                rb["shared_glossary_id"] = new_canonical

        save_books(books)
        return jsonify({"success": True, "unlinked": True})

    target_book_ids = data.get("target_book_ids", [])
    if not isinstance(target_book_ids, list):
        target_book_ids = []

    if not target_book_ids:
        # User deselected everything -> unlink
        data["unlink"] = True
        return update_glossary_link(book_id)

    # Cluster of books to link
    cluster_ids = set(target_book_ids) | {book_id}
    for b in books:
        if b["id"] in cluster_ids and b.get("shared_glossary_id"):
            for ob in books:
                if ob.get("shared_glossary_id") == b["shared_glossary_id"]:
                    cluster_ids.add(ob["id"])

    # Requirement 4: Enforce zero-entry rule for joining existing glossaries
    existing_non_empty = [bid for bid in cluster_ids if len(load_glossary(bid)) > 0]
    distinct_sources = set()
    for bid in existing_non_empty:
        b_obj = next((b for b in books if b["id"] == bid), None)
        distinct_sources.add(b_obj.get("shared_glossary_id") or bid if b_obj else bid)
    if len(distinct_sources) > 1:
        return jsonify({
            "error": "Cannot link books that both have existing lore entries. A book can only join an existing glossary if it has 0 entries."
        }), 400

    canonical_id = None
    for b in books:
        if b["id"] in cluster_ids and b.get("shared_glossary_id"):
            canonical_id = b["shared_glossary_id"]
            break
    if not canonical_id:
        canonical_id = book_id

    # Non-destructively merge glossaries
    master_glossary = []
    canonical_raw_path = os.path.join(GLOSSARY_DIR, f"{canonical_id}.json")
    if os.path.exists(canonical_raw_path):
        try:
            with open(canonical_raw_path, "r", encoding="utf-8") as f:
                master_glossary = json.load(f)
        except Exception:
            master_glossary = []

    for bid in cluster_ids:
        if bid == canonical_id:
            continue
        bid_path = os.path.join(GLOSSARY_DIR, f"{bid}.json")
        if os.path.exists(bid_path):
            try:
                with open(bid_path, "r", encoding="utf-8") as f:
                    incoming_entries = json.load(f)
                for inc in incoming_entries:
                    inc_name = inc.get("name", "")
                    if not inc_name:
                        continue
                    match = find_matching_glossary_entry(master_glossary, inc_name, incoming_item=inc)
                    if match:
                        merge_glossary_entry(match, inc, query_name=inc_name)
                    else:
                        master_glossary.append(inc)
            except Exception as e:
                print(f"Error merging glossary from {bid}: {e}")

    save_glossary(canonical_id, master_glossary)

    # Set shared_glossary_id for all cluster books
    for b in books:
        if b["id"] in cluster_ids:
            b["shared_glossary_id"] = canonical_id

    save_books(books)

    return jsonify({
        "success": True,
        "shared_glossary_id": canonical_id,
        "linked_count": len(cluster_ids),
        "glossary_count": len(master_glossary)
    })

@app.route("/api/books/<book_id>", methods=["DELETE"])
def delete_book(book_id):
    books = load_books()
    deleted_book = next((b for b in books if b["id"] == book_id), None)
    books = [b for b in books if b["id"] != book_id]

    if deleted_book and deleted_book.get("shared_glossary_id"):
        shared_id = deleted_book["shared_glossary_id"]
        remaining_shared = [b for b in books if b.get("shared_glossary_id") == shared_id]
        if len(remaining_shared) <= 1:
            for rb in remaining_shared:
                rb.pop("shared_glossary_id", None)
        elif shared_id == book_id and remaining_shared:
            new_id = remaining_shared[0]["id"]
            old_file = os.path.join(GLOSSARY_DIR, f"{book_id}.json")
            new_file = os.path.join(GLOSSARY_DIR, f"{new_id}.json")
            if os.path.exists(old_file):
                import shutil
                shutil.copyfile(old_file, new_file)
            for rb in remaining_shared:
                rb["shared_glossary_id"] = new_id

    # Soft delete: archive book into data/.trash/books/
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    book_trash_target = os.path.join(TRASH_BOOKS_DIR, f"{timestamp}_{book_id}")
    os.makedirs(book_trash_target, exist_ok=True)

    if deleted_book:
        try:
            with open(os.path.join(book_trash_target, "book_meta.json"), "w", encoding="utf-8") as f:
                json.dump(deleted_book, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error archiving book metadata in trash: {e}")

    # Copy/move glossary into trash
    own_glossary_file = os.path.join(GLOSSARY_DIR, f"{book_id}.json")
    if os.path.exists(own_glossary_file):
        try:
            import shutil
            shutil.copy2(own_glossary_file, os.path.join(book_trash_target, "glossary.json"))
            if not (deleted_book and deleted_book.get("shared_glossary_id")):
                os.remove(own_glossary_file)
        except Exception as e:
            print(f"Error preserving glossary in trash: {e}")

    # Move chapters directory into trash
    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    if os.path.exists(ch_dir):
        try:
            import shutil
            target_chapters = os.path.join(book_trash_target, "chapters")
            shutil.move(ch_dir, target_chapters)
        except Exception as e:
            print(f"Error moving chapters to trash: {e}")

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

    auto_detect_ai = request.form.get("auto_detect_ai", "true").lower() in ["true", "1", "yes"]
    user_enable_glossary = request.form.get("enable_glossary")

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

            # Raw OPF metadata
            title_el = opf_root.find(".//{*}title")
            raw_title = (title_el.text or "").strip() if title_el is not None else ""
            if not raw_title:
                raw_title = os.path.splitext(filename)[0].replace("_", " ").title()

            creator_el = opf_root.find(".//{*}creator")
            raw_author = (creator_el.text or "").strip() if creator_el is not None else "Unknown Author"

            desc_el = opf_root.find(".//{*}description")
            raw_description = (desc_el.text or "").strip() if desc_el is not None else ""

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
            # Recursive Hierarchical TOC Extraction (EPUB2 NCX & EPUB3 Nav)
            # Produces ordered list of: (src_with_fragment, full_hierarchical_title)
            # ---------------------------------------------------------------
            toc_entries = []

            # 1. Try toc.ncx
            toc_ncx_id = None
            for item_id, item_data in manifest.items():
                if item_data.get("media-type") == "application/x-dtbncx+xml" or item_data.get("href", "").endswith(".ncx"):
                    toc_ncx_id = item_id
                    break
            spine_el = opf_root.find(".//{*}spine")
            if not toc_ncx_id and spine_el is not None and "toc" in spine_el.attrib:
                toc_ncx_id = spine_el.attrib["toc"]

            if toc_ncx_id and toc_ncx_id in manifest:
                ncx_href = manifest[toc_ncx_id]["href"]
                ncx_full = os.path.normpath(os.path.join(opf_dir, ncx_href))
                try:
                    ncx_root = ET.fromstring(z.read(ncx_full))
                    def parse_nav_points(node, parent_title=""):
                        res = []
                        for np in node.findall("{*}navPoint"):
                            lbl_el = np.find("{*}navLabel/{*}text")
                            cnt_el = np.find("{*}content")
                            lbl = (lbl_el.text or "").strip() if lbl_el is not None else ""
                            src = cnt_el.attrib.get("src", "") if cnt_el is not None else ""
                            children = np.findall("{*}navPoint")
                            full_t = f"{parent_title} - {lbl}" if parent_title and lbl else (lbl or parent_title)
                            if children:
                                res.extend(parse_nav_points(np, parent_title=lbl or parent_title))
                            elif src:
                                res.append((src, full_t))
                        return res
                    nav_map = ncx_root.find(".//{*}navMap")
                    if nav_map is not None:
                        toc_entries = parse_nav_points(nav_map)
                except Exception:
                    pass

            # 2. Try EPUB3 nav.xhtml if NCX yielded nothing
            if not toc_entries:
                for item_id, item_data in manifest.items():
                    props = item_data.get("properties", "")
                    if "nav" in props or item_data.get("href", "").endswith("nav.xhtml"):
                        nav_href = item_data.get("href", "")
                        nav_full = os.path.normpath(os.path.join(opf_dir, nav_href))
                        try:
                            nav_content = z.read(nav_full).decode("utf-8", errors="ignore")
                            nav_soup = bs4.BeautifulSoup(nav_content, "html.parser")
                            toc_nav = nav_soup.find("nav", attrs={"epub:type": "toc"}) or nav_soup.find("nav")
                            if toc_nav:
                                def parse_nav_ol(ol_node, parent_title=""):
                                    res = []
                                    for li in ol_node.find_all("li", recursive=False):
                                        a = li.find("a", href=True)
                                        child_ol = li.find("ol")
                                        text = a.get_text(strip=True) if a else ""
                                        src = a["href"] if a else ""
                                        full_t = f"{parent_title} - {text}" if parent_title and text else (text or parent_title)
                                        if child_ol:
                                            res.extend(parse_nav_ol(child_ol, parent_title=text or parent_title))
                                        elif src:
                                            res.append((src, full_t))
                                    return res
                                top_ol = toc_nav.find("ol")
                                if top_ol:
                                    toc_entries = parse_nav_ol(top_ol)
                        except Exception:
                            pass
                        if toc_entries:
                            break

            # ---------------------------------------------------------------
            # Discover and Map Images in EPUB
            # ---------------------------------------------------------------
            image_lookup = {}
            epub_images_to_extract = {}
            for n in z.namelist():
                norm_n = os.path.normpath(n)
                if any(norm_n.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]):
                    safe_name = norm_n.replace("/", "_").replace("\\", "_")
                    epub_images_to_extract[safe_name] = n
                    image_lookup[norm_n] = safe_name
                    image_lookup[os.path.basename(norm_n)] = safe_name
                    if opf_dir:
                        try:
                            rel_opf = os.path.relpath(norm_n, opf_dir)
                            image_lookup[rel_opf] = safe_name
                        except Exception:
                            pass

            for item in manifest.values():
                mtype = item.get("media-type", "").lower()
                if mtype.startswith("image/"):
                    href = item.get("href", "")
                    norm_href = os.path.normpath(os.path.join(opf_dir, href))
                    safe_name = norm_href.replace("/", "_").replace("\\", "_")
                    if norm_href in z.namelist():
                        epub_images_to_extract[safe_name] = norm_href
                        image_lookup[norm_href] = safe_name
                        image_lookup[href] = safe_name
                        image_lookup[os.path.basename(href)] = safe_name

            # ---------------------------------------------------------------
            # Helper to extract clean HTML paragraphs, blockquotes, headings,
            # and images, preserving italics (<em>, <i>), bold (<strong>, <b>),
            # blockquotes, line breaks, images, and all inter-word whitespace.
            # ---------------------------------------------------------------
            ALLOWED_INLINE_TAGS = {"em", "i", "strong", "b", "u", "s", "strike", "del", "sub", "sup", "br", "img"}

            def clean_element_to_html(el_tag, current_file_dir):
                if not el_tag:
                    return ""

                # Standalone image or svg
                if el_tag.name in ["img", "image"]:
                    src = el_tag.get("src") or el_tag.get("xlink:href") or el_tag.get("href") or ""
                    src_clean = urllib.parse.unquote(src.split("#")[0].split("?")[0])
                    c1 = os.path.normpath(os.path.join(current_file_dir, src_clean))
                    c2 = os.path.normpath(src_clean)
                    c3 = os.path.basename(src_clean)
                    matched = image_lookup.get(c1) or image_lookup.get(c2) or image_lookup.get(c3)
                    if matched:
                        alt = el_tag.get("alt", "").strip() or "Illustration"
                        return f'<p class="reader-image-wrap"><img src="/api/books/__BOOK_ID__/images/{matched}" alt="{html.escape(alt)}" class="reader-image" loading="lazy"/></p>'
                    return ""

                if el_tag.name == "svg":
                    img_node = el_tag.find(["image", "img"])
                    if img_node:
                        src = img_node.get("src") or img_node.get("xlink:href") or img_node.get("href") or ""
                        src_clean = urllib.parse.unquote(src.split("#")[0].split("?")[0])
                        c1 = os.path.normpath(os.path.join(current_file_dir, src_clean))
                        c2 = os.path.normpath(src_clean)
                        c3 = os.path.basename(src_clean)
                        matched = image_lookup.get(c1) or image_lookup.get(c2) or image_lookup.get(c3)
                        if matched:
                            alt = img_node.get("alt", "").strip() or "Illustration"
                            return f'<p class="reader-image-wrap"><img src="/api/books/__BOOK_ID__/images/{matched}" alt="{html.escape(alt)}" class="reader-image" loading="lazy"/></p>'
                    return ""

                clone = bs4.BeautifulSoup(str(el_tag), "html.parser").find(el_tag.name)
                if not clone:
                    return ""

                for img in clone.find_all(["img", "image"]):
                    src = img.get("src") or img.get("xlink:href") or img.get("href") or ""
                    src_clean = urllib.parse.unquote(src.split("#")[0].split("?")[0])
                    c1 = os.path.normpath(os.path.join(current_file_dir, src_clean))
                    c2 = os.path.normpath(src_clean)
                    c3 = os.path.basename(src_clean)
                    matched = image_lookup.get(c1) or image_lookup.get(c2) or image_lookup.get(c3)
                    if matched:
                        alt = img.get("alt", "").strip() or "Illustration"
                        img.name = "img"
                        img.attrs = {
                            "src": f"/api/books/__BOOK_ID__/images/{matched}",
                            "alt": alt,
                            "class": "reader-image",
                            "loading": "lazy"
                        }
                    else:
                        img.decompose()

                for tag in clone.find_all(True):
                    tag_name = tag.name.lower()
                    if tag_name == "img":
                        continue
                    elif tag_name in ALLOWED_INLINE_TAGS:
                        tag.attrs = {}
                        if tag_name == "i":
                            tag.name = "em"
                        elif tag_name == "b":
                            tag.name = "strong"
                        elif tag_name in ["strike", "del"]:
                            tag.name = "s"
                    elif tag_name in ["a", "span", "small", "cite", "abbr"]:
                        tag.unwrap()
                    else:
                        tag.unwrap()

                inner = "".join(str(c) for c in clone.contents)
                inner = re.sub(r'[\r\n\t]+', ' ', inner)
                inner = re.sub(r'  +', ' ', inner).strip()

                if not inner:
                    return ""

                if el_tag.name == "blockquote":
                    return f"<blockquote><p>{inner}</p></blockquote>"
                elif el_tag.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                    return f"<h3>{inner}</h3>"
                elif "<img " in inner:
                    return f'<p class="reader-image-wrap">{inner}</p>'
                else:
                    return f"<p>{inner}</p>"

            def extract_clean_html_parts(elements, current_file_dir):
                parts = []
                seen_nodes = set()
                for el in elements:
                    if el in seen_nodes:
                        continue
                    tag_name = getattr(el, "name", None)
                    if not tag_name:
                        continue
                    if tag_name in ["p", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "figure"]:
                        for d in el.descendants:
                            seen_nodes.add(d)
                        cleaned = clean_element_to_html(el, current_file_dir)
                        if cleaned:
                            parts.append(cleaned)
                    elif tag_name in ["img", "svg"]:
                        cleaned = clean_element_to_html(el, current_file_dir)
                        if cleaned:
                            parts.append(cleaned)
                    elif tag_name in ["div", "section"]:
                        if not el.find(["p", "div", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "figure"]):
                            for d in el.descendants:
                                seen_nodes.add(d)
                            cleaned = clean_element_to_html(el, current_file_dir)
                            if cleaned:
                                parts.append(cleaned)
                return parts

            # ---------------------------------------------------------------
            # Prepare Chapter Ingestion
            # ---------------------------------------------------------------
            # Map normalized file path -> list of (anchor_id, full_title)
            file_toc_map = {}
            for src, ch_title in toc_entries:
                f_part = src.split("#")[0]
                a_part = src.split("#")[1] if "#" in src else None
                norm_f = os.path.normpath(os.path.join(opf_dir, f_part))
                if norm_f not in file_toc_map:
                    file_toc_map[norm_f] = []
                file_toc_map[norm_f].append((a_part, ch_title))

            spine_files = []
            for itemref in spine:
                if itemref in manifest:
                    href = manifest[itemref]["href"]
                    spine_files.append(os.path.normpath(os.path.join(opf_dir, href)))

            raw_chapters = []  # list of (title, html_content, word_count)
            first_sample_paragraphs = []

            for sf in spine_files:
                try:
                    raw_html = z.read(sf).decode("utf-8", errors="ignore")
                except Exception:
                    continue

                soup = bs4.BeautifulSoup(raw_html, "html.parser")
                for unwanted in soup(["script", "style", "nav", "noscript"]):
                    unwanted.decompose()
                body = soup.find("body") or soup

                entries = file_toc_map.get(sf, [])
                has_anchors = any(a for a, t in entries)
                sf_dir = os.path.dirname(sf)

                if entries and has_anchors:
                    # Multi-anchor or anchor-targeted file: locate DOM anchor positions
                    all_desc = list(body.descendants)
                    anchor_positions = []
                    for a_id, ch_t in entries:
                        if not a_id:
                            anchor_positions.append((0, ch_t))
                            continue
                        node = soup.find(id=a_id) or soup.find(attrs={"name": a_id})
                        if node:
                            try:
                                pos = all_desc.index(node)
                                anchor_positions.append((pos, ch_t))
                            except ValueError:
                                pass

                    anchor_positions.sort(key=lambda x: x[0])
                    for i, (pos, ch_t) in enumerate(anchor_positions):
                        next_pos = anchor_positions[i + 1][0] if i + 1 < len(anchor_positions) else len(all_desc)
                        segment = all_desc[pos:next_pos]
                        parts = extract_clean_html_parts(segment, sf_dir)
                        if parts:
                            ch_html = "\n".join(parts)
                            w_cnt = count_words(ch_html)
                            raw_chapters.append((ch_t, ch_html, w_cnt))
                            if not first_sample_paragraphs:
                                first_sample_paragraphs = parts[:4]
                else:
                    # Single chapter file or spine item
                    parts = extract_clean_html_parts(body.find_all(["p", "blockquote", "h1", "h2", "h3", "h4", "div", "figure", "img", "svg"]), sf_dir)
                    if not parts:
                        lines = [ln.strip() for ln in body.get_text().splitlines() if ln.strip()]
                        parts = [f"<p>{html.escape(ln)}</p>" for ln in lines]

                    if parts:
                        ch_title = entries[0][1] if entries else None
                        if not ch_title:
                            heading = body.find(["h1", "h2", "h3"])
                            if heading and heading.get_text(strip=True):
                                ch_title = heading.get_text(strip=True)
                            else:
                                ch_title = f"Chapter {len(raw_chapters) + 1}"
                        ch_html = "\n".join(parts)
                        w_cnt = count_words(ch_html)
                        raw_chapters.append((ch_title, ch_html, w_cnt))
                        if not first_sample_paragraphs:
                            first_sample_paragraphs = parts[:4]

            if not raw_chapters:
                return jsonify({"error": "No readable chapter text could be extracted from this EPUB."}), 400

            # ---------------------------------------------------------------
            # Smart AI Metadata Enhancement
            # ---------------------------------------------------------------
            sample_text = " ".join(re.sub(r'<[^>]+>', '', p) for p in first_sample_paragraphs)
            if auto_detect_ai:
                enhanced_meta = ai_enhance_book_metadata(
                    raw_title=raw_title,
                    raw_author=raw_author,
                    raw_description=raw_description,
                    sample_text=sample_text
                )
                final_title = enhanced_meta["title"]
                final_author = enhanced_meta["author"]
                final_genre = enhanced_meta["genre"]
                final_desc = enhanced_meta["description"]
                final_glossary = enhanced_meta["enable_glossary"]
            else:
                fallback_title = re.sub(r'\s*[-_:]\s*(retail|scan|ocr|hocr|pdf|epub|worldfreebooks.*)\b.*$', '', raw_title, flags=re.IGNORECASE).strip()
                fallback_title = re.sub(r'\s*\(retail\)\s*$', '', fallback_title, flags=re.IGNORECASE).strip()
                fallback_title = re.sub(r'[:]\s*Being the\s+.*$', '', fallback_title, flags=re.IGNORECASE).strip()
                final_title = fallback_title or "Imported Novel"
                final_author = raw_author or "Unknown Author"
                final_genre = "Web Novel"
                final_desc = raw_description
                final_glossary = True

            if user_enable_glossary is not None:
                final_glossary = user_enable_glossary.lower() in ["true", "1", "yes"]

            # ---------------------------------------------------------------
            # Persist Book & Chapters (including extracted images)
            # ---------------------------------------------------------------
            books = load_books()
            base_id = slugify(final_title) or "imported-novel"
            book_id = base_id
            existing_ids = {b["id"] for b in books}
            counter = 1
            while book_id in existing_ids:
                book_id = f"{base_id}-{counter}"
                counter += 1

            book_chapters_dir = os.path.join(CHAPTERS_DIR, book_id)
            os.makedirs(book_chapters_dir, exist_ok=True)
            images_dir = os.path.join(book_chapters_dir, "images")
            os.makedirs(images_dir, exist_ok=True)

            for safe_name, zip_path in epub_images_to_extract.items():
                try:
                    with open(os.path.join(images_dir, safe_name), "wb") as f_img:
                        f_img.write(z.read(zip_path))
                except Exception:
                    pass

            save_glossary(book_id, [])

            total_words = 0
            for idx, (ch_t, ch_content, w_cnt) in enumerate(raw_chapters, start=1):
                final_content = ch_content.replace("__BOOK_ID__", book_id)
                final_w_cnt = count_words(final_content)
                total_words += final_w_cnt
                ch_data = {
                    "chapter_number": idx,
                    "title": ch_t or f"Chapter {idx}",
                    "content": final_content,
                    "word_count": final_w_cnt,
                    "created_at": datetime.datetime.now().strftime("%d/%m/%Y")
                }
                ch_file = os.path.join(book_chapters_dir, f"{idx}.json")
                with open(ch_file, "w", encoding="utf-8") as f:
                    json.dump(ch_data, f, indent=2, ensure_ascii=False)

            palette = ["#ba6d78", "#5c8672", "#c4884d", "#647b9a", "#8c6b96"]
            color = palette[len(books) % len(palette)]
            today_str = datetime.datetime.now().strftime("%d/%m/%Y")

            new_book = {
                "id": book_id,
                "title": final_title,
                "author": final_author,
                "genre": final_genre,
                "description": final_desc,
                "color": color,
                "created_at": today_str,
                "last_read_chapter": 1,
                "last_chapter": 1,
                "chapters_count": len(raw_chapters),
                "total_words": total_words,
                "enable_glossary": final_glossary
            }

            books.append(new_book)
            save_books(books)
            push_chapters_to_supabase_async(book_id)

            return jsonify({
                "success": True,
                "book": new_book,
                "chapters_count": len(raw_chapters)
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

# Book Images
@app.route("/api/books/<book_id>/images/<path:filename>")
def get_book_image(book_id, filename):
    img_dir = os.path.join(CHAPTERS_DIR, book_id, "images")
    if not os.path.exists(os.path.join(img_dir, filename)):
        return jsonify({"error": "Image not found"}), 404
    return send_from_directory(img_dir, filename)

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

    # Update last_read_chapter and last_read_at when reading a chapter
    try:
        books = load_books()
        modified = False
        for b in books:
            if b.get("id") == book_id:
                b["last_read_chapter"] = ch_num
                b["last_read_at"] = datetime.datetime.now().isoformat()
                modified = True
                break
        if modified:
            save_books(books)
    except Exception as e:
        pass

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
    push_chapters_to_supabase_async(book_id)
        
    # Run Gemini Character extraction if requested and enabled
    new_characters = []
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    glossary_enabled = curr_book.get("enable_glossary", True) if curr_book else True

    if auto_scan and content and glossary_enabled:
        glossary = load_glossary(book_id)
        # Convert HTML to raw text for AI scan
        raw_text = re.sub(r'<[^>]+>', ' ', content)
        b_title = curr_book.get("title", "") if curr_book else ""
        b_genre = curr_book.get("genre", "") if curr_book else ""
        updated_glossary, new_characters = extract_characters_from_text(raw_text, glossary, novel_title=b_title, genre=b_genre)
        save_glossary(book_id, updated_glossary)

    # Update last read / total words
    for b in books:
        if b["id"] == book_id:
            b["last_read_chapter"] = ch_num
            b["last_read_at"] = datetime.datetime.now().isoformat()
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
        # Soft delete: move to data/.trash/chapters/<book_id>/
        book_trash_dir = os.path.join(TRASH_CHAPTERS_DIR, book_id)
        os.makedirs(book_trash_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        trash_filename = f"{timestamp}_ch_{ch_num}.json"
        trash_path = os.path.join(book_trash_dir, trash_filename)
        try:
            import shutil
            shutil.move(filepath, trash_path)
        except Exception:
            try:
                os.remove(filepath)
            except Exception:
                pass
    return jsonify({"success": True})


@app.route("/api/books/<book_id>/auto-arrange-chapters", methods=["POST"])
def auto_arrange_chapters(book_id):
    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404

    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    if not os.path.exists(ch_dir):
        return jsonify({
            "success": True,
            "changed": False,
            "chapters_count": 0,
            "message": "No chapters found."
        })

    chapter_files = [f for f in os.listdir(ch_dir) if f.endswith(".json") and f[:-5].isdigit()]
    if not chapter_files:
        return jsonify({
            "success": True,
            "changed": False,
            "chapters_count": 0,
            "message": "No chapters found."
        })

    chapters = []
    for f in chapter_files:
        try:
            with open(os.path.join(ch_dir, f), "r", encoding="utf-8") as file:
                cdata = json.load(file)
                chapters.append(cdata)
        except Exception as e:
            print(f"Error reading chapter {f}: {e}")

    chapters.sort(key=lambda x: x.get("chapter_number", 0))

    already_sequential = True
    for i, ch in enumerate(chapters, start=1):
        if ch.get("chapter_number") != i:
            already_sequential = False
            break

    if already_sequential:
        return jsonify({
            "success": True,
            "changed": False,
            "chapters_count": len(chapters),
            "message": "Chapters are already sequentially numbered."
        })

    old_to_new = {}
    updated_chapters = []
    for i, ch in enumerate(chapters, start=1):
        old_num = ch.get("chapter_number")
        new_num = i
        old_to_new[old_num] = new_num
        ch["chapter_number"] = new_num

        old_title = ch.get("title", "")
        if old_num is not None:
            new_title = re.sub(rf'^(Chapter|Ch\.?)\s+{old_num}\b', rf'\g<1> {new_num}', old_title, flags=re.IGNORECASE)
            ch["title"] = new_title

        updated_chapters.append((new_num, ch))

    for f in chapter_files:
        try:
            os.remove(os.path.join(ch_dir, f))
        except Exception as e:
            print(f"Error removing old chapter file {f}: {e}")

    for new_num, ch in updated_chapters:
        new_path = os.path.join(ch_dir, f"{new_num}.json")
        with open(new_path, "w", encoding="utf-8") as file:
            json.dump(ch, file, indent=2, ensure_ascii=False)

    book["chapters_count"] = len(updated_chapters)
    old_last_read = book.get("last_read_chapter", 1)
    if old_last_read in old_to_new:
        book["last_read_chapter"] = old_to_new[old_last_read]
    elif old_last_read > len(updated_chapters):
        book["last_read_chapter"] = len(updated_chapters)

    save_books(books)

    return jsonify({
        "success": True,
        "changed": True,
        "chapters_count": len(updated_chapters),
        "last_read_chapter": book["last_read_chapter"],
        "mapping": old_to_new,
        "message": f"Chapters successfully arranged from 1 to {len(updated_chapters)}."
    })


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

def merge_glossary_entry(existing: dict, incoming: dict, query_name: str = None, is_chinese: bool = True) -> dict:
    """
    Intelligently merges incoming character/item data into an existing entry:
    - NEVER overwrites an existing summary! Keeps the user's/existing description.
    - Merges aliases: preserves ALL existing aliases, appends query_name and any new incoming aliases.
    - Deduplicates aliases case-insensitively while preserving original casing and order.
    - Backfills pinyin or sect/affiliation if existing was blank (pinyin only for Chinese novels).
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
        if is_chinese:
            inc_pinyin = incoming.get("pinyin_or_chinese", "").strip()
            if inc_pinyin and inc_pinyin.lower() not in ["n/a", "none", "null"] and norm_alias(inc_pinyin) not in GENERIC_ALIAS_IGNORE:
                candidates.append(inc_pinyin)

    for cand in candidates:
        c_norm = norm_alias(cand)
        if not is_chinese and CHINESE_CHAR_RE.search(cand):
            continue
        if cand.strip().lower() in ["n/a", "none", "null"]:
            continue
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

    # 3. Pinyin / Chinese: Only backfill if Chinese novel and existing is empty
    if is_chinese:
        if not existing.get("pinyin_or_chinese", "").strip() and incoming and incoming.get("pinyin_or_chinese", "").strip():
            existing["pinyin_or_chinese"] = incoming["pinyin_or_chinese"].strip()
    else:
        existing["pinyin_or_chinese"] = ""

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

    clean_entry_for_novel(existing, is_chinese=is_chinese)
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

    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    is_chinese = is_chinese_novel(book.get("title", ""), book.get("genre", "")) if book else False

    # Otherwise, check if this character / alias already exists in the glossary
    existing = find_matching_glossary_entry(glossary, name, incoming_item={"name": name, "aliases": aliases})
    if existing:
        # Merge aliases into existing character without erasing existing summary
        merge_glossary_entry(existing, {"name": name, "aliases": aliases, "affiliation": affiliation, "sect_or_affiliation": affiliation, "summary": data.get("summary", ""), "category": normalize_category(data.get("category", "Character"))}, query_name=name, is_chinese=is_chinese)
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
    books = load_books()
    curr_book = next((b for b in books if b["id"] == book_id), None)
    b_title = curr_book.get("title", "") if curr_book else ""
    b_genre = curr_book.get("genre", "") if curr_book else ""
    glossary = load_glossary(book_id)
    updated_glossary, new_characters = extract_characters_from_text(raw_text, glossary, novel_title=b_title, genre=b_genre)
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
    books = load_books()
    book = next((b for b in books if b["id"] == book_id), None)
    is_chinese = is_chinese_novel(book.get("title", ""), book.get("genre", "")) if book else False

    glossary = load_glossary(book_id)
    added_count = 0
    updated_count = 0
    for sc in scraped_chars:
        clean_entry_for_novel(sc, is_chinese=is_chinese)
        existing = find_matching_glossary_entry(glossary, sc.get("name", ""), incoming_item=sc)
        if existing:
            merge_glossary_entry(existing, sc, query_name=sc.get("name"), is_chinese=is_chinese)
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
    genre = book.get("genre", "") if book else ""
    is_chinese = is_chinese_novel(book_title, genre)

    glossary = load_glossary(book_id)

    # STEP 1: Fast check - Is this term or alias already in the glossary?
    existing = find_matching_glossary_entry(glossary, name)
    if existing:
        if data.get("add"):
            merge_glossary_entry(existing, {}, query_name=name, is_chinese=is_chinese)
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
    scraped_chars, err_msg = lookup_single_entity(name, book_title, genre=genre)
    if not scraped_chars and "generic" not in (err_msg or "").lower():
        raw_text, detected_cat, _ = scrape_fandom_data(name, book_title)
        scraped_chars, err_msg = sanitize_wiki_data_with_gemini(raw_text, book_title, query=name, target_category=detected_cat, genre=genre)

    if scraped_chars:
        char = scraped_chars[0]
        clean_entry_for_novel(char, is_chinese=is_chinese)

        # STEP 3: Check if the AI resolved this query to an existing character/item in the glossary
        existing_resolved = find_matching_glossary_entry(glossary, name, incoming_item=char)
        if existing_resolved:
            merge_glossary_entry(existing_resolved, char, query_name=name, is_chinese=is_chinese)
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
                clean_entry_for_novel(char, is_chinese=is_chinese)
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



