# 📖 My Little Library - Xianxia & Danmei Local Reader

A local web application crafted specifically for reading translated Xianxia, Wuxia, and Danmei novels. It solves the classic *"who is this character again?"* problem with interactive hover tooltips, alias tracking, and Gemini AI character extraction.

---

## ✨ Features

- **Character Hover Tooltips**: Hover over any character's name, courtesy name (字), birth name (名), title/epithet (号), or nickname to instantly see who they are, their sect/clan, and a 1-line spoiler-free summary.
- **Gemini AI Character Extraction**: Automatically scans chapters when saved/uploaded to extract new characters, aliases, and generate context-appropriate, spoiler-free summaries up to that chapter.
- **Fandom Wiki Scraper**: Optional tool to pre-seed the glossary for popular novels (MDZS, TGCF, 2Ha, SVSSS, etc.), with Gemini automatically stripping out late-book spoilers.
- **My Little Library UI**:
  - Dual Chapter Views: **Card View** (with excerpts and word count) and **Table View**.
  - **Write a Chapter Modal**: Rich-text formatting toolbar (Bold, Italic, Lists, Alignments) with automatic AI scan toggle.
  - **Upload Chapter Modal**: Paste or upload `.txt` / `.md` translation files.
  - **Full Chapter Reader**: Clean typography, Sepia/Light/Dark themes, font family selector (Serif / Sans), font sizing controls (`A-`, `A`, `A+`), and chapter navigation.
  - **Character Glossary Drawer**: Search, add, edit, or delete characters and their aliases.
- **Local JSON Database**: All your books, chapters, and character glossaries are saved locally in plain `.json` files inside the `data/` folder.

---

## 🚀 How to Run in VS Code

### 1. Open the Project in VS Code
In VS Code, open the folder:
```
/Users/akshayaiyer/.gemini/antigravity/scratch/xianxia-reader
```

### 2. Configure Your Gemini API Key
Open `.env` in VS Code and paste your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 3. Start the Server
Open the built-in terminal in VS Code (`Ctrl + ~` or `Terminal -> New Terminal`) and run:
```bash
./run.sh
```
*(Or run `venv/bin/python app.py`)*

### 4. Open in Your Browser
Visit:
```
http://127.0.0.1:5000
```

---

## 📁 Project Structure

```
xianxia-reader/
├── app.py              # Flask server and REST API endpoints
├── ai_glossary.py      # Gemini AI character extraction & merging
├── scraper.py          # Fandom wiki character scraper & AI sanitizer
├── run.sh              # 1-click startup script
├── requirements.txt    # Python dependencies
├── .env                # Your Gemini API key configuration
├── templates/
│   └── index.html      # Complete frontend layout (matching screenshots)
├── static/
│   ├── css/
│   │   └── style.css   # Earthy aesthetic, themes & tooltip styling
│   └── js/
│       └── app.js      # Frontend controller & regex character tagger
└── data/               # Local JSON Database
    ├── books.json
    ├── chapters/
    └── glossary/
```
