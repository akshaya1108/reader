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

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower()).strip('-')
    return slug or "character"

def extract_characters_from_text(text: str, existing_glossary: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
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

    existing_names_summary = []
    for char in existing_glossary:
        existing_names_summary.append({
            "name": char.get("name", ""),
            "aliases": char.get("aliases", []),
            "summary": char.get("summary", "")
        })

    prompt = f"""
You are an expert reading assistant for Xianxia, Wuxia, and Danmei translated novels.
Readers often get confused by the high number of characters, courtesy names (字), birth names (名), titles/epithets (号), and familial honorifics.

Analyze the chapter text below and identify all characters who appear or are mentioned.
For each character, identify:
1. 'name': Their primary recognizable name (English / Pinyin, e.g. "Wei Wuxian", "Lan Wangji", "Mo Ziyuan").
2. 'pinyin_or_chinese': Their Chinese hanzi or pinyin if identifiable (e.g. "魏无羡" or "Mo Ziyuan"), or empty string.
3. 'aliases': All aliases, birth names, courtesy names, titles, clan titles, nicknames, and specific epithets (e.g. ["Wei Ying", "Yiling Patriarch", "A-Xian", "Senior Wei"]).
4. 'sect_or_affiliation': Their clan, sect, family, or faction (e.g. "Gusu Lan Sect", "Yunmeng Jiang Sect", "Mo Family Village").
5. 'summary': A strictly ONE-SENTENCE, completely SPOILER-FREE introductory description.
CRITICAL ANTI-SPOILER RULES (MUST BE FOLLOWED STRICTLY):
- NEVER mention death, execution, murder, or whether a character is alive or dead!
- NEVER mention fatal events, who kills them, or how they die (e.g. NEVER write "who dies...", "fatally forced to...", "murdered by...", "later killed...").
- Describe ONLY who they are upon introduction: their social role, occupation, clan rank, or relation to other characters (e.g. "A young servant boy employed in the Mo household", "Mo Xuanyu's cousin", "A junior disciple of the Gusu Lan Sect").
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
    "pinyin_or_chinese": "Hanzi / Pinyin",
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
            if not matched_entry.get("pinyin_or_chinese") and item.get("pinyin_or_chinese"):
                matched_entry["pinyin_or_chinese"] = item["pinyin_or_chinese"]
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
                "pinyin_or_chinese": item.get("pinyin_or_chinese", ""),
                "aliases": [a.strip() for a in item.get("aliases", []) if a.strip() and a.lower() != name.lower()],
                "affiliation": item.get("sect_or_affiliation", ""),
                "sect_or_affiliation": item.get("sect_or_affiliation", ""),
                "summary": item.get("summary", "")
            }
            updated_glossary.append(new_char)
            newly_added.append(name)

    return updated_glossary, newly_added
