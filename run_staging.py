#!/usr/bin/env python3
"""
Dedicated Staging Server for Xianxia Reader.
Runs on Port 5002 with complete isolation from Production:
- Isolated Staging Cloud DB: bhpajsjpimiifmfiqybj.supabase.co
- Isolated Local Data Directory: data_staging/
"""
import os
import sys
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_STAGING_DIR = os.path.join(BASE_DIR, "data_staging")
PROD_DATA_DIR = os.path.join(BASE_DIR, "data")

# 1. Initialize data_staging with initial books if not yet created
os.makedirs(DATA_STAGING_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_STAGING_DIR, "chapters"), exist_ok=True)
os.makedirs(os.path.join(DATA_STAGING_DIR, "glossary"), exist_ok=True)

staging_books_file = os.path.join(DATA_STAGING_DIR, "books.json")
prod_books_file = os.path.join(PROD_DATA_DIR, "books.json")

if not os.path.exists(staging_books_file) and os.path.exists(prod_books_file):
    try:
        shutil.copy2(prod_books_file, staging_books_file)
        print("Initialized data_staging/books.json from production books.")
    except Exception as e:
        print(f"Notice initializing staging books: {e}")

# 2. Set Environment Variables for 100% Staging Isolation
os.environ["PORT"] = "5002"
os.environ["DATA_DIR"] = DATA_STAGING_DIR
os.environ["SUPABASE_URL"] = "https://bhpajsjpimiifmfiqybj.supabase.co"
os.environ["SUPABASE_KEY"] = "sb_publishable_3AORVL5y3dIAqH_UbnfzVg_ruEGFr5O"
os.environ["READER_ENV"] = "staging"

print("==================================================")
print("  MY LIBRARY - STAGING TEST SERVER                ")
print("  Web App URL:       http://127.0.0.1:5002        ")
print("  Mobile PWA URL:    http://127.0.0.1:5002/m      ")
print("  Cloud Database:    bhpajsjpimiifmfiqybj (Staging)")
print("  Local Storage:     data_staging/ (Isolated)     ")
print("==================================================")

# 3. Launch Flask App
from app import app
app.run(
    host="0.0.0.0",
    port=5002,
    debug=True,
    exclude_patterns=["*/data_staging/*", "*data_staging/*", "*/.git/*"]
)
