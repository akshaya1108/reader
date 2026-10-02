import os
import json
import re
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv

load_dotenv()

def get_gemini_client():
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None

CHINESE_CHAR_RE = re.compile(r'[\u4e00-\u9fff]')

def is_chinese_novel(novel_title: str = "", genre: str = "") -> bool:
    """
    Determines if a book belongs to Chinese web novel / Xianxia / Wuxia / Danmei traditions.
    Non-Chinese books (e.g. Epic Fantasy, Western fiction, Korean/Japanese novels)
    must NEVER have Chinese characters, Hanzi, or Pinyin generated or merged into aliases.
    """
    t = (novel_title or "").lower().strip()
    g = (genre or "").lower().strip()

    chinese_keywords = ["xianxia", "danmei", "wuxia", "cultivation", "xuanhuan", "chinese", "qihuan"]
    for kw in chinese_keywords:
        if kw in g or kw in t:
            return True

    known_chinese_titles = [
        "mo dao zu shi", "grandmaster of demonic cultivation",
        "tian guan ci fu", "heaven official's blessing",
        "scum villain", "ren zha fanpai",
        "erha", "dumb husky", "2ha", "sha po lang", "qiang jin jiu", "stars of chaos"
    ]
    for ct in known_chinese_titles:
        if ct in t:
            return True

    if CHINESE_CHAR_RE.search(novel_title or "") or CHINESE_CHAR_RE.search(genre or ""):
        return True

    return False

def clean_entry_for_novel(entry: dict, is_chinese: bool) -> dict:
    """
    Ensures that for non-Chinese novels, pinyin_or_chinese is strictly empty and
    aliases contain zero Chinese characters or pinyin transcriptions.
    """
    if not is_chinese:
        entry["pinyin_or_chinese"] = ""
        raw_aliases = entry.get("aliases", [])
        if not isinstance(raw_aliases, list):
            raw_aliases = [raw_aliases] if raw_aliases else []
        
        filtered = []
        name_lower = (entry.get("name") or "").strip().lower()
        for a in raw_aliases:
            if not isinstance(a, str):
                continue
            a_strip = a.strip()
            if not a_strip:
                continue
            if CHINESE_CHAR_RE.search(a_strip):
                continue
            if a_strip.lower() in ["n/a", "none", "null"]:
                continue
            if a_strip.lower() == name_lower:
                continue
            if re.search(r"\b(shìzú|fēnqū|línzi|chuánsòng|fú)\b", a_strip, re.IGNORECASE):
                continue
            if a_strip.lower() == "xīfāng fēnqū":
                continue
            if a_strip not in filtered:
                filtered.append(a_strip)
        entry["aliases"] = filtered
    else:
        py = (entry.get("pinyin_or_chinese") or "").strip()
        if py.lower() in ["n/a", "none", "null"]:
            entry["pinyin_or_chinese"] = ""
        raw_aliases = entry.get("aliases", [])
        if isinstance(raw_aliases, list):
            filtered = []
            for a in raw_aliases:
                if not isinstance(a, str):
                    continue
                a_strip = a.strip()
                if not a_strip or a_strip.lower() in ["n/a", "none", "null"]:
                    continue
                if a_strip not in filtered:
                    filtered.append(a_strip)
            entry["aliases"] = filtered
    return entry

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower()).strip('-')
    return slug or "character"

