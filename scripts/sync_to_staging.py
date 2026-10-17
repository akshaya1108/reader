#!/usr/bin/env python3
"""
Sync local books, chapters, and glossaries to Supabase Staging environment.
Staging Project: bhpajsjpimiifmfiqybj.supabase.co
"""
import os
import json
import glob
import time
import requests

STAGING_URL = "https://bhpajsjpimiifmfiqybj.supabase.co"
STAGING_KEY = "sb_publishable_3AORVL5y3dIAqH_UbnfzVg_ruEGFr5O"

HEADERS = {
    "apikey": STAGING_KEY,
    "Authorization": f"Bearer {STAGING_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
GLOSSARY_DIR = os.path.join(DATA_DIR, "glossary")

def sync_books_to_staging():
    if not os.path.exists(BOOKS_FILE):
        print("No books.json found.")
        return []
    with open(BOOKS_FILE, "r", encoding="utf-8") as f:
        books = json.load(f)

    print(f"Syncing {len(books)} books to Staging...")
    synced = []
    for b in books:
        bid = b.get("id")
        if not bid:
            continue
        ch_dir = os.path.join(CHAPTERS_DIR, bid)
        actual_ch_count = 0
        if os.path.exists(ch_dir):
            ch_files = glob.glob(os.path.join(ch_dir, "*.json"))
            actual_ch_count = len(ch_files)

        row = {
            "id": bid,
            "title": b.get("title", "Untitled"),
            "author": b.get("author", "Unknown"),
            "genre": b.get("genre", ""),
            "total_chapters": actual_ch_count or b.get("chapters_count") or b.get("total_chapters") or 0,
            "word_count": b.get("total_words") or b.get("word_count") or 0,
            "cover_image": b.get("cover") or b.get("cover_image") or "",
            "last_read_chapter": b.get("last_read_chapter") or 1,
            "last_read_at": b.get("last_read_at") if b.get("last_read_at") and "T" in str(b.get("last_read_at")) else None,
            "bookmark": b.get("bookmark") or {},
            "bookmarks": b.get("bookmarks") or [],
            "enable_glossary": bool(b.get("enable_glossary", True)),
            "shared_glossary_id": b.get("shared_glossary_id")
        }
        try:
            r = requests.post(f"{STAGING_URL}/rest/v1/books", headers=HEADERS, json=[row], timeout=15)
            if r.status_code in (200, 201):
                print(f"  [OK] Book: {bid}")
                synced.append(bid)
            else:
                print(f"  [ERR] Book {bid} ({r.status_code}): {r.text[:120]}")
        except Exception as e:
            print(f"  [FAIL] Book {bid}: {e}")
    return synced

def sync_chapters_to_staging(book_id, limit=None):
    ch_dir = os.path.join(CHAPTERS_DIR, book_id)
    if not os.path.exists(ch_dir):
        return
    files = [f for f in os.listdir(ch_dir) if f.endswith(".json")]
    def sort_key(name):
        base = name.replace(".json", "")
        return (0, int(base)) if base.isdigit() else (1, base)
    files.sort(key=sort_key)
    if limit:
        files = files[:limit]

    print(f"Syncing {len(files)} chapters for '{book_id}' to Staging...")
    batch = []
    batch_size = 10
    total = 0
    for f_name in files:
        f_path = os.path.join(ch_dir, f_name)
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                ch = json.load(f)
            num = int(f_name.replace(".json", "")) if f_name.replace(".json", "").isdigit() else int(ch.get("chapter_number", 1))
            batch.append({
                "book_id": book_id,
                "chapter_number": num,
                "title": ch.get("title") or f"Chapter {num}",
                "content": ch.get("content") or "",
                "word_count": int(ch.get("word_count") or 0)
            })
            if len(batch) >= batch_size:
                r = requests.post(f"{STAGING_URL}/rest/v1/chapters", headers=HEADERS, json=batch, timeout=20)
                if r.status_code in (200, 201):
                    total += len(batch)
                batch = []
                time.sleep(0.05)
        except Exception as e:
            print(f"  Chapter skip {f_name}: {e}")
    if batch:
        r = requests.post(f"{STAGING_URL}/rest/v1/chapters", headers=HEADERS, json=batch, timeout=20)
        if r.status_code in (200, 201):
            total += len(batch)
    print(f"  [OK] Done '{book_id}': {total} chapters synced to Staging.")

def sync_glossary_to_staging(book_id):
    gl_path = os.path.join(GLOSSARY_DIR, f"{book_id}.json")
    if not os.path.exists(gl_path):
        return
    with open(gl_path, "r", encoding="utf-8") as f:
        entries = json.load(f)
    print(f"Syncing {len(entries)} glossary items for '{book_id}' to Staging...")
    payload = []
    for item in entries:
        gid = item.get("id") or item.get("name", "").lower().strip().replace(" ", "-")
        payload.append({
            "book_id": book_id,
            "id": gid,
            "name": item.get("name") or gid,
            "category": item.get("category") or "Character",
            "description": item.get("description") or item.get("summary") or "",
            "pinyin": item.get("pinyin") or "",
            "pinyin_or_chinese": item.get("pinyin_or_chinese") or "",
            "aliases": item.get("aliases") or [],
            "affiliation": item.get("affiliation") or "",
            "sect_or_affiliation": item.get("sect_or_affiliation") or "",
            "summary": item.get("summary") or "",
            "mentions": int(item.get("mentions") or 0)
        })
    if payload:
        r = requests.post(f"{STAGING_URL}/rest/v1/glossary", headers=HEADERS, json=payload, timeout=20)
        print(f"  [OK] Glossary '{book_id}' status: {r.status_code}")

if __name__ == "__main__":
    print("Testing Staging API Connection...")
    res = requests.get(f"{STAGING_URL}/rest/v1/books?select=id&limit=1", headers=HEADERS, timeout=5)
    print(f"Staging books table check: {res.status_code}")
