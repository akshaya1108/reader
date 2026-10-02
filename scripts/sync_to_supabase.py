#!/usr/bin/env python3
"""
Sync local books, chapters, and glossaries to Supabase.
"""
import os
import json
import glob
import time
import requests

SUPABASE_URL = "https://giqhugtncggxansflxaz.supabase.co"
SUPABASE_KEY = "sb_publishable_qfLGtg3uwojI-ITrA_t2ig_Wc-MpjuJ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
GLOSSARY_DIR = os.path.join(DATA_DIR, "glossary")

def sync_books():
    if not os.path.exists(BOOKS_FILE):
        print("No books.json found.")
        return []
    
    with open(BOOKS_FILE, "r", encoding="utf-8") as f:
        books = json.load(f)
    
    payload = []
    for b in books:
        bid = b.get("id")
        if not bid:
            continue
        
        ch_dir = os.path.join(CHAPTERS_DIR, bid)
        actual_ch_count = 0
        actual_words = 0
        if os.path.exists(ch_dir):
            ch_files = glob.glob(os.path.join(ch_dir, "*.json"))
            actual_ch_count = len(ch_files)
        
        last_read_at = b.get("last_read_at")
        if last_read_at and ("T" not in str(last_read_at) or len(str(last_read_at)) < 10):
            last_read_at = None

        row = {
            "id": bid,
            "title": b.get("title", "Untitled"),
            "author": b.get("author", "Unknown"),
            "genre": b.get("genre", ""),
            "total_chapters": actual_ch_count or b.get("chapters_count") or b.get("total_chapters") or 0,
            "word_count": b.get("total_words") or b.get("word_count") or 0,
            "cover_image": b.get("cover") or b.get("cover_image") or "",
            "last_read_chapter": b.get("last_read_chapter") or 1,
            "last_read_at": last_read_at,
            "bookmark": b.get("bookmark") or {},
            "bookmarks": b.get("bookmarks") or [],
            "enable_glossary": bool(b.get("enable_glossary", True))
        }
        payload.append(row)
    
    res = requests.post(f"{SUPABASE_URL}/rest/v1/books", headers=HEADERS, json=payload)
    if res.status_code in (200, 201):
        print(f"Successfully synced {len(payload)} books.")
    else:
        print(f"Error syncing books ({res.status_code}): {res.text}")
    
    return [b["id"] for b in payload]

def sync_chapters(book_id):
    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    if not os.path.exists(ch_dir):
        return
    
    files = [f for f in os.listdir(ch_dir) if f.endswith(".json")]
    def sort_key(name):
        base = name.replace(".json", "")
        try:
            return (0, int(base))
        except ValueError:
            return (1, base)
    
    files.sort(key=sort_key)
    if not files:
        return

    print(f"Syncing {len(files)} chapters for '{book_id}'...")
    batch = []
    total_synced = 0
    batch_size = 15

    for f_name in files:
        f_path = os.path.join(ch_dir, f_name)
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                ch = json.load(f)
            
            try:
                num = int(f_name.replace(".json", ""))
            except ValueError:
                num = int(ch.get("chapter_number", 1))

            row = {
                "book_id": book_id,
                "chapter_number": num,
                "title": ch.get("title") or f"Chapter {num}",
                "content": ch.get("content") or "",
                "word_count": int(ch.get("word_count") or 0)
            }
            batch.append(row)

            if len(batch) >= batch_size:
                res = requests.post(f"{SUPABASE_URL}/rest/v1/chapters", headers=HEADERS, json=batch)
                if res.status_code in (200, 201):
                    total_synced += len(batch)
                else:
                    print(f"  Error on batch ({res.status_code}): {res.text[:100]}")
                batch = []
                time.sleep(0.05)
        except Exception as e:
            print(f"  Skipping {f_name}: {e}")

    if batch:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/chapters", headers=HEADERS, json=batch)
        if res.status_code in (200, 201):
            total_synced += len(batch)
        else:
            print(f"  Error on final batch ({res.status_code}): {res.text[:100]}")

    print(f"Done chapters for '{book_id}': {total_synced} uploaded.")

def sync_glossary(book_id):
    gl_path = os.path.join(GLOSSARY_DIR, f"{book_id}.json")
    if not os.path.exists(gl_path):
        return

    try:
        with open(gl_path, "r", encoding="utf-8") as f:
            entries = json.load(f)
    except Exception as e:
        print(f"Error reading glossary for {book_id}: {e}")
        return

    if not entries:
        return

    print(f"Syncing {len(entries)} glossary entries for '{book_id}'...")
    payload = []
    for item in entries:
        gid = item.get("id") or item.get("name", "").lower().strip().replace(" ", "-")
        if not gid:
            continue

        aliases = item.get("aliases") or []
        if isinstance(aliases, str):
            aliases = [a.strip() for a in aliases.split(",") if a.strip()]

        row = {
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
        }
        payload.append(row)

    batch_size = 50
    total_synced = 0
    for i in range(0, len(payload), batch_size):
        chunk = payload[i:i + batch_size]
        res = requests.post(f"{SUPABASE_URL}/rest/v1/glossary", headers=HEADERS, json=chunk)
        if res.status_code in (200, 201):
            total_synced += len(chunk)
        else:
            print(f"  Glossary error ({res.status_code}): {res.text[:100]}")
        time.sleep(0.05)

    print(f"Done glossary for '{book_id}': {total_synced} uploaded.")

def main():
    print("Starting sync to Supabase...")
    book_ids = sync_books()
    for bid in book_ids:
        sync_chapters(bid)
        sync_glossary(bid)
    print("Full sync to Supabase complete!")

if __name__ == "__main__":
    main()