def extract_characters_from_text(text: str, existing_glossary: List[Dict[str, Any]], novel_title: str = "", genre: str = "") -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Scans chapter text with Gemini to extract characters, courtesy names, titles, aliases,
    and concise 1-line spoiler-free summaries.
    Merges findings into existing_glossary.
    Returns: (updated_glossary, newly_added_names)
    """
    client = get_gemini_client()
    if not client:
        print("Gemini API key not configured or google-genai not installed.")
        return existing_glossary, []

    is_chinese = is_chinese_novel(novel_title, genre)

    existing_names_summary = []
    for char in existing_glossary:
        existing_names_summary.append({
            "name": char.get("name", ""),
            "aliases": char.get("aliases", []),
            "summary": char.get("summary", "")
        })

    if is_chinese:
        persona = "You are an expert reading assistant for Xianxia, Wuxia, and Danmei translated novels.\nReaders often get confused by the high number of characters, courtesy names (字), birth names (名), titles/epithets (号), and familial honorifics."
        pinyin_inst = "2. 'pinyin_or_chinese': Their Chinese hanzi or pinyin if identifiable (e.g. \"魏无羡\" or \"Mo Ziyuan\"), or empty string."
        aliases_inst = "3. 'aliases': All aliases, birth names, courtesy names, titles, clan titles, nicknames, and specific epithets (e.g. [\"Wei Ying\", \"Yiling Patriarch\", \"A-Xian\", \"Senior Wei\"])."
        schema_pinyin = '"pinyin_or_chinese": "Hanzi / Pinyin",'
    else:
        persona = f'You are an expert reading assistant for the novel "{novel_title or "novel"}".\nCRITICAL DIRECTIVE: This novel is NOT a Chinese, Xianxia, or Danmei novel. Under NO circumstances should you produce or invent Chinese characters, Hanzi, or Pinyin romanizations.'
        pinyin_inst = "2. 'pinyin_or_chinese': Strictly empty string \"\". Do NOT generate Chinese characters or pinyin."
        aliases_inst = "3. 'aliases': All genuine in-universe aliases, titles, nicknames, and epithets (e.g. [\"Ring-bearer\", \"Mr. Underhill\"]). Do NOT generate Chinese or pinyin translations."
        schema_pinyin = '"pinyin_or_chinese": "",'

    prompt = f"""
{persona}

Analyze the chapter text below and identify all characters who appear or are mentioned.
For each character, identify:
1. 'name': Their primary recognizable canonical name.
{pinyin_inst}
{aliases_inst}
4. 'sect_or_affiliation': Their faction, family, house, race, or group.
5. 'summary': A strictly ONE-SENTENCE, completely SPOILER-FREE introductory description.
CRITICAL ANTI-SPOILER RULES (MUST BE FOLLOWED STRICTLY):
- NEVER mention death, execution, murder, or whether a character is alive or dead!
- NEVER mention fatal events, who kills them, or how they die (e.g. NEVER write "who dies...", "fatally forced to...", "murdered by...", "later killed...").
- Describe ONLY who they are upon introduction: their social role, occupation, clan rank, or relation to other characters.
- It must answer ONLY "Who is this person?" — NEVER "What happens to them in the story?"

Existing characters already tracked:
{json.dumps(existing_names_summary, ensure_ascii=False, indent=2)}

Chapter Text to scan:
\"\"\"
{text[:15000]}
\"\"\"

Return a JSON array of objects with the exact schema:
[
  {{
    "name": "Primary Name",
    {schema_pinyin}
    "aliases": ["Alias 1", "Title 1"],
    "sect_or_affiliation": "Sect/Affiliation",
    "summary": "One sentence spoiler-free description."
  }}
]
Only return valid JSON array, no extra commentary or markdown backticks.
"""

    models_to_try = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.5-flash-lite"]
    extracted = None

    for model_name in models_to_try:
        try:
            from google.genai import types
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            content = response.text.strip()
            # Clean any accidental markdown wrap
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            parsed = json.loads(content)
            if isinstance(parsed, list):
                extracted = parsed
                break
        except Exception as e:
            print(f"Notice: Model {model_name} extraction error ({e}). Trying fallback...")
            continue

    if not extracted:
        return existing_glossary, []

    updated_glossary = [dict(c) for c in existing_glossary]
    newly_added = []

    for item in extracted:
        name = item.get("name", "").strip()
        if not name:
            continue

        clean_entry_for_novel(item, is_chinese=is_chinese)

        # Check if this character matches an existing entry
        matched_entry = None
        for entry in updated_glossary:
            existing_name = entry.get("name", "").lower()
            existing_aliases = [a.lower() for a in entry.get("aliases", [])]
            
            if name.lower() == existing_name or name.lower() in existing_aliases:
                matched_entry = entry
                break
            # Also check if any of the incoming aliases match
            for incoming_alias in item.get("aliases", []):
                if incoming_alias.lower() == existing_name or incoming_alias.lower() in existing_aliases:
                    matched_entry = entry
                    break
            if matched_entry:
                break

        if matched_entry:
            # Non-destructively merge aliases
            current_aliases = matched_entry.get("aliases", [])
            current_aliases_lower = [a.lower() for a in current_aliases]
            for a in item.get("aliases", []):
                if a.strip() and a.lower() not in current_aliases_lower and a.lower() != matched_entry.get("name", "").lower():
                    current_aliases.append(a.strip())
                    current_aliases_lower.append(a.lower())
            matched_entry["aliases"] = current_aliases
            
            if not matched_entry.get("sect_or_affiliation") and item.get("sect_or_affiliation"):
                matched_entry["sect_or_affiliation"] = item["sect_or_affiliation"]
            if not matched_entry.get("affiliation") and item.get("sect_or_affiliation"):
                matched_entry["affiliation"] = item["sect_or_affiliation"]
            if is_chinese and not matched_entry.get("pinyin_or_chinese") and item.get("pinyin_or_chinese"):
                matched_entry["pinyin_or_chinese"] = item["pinyin_or_chinese"]
            clean_entry_for_novel(matched_entry, is_chinese=is_chinese)
        else:
            # New character entry
            char_id = slugify(name)
            # Ensure unique ID
            existing_ids = {c.get("id") for c in updated_glossary}
            counter = 1
            base_id = char_id
            while char_id in existing_ids:
                char_id = f"{base_id}-{counter}"
                counter += 1

            new_char = {
                "id": char_id,
                "name": name,
                "category": "Character",
                "pinyin_or_chinese": item.get("pinyin_or_chinese", "") if is_chinese else "",
                "aliases": [a.strip() for a in item.get("aliases", []) if a.strip() and a.lower() != name.lower()],
                "affiliation": item.get("sect_or_affiliation", ""),
                "sect_or_affiliation": item.get("sect_or_affiliation", ""),
                "summary": item.get("summary", "")
            }
            clean_entry_for_novel(new_char, is_chinese=is_chinese)
            updated_glossary.append(new_char)
            newly_added.append(name)

    return updated_glossary, newly_added


def ai_enhance_book_metadata(raw_title: str, raw_author: str, raw_description: str = "", sample_text: str = "") -> Dict[str, Any]:
    """
    Analyzes raw EPUB metadata and opening text excerpt using Gemini AI to extract
    clean, iconic book title, verified author, genre, synopsis, and glossary recommendation.
    Falls back gracefully to regex cleanup if AI is offline or unavailable.
    """
    # Baseline fallback cleanup
    fallback_title = raw_title.strip()
    fallback_title = re.sub(r'\s*[-_:]\s*(retail|scan|ocr|hocr|pdf|epub|worldfreebooks.*)\b.*$', '', fallback_title, flags=re.IGNORECASE).strip()
    fallback_title = re.sub(r'\s*\(retail\)\s*$', '', fallback_title, flags=re.IGNORECASE).strip()
    fallback_title = re.sub(r'[:]\s*Being the\s+.*$', '', fallback_title, flags=re.IGNORECASE).strip()
    if not fallback_title:
        fallback_title = "Imported Novel"

    fallback_author = raw_author.strip() if raw_author else "Unknown Author"
    fallback_author = re.sub(r'\s*[-_]\s*(worldfreebooks.*)\b.*$', '', fallback_author, flags=re.IGNORECASE).strip()

    baseline = {
        "title": fallback_title,
        "author": fallback_author,
        "genre": "Web Novel",
        "description": raw_description.strip() if raw_description else "",
        "enable_glossary": True
    }

    client = get_gemini_client()
    if not client:
        return baseline

    prompt = f"""You are an expert literary book cataloger.
A user has uploaded an EPUB file to their personal digital reader library.
Analyze the raw metadata and opening excerpt below to generate clean, polished book metadata.

Raw Title: {raw_title}
Raw Author: {raw_author}
Raw Description: {raw_description}
Opening Excerpt:
{sample_text[:1400]}

Return ONLY a valid JSON object with the following fields:
{{
  "title": "Clean, iconic book title (strip retail junk, scan tags, file extensions, and subtitle clutter)",
  "author": "Clean, proper author name",
  "genre": "Concise uppercase genre tag (e.g. EPIC FANTASY, XIANXIA / DANMEI, KOREAN WEB NOVEL, SCIENCE FICTION, MYSTERY)",
  "description": "Engaging, spoiler-free 2-3 sentence synopsis",
  "enable_glossary": true
}}
"""

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]
    for model_name in models_to_try:
        try:
            from google.genai import types
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())
            if isinstance(parsed, dict) and parsed.get("title"):
                return {
                    "title": str(parsed.get("title", fallback_title)).strip() or fallback_title,
                    "author": str(parsed.get("author", fallback_author)).strip() or fallback_author,
                    "genre": str(parsed.get("genre", "Web Novel")).strip() or "Web Novel",
                    "description": str(parsed.get("description", "")).strip(),
                    "enable_glossary": bool(parsed.get("enable_glossary", True))
                }
        except Exception as e:
            continue

    return baseline

