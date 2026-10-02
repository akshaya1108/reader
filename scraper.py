import requests
import json
import re
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Tuple
from ai_glossary import get_gemini_client, slugify, is_chinese_novel, clean_entry_for_novel

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/"
}

def extract_title_from_url(url: str) -> str:
    if not url:
        return ""
    mapping = {
        "modao-zushi": "Mo Dao Zu Shi (Grandmaster of Demonic Cultivation)",
        "grandmaster-of-demonic-cultivation": "Mo Dao Zu Shi (Grandmaster of Demonic Cultivation)",
        "the-untamed": "Mo Dao Zu Shi (The Untamed)",
        "heaven-officials-blessing": "Heaven Official's Blessing (Tian Guan Ci Fu)",
        "tian-guan-ci-fu": "Heaven Official's Blessing (Tian Guan Ci Fu)",
        "scumvillains-selfsaving-system": "The Scum Villain's Self-Saving System",
        "svsss": "The Scum Villain's Self-Saving System",
        "2ha": "The Husky and His White Cat Shizun (Erha)",
        "erha": "The Husky and His White Cat Shizun (Erha)",
        "qiang-jin-jiu": "Qiang Jin Jiu",
        "omniscient-reader": "Omniscient Reader's Viewpoint"
    }
    url_lower = url.lower()
    for key, name in mapping.items():
        if key in url_lower:
            return name
    
    # Try regex on fandom domain: https://<name>.fandom.com/...
    match = re.search(r'https?://([a-zA-Z0-9_-]+)\.fandom\.com', url)
    if match:
        return match.group(1).replace('-', ' ').title()
    return ""

GENERIC_COMMON_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
    "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
    "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
    "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're",
    "you've", "your", "yours", "yourself", "yourselves",
    # Common everyday nouns and actions
    "table", "chair", "door", "window", "floor", "wall", "room", "house", "bed", "man", "woman", "boy",
    "girl", "child", "children", "old man", "old woman", "servant", "innkeeper", "farmer", "guard",
    "soldier", "people", "person", "crowd", "someone", "anyone", "everyone", "nobody", "something",
    "anything", "nothing", "everything", "tea", "cup", "wine", "water", "food", "meat", "rice", "bowl",
    "chopsticks", "road", "street", "path", "alley", "mountain", "hill", "river", "lake", "forest", "tree",
    "grass", "stone", "rock", "sky", "cloud", "sun", "moon", "night", "day", "morning", "evening",
    "sword", "blade", "robe", "clothes", "shoes", "boots", "hair", "eyes", "hand", "hands", "face", "head",
    "body", "blood", "voice", "sound", "smile", "laugh", "tears", "breath", "shadow", "light", "fire",
    "smoke", "wind", "rain", "snow", "ice", "cold", "warm", "hot", "step", "steps", "gate", "courtyard",
    "hall", "palace", "temple", "inn", "shop", "village", "town", "city", "paper", "brush", "ink", "book",
    "letter", "word", "words", "sentence", "thought", "mind", "heart", "soul", "life", "death", "corpse",
    "ghost", "spirit", "demon", "monster", "beast", "dog", "horse", "bird", "fish", "walked", "walk",
    "ran", "running", "looked", "looking", "said", "saying", "asked", "shouted", "stood", "standing",
    "sat", "sitting", "came", "went", "going", "gone", "felt", "knew", "saw", "heard", "told"
}

def guess_fandom_url(book_title: str, character_name: str = "") -> str:
    cleaned = re.sub(r'\(.*?\)', '', book_title).strip().lower()
    mapping = {
        "mo dao zu shi": "https://modao-zushi.fandom.com/wiki/",
        "grandmaster of demonic cultivation": "https://modao-zushi.fandom.com/wiki/",
        "the untamed": "https://modao-zushi.fandom.com/wiki/",
        "tian guan ci fu": "https://heaven-officials-blessing.fandom.com/wiki/",
        "heaven official's blessing": "https://heaven-officials-blessing.fandom.com/wiki/",
        "scum villain": "https://scumvillains-selfsaving-system.fandom.com/wiki/",
        "svsss": "https://scumvillains-selfsaving-system.fandom.com/wiki/",
        "erha": "https://2ha.fandom.com/wiki/",
        "the husky and his white cat shizun": "https://2ha.fandom.com/wiki/",
        "qiang jin jiu": "https://qiang-jin-jiu.fandom.com/wiki/"
    }
    base = None
    for key, url in mapping.items():
        if key in cleaned:
            base = url
            break
    
    if base:
        if character_name:
            # Format character name (e.g. "madam jin" -> "Madam_Jin")
            c_slug = character_name.strip().replace(" ", "_").title()
            return f"{base}{c_slug}"
        return f"{base}Category:Characters"
    
    return ""

def detect_category_from_text(text: str) -> str:
    """Detects canonical category from URL, category name, or query string."""
    if not text:
        return ""
    t = text.lower()
    if any(k in t for k in ["race", "creature", "species", "beast", "monster", "demons", "spirits", "animals", "races", "creatures", "monsters", "beasts"]):
        return "Race / Creature"
    if any(k in t for k in ["location", "place", "realm", "geography", "setting", "cities", "towns", "mountains", "temples"]):
        return "Location / Realm"
    if any(k in t for k in ["weapon", "item", "artifact", "tool", "object", "instrument", "swords", "talismans"]):
        return "Weapon / Item"
    if any(k in t for k in ["clan", "sect", "faction", "family", "organization", "sects", "clans"]):
        return "Clan / Sect"
    if any(k in t for k in ["concept", "lore", "technique", "magic", "spell", "cultivation", "techniques", "ranks"]):
        return "Concept / Lore"
    if any(k in t for k in ["character", "cast", "person", "people", "disciple", "cultivators", "figures"]):
        return "Character"
    return ""

def fetch_fandom_via_api(url: str) -> Tuple[str, str, str]:
    """
    Fetches category members or page content from Fandom using its official api.php.
    Returns: (raw_text, detected_category, page_or_category_title)
    """
    match = re.search(r'https?://([a-zA-Z0-9_-]+)\.fandom\.com/wiki/([^?#]+)', url)
    if not match:
        return "", "", ""

    subdomain = match.group(1)
    slug = match.group(2)
    api_url = f"https://{subdomain}.fandom.com/api.php"

    # 1. Category listing: Category:Locations, Category:Characters, etc.
    if slug.lower().startswith("category:"):
        raw_cat_name = slug.split(":", 1)[1].replace('_', ' ')
        detected_category = detect_category_from_text(raw_cat_name) or "Character"
        try:
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": f"Category:{raw_cat_name}",
                "cmlimit": "100",
                "format": "json"
            }
            resp = requests.get(api_url, params=params, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                members = data.get("query", {}).get("categorymembers", [])
                valid_titles = []
                for m in members:
                    if m.get("ns") == 0:  # Main article namespace only
                        title = m.get("title", "").strip()
                        if title and not title.lower().startswith("template:") and not title.lower().startswith("category:") and title.lower() not in ["map", "timeline"]:
                            valid_titles.append(title)
                if valid_titles:
                    raw_text = f"Canonical {detected_category} entries listed in wiki category '{raw_cat_name}':\n" + ", ".join(valid_titles)
                    return raw_text, detected_category, raw_cat_name
        except Exception as e:
            print(f"Notice: Fandom MediaWiki API category query failed ({e}).")

    # 2. Individual article page
    else:
        page_title = slug.replace('_', ' ')
        try:
            params = {
                "action": "parse",
                "page": slug,
                "prop": "text",
                "format": "json"
            }
            resp = requests.get(api_url, params=params, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                html_content = data.get("parse", {}).get("text", {}).get("*", "")
                if html_content:
                    soup = BeautifulSoup(html_content, 'html.parser')
                    for tag in soup(["script", "style", "nav", "footer", "aside", ".page-side-tools", ".wds-global-navigation"]):
                        tag.decompose()
                    text = soup.get_text(separator="\n", strip=True)
                    if len(text) > 60:
                        return text[:20000], "", page_title
        except Exception as e:
            print(f"Notice: Fandom MediaWiki API parse failed ({e}).")

    return "", "", ""

def scrape_fandom_data(url_or_title: str, novel_title: str = "") -> Tuple[str, str, str]:
    """
    Fetches raw text snippets and detected category from a Fandom wiki URL or query.
    Returns: (raw_text, detected_category, entity_name)
    """
    url = url_or_title.strip()
    if not url.startswith("http"):
        url = guess_fandom_url(novel_title or url_or_title, character_name=url_or_title if novel_title else "")

    if not url or not url.startswith("http"):
        # Not a URL: check if it's a category query like "Category:Locations"
        cat = detect_category_from_text(url_or_title)
        return "", cat, url_or_title

    # First attempt: Official Fandom MediaWiki API (bypasses Cloudflare challenges completely)
    api_text, detected_cat, title_name = fetch_fandom_via_api(url)
    if api_text:
        return api_text, detected_cat, title_name

    # Fallback attempt: Standard HTML scraping with requests
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            category_members = soup.select('.category-page__member-link, .category-page__members a')
            cat = detect_category_from_text(url) or ""
            if category_members:
                names = [m.get_text(strip=True) for m in category_members if m.get_text(strip=True)]
                if names:
                    return f"{cat or 'Entries'} listed in wiki category:\n" + ", ".join(names), cat, ""
            
            for tag in soup(["script", "style", "nav", "footer", "aside", ".page-side-tools", ".wds-global-navigation"]):
                tag.decompose()
                
            main_content = soup.find(id="mw-content-text") or soup.body
            if main_content:
                text = main_content.get_text(separator="\n", strip=True)
                if len(text) > 80:
                    return text[:20000], "", ""
    except Exception as e:
        print(f"Notice: Web fetch encountered ({e}). Switching to Gemini knowledge base.")

    cat = detect_category_from_text(url)
    return "", cat, ""

def scrape_fandom_character_list(url_or_title: str, novel_title: str = "") -> str:
    """Backwards-compatible wrapper returning only raw text."""
    raw_text, _, _ = scrape_fandom_data(url_or_title, novel_title)
    return raw_text

def lookup_single_entity(query: str, novel_title: str, genre: str = "") -> Tuple[List[Dict[str, Any]], str]:
    """
    Dedicated, isolated single-entity lookup for reader text selections and form auto-fill.
    Evaluates strictly THAT ONE TERM:
    - If it's a character title/alias (e.g. "Yiling Laozu"), resolves to the primary character ("Wei Wuxian").
    - If it's a distinct weapon, clan, location, or concept (e.g. "Transportation Talisman"), generates
      a card for that specific entity with its own canonical category.
    - NEVER runs batch directory prompts!
    """
    client = get_gemini_client()
    if not client:
        return [], "Gemini client not initialized"

    q_clean = query.strip()
    if not q_clean or q_clean.lower() in GENERIC_COMMON_WORDS:
        return [], "Generic common word; not an official novel entity."

    is_chinese = is_chinese_novel(novel_title, genre)

    # Fetch wiki article if exists
    wiki_text = ""
    fandom_url = guess_fandom_url(novel_title, character_name=q_clean)
    if fandom_url:
        wiki_text, _, _ = fetch_fandom_via_api(fandom_url)

    if is_chinese:
        intro_desc = f'You are an expert canon scholar for translated Xianxia, Wuxia, and Danmei literature.\nThe user is reading "{novel_title}" and wants to identify the term "{q_clean}".'
        pinyin_rule = "- 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. \"传送符\" or \"Chuánsòng Fú\")"
        aliases_rule = f'- \'aliases\': Alternate names, pinyin, and translations (ALWAYS include "{q_clean}" if different from name)'
        pinyin_schema = '"pinyin_or_chinese": "Hanzi / Pinyin",'
    else:
        intro_desc = f'You are an expert canon scholar for the novel "{novel_title}".\nThe user is reading "{novel_title}" and wants to identify the term "{q_clean}".\nCRITICAL DIRECTIVE: "{novel_title}" is NOT a Chinese, Xianxia, or Danmei novel. Under NO circumstances should you produce any Chinese characters, Hanzi, or Pinyin romanizations.'
        pinyin_rule = "- 'pinyin_or_chinese': Strictly empty string \"\". Do NOT generate Chinese characters or pinyin for non-Chinese works."
        aliases_rule = f'- \'aliases\': Alternate in-universe names, titles, and epithets (ALWAYS include "{q_clean}" if different from name). Do NOT include any Chinese or pinyin translations.'
        pinyin_schema = '"pinyin_or_chinese": "",'

    prompt = f"""
{intro_desc}

{f"Wiki Text:\n{wiki_text[:8000]}" if wiki_text else ""}

Analyze the term "{q_clean}" in "{novel_title}":
1. Canonical Verification:
   - Is "{q_clean}" a recognized, canonical named entity in "{novel_title}"? If it is a generic word, minor unnamed background element, or not in the novel, return an empty array: []
2. Primary Character Moniker Consolidation:
   - If "{q_clean}" is a courtesy name, birth name, title, epithet, or moniker of an established primary character (e.g. "Yiling Laozu" is Wei Wuxian; "Hanguang-jun" is Lan Wangji; "San Lang" is Hua Cheng):
     Set 'name' to the character's primary canonical name (e.g. "Wei Wuxian") and include "{q_clean}" in 'aliases'.
3. Distinct Races, Creatures, Weapons, Items, Clans, Locations, or Concepts:
   - If "{q_clean}" is a race/creature (e.g. "Spiritual Beast", "Fox Spirit", "Demonic Beast"), weapon/item (e.g. "Transportation Talisman", "Zidian", "Chenqing"), clan/sect (e.g. "Gusu Lan Clan"), location (e.g. "Cloud Recesses"), or cultivation concept (e.g. "Golden Core"):
     Set 'name' to the recognized standard English/Pinyin name (e.g. "{q_clean}").
     Set 'category' to EXACTLY ONE OF:
       "Character", "Race / Creature", "Weapon / Item", "Clan / Sect", "Location / Realm", "Concept / Lore".
4. Extract:
   - 'name': Standard name
   - 'category': One of the 6 canonical categories above
   {pinyin_rule}
   {aliases_rule}
   - 'sect_or_affiliation': Associated clan, wielder, creator, or region
   - 'summary': Strictly ONE-SENTENCE, completely spoiler-free introductory description.
5. Critical Anti-Spoiler Rules:
   - NEVER mention death, murder, execution, or late-story plot fates!
   - Describe ONLY what/who it is when introduced.

Return a valid JSON array with 1 object (or [] if not canon):
[
  {{
    "name": "Standard Name",
    "category": "Weapon / Item",
    {pinyin_schema}
    "aliases": ["Alias 1", "{q_clean}"],
    "sect_or_affiliation": "Affiliation or Clan",
    "summary": "One sentence spoiler-free introductory description."
  }}
]
Only return valid JSON array.
"""

    models_to_try = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.5-flash-lite"]
    last_err = None

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
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)
            if not isinstance(data, list) or len(data) == 0:
                return [], "Not a recognized canonical novel entity."

            item = data[0]
            name = item.get("name", "").strip()
            if not name:
                return [], "Could not resolve name."

            aliases = item.get("aliases", [])
            if q_clean.lower() != name.lower() and q_clean not in aliases:
                aliases.append(q_clean)

            # Clean aliases
            clean_aliases = [
                a for a in aliases 
                if a and a.strip().lower() not in ["location", "locations", "character", "characters", "weapon", "weapons", "item", "items", "clan", "clans", "sect", "sects", "concept", "concepts", "lore"]
            ]

            card = {
                "id": slugify(name),
                "name": name,
                "category": item.get("category", "Character"),
                "pinyin_or_chinese": item.get("pinyin_or_chinese", "") if is_chinese else "",
                "aliases": clean_aliases,
                "sect_or_affiliation": item.get("sect_or_affiliation", ""),
                "affiliation": item.get("sect_or_affiliation", ""),
                "summary": item.get("summary", "")
            }
            clean_entry_for_novel(card, is_chinese=is_chinese)
            return [card], ""
        except Exception as e:
            last_err = str(e)
            continue

    return [], last_err or "Service temporarily busy"

def sanitize_wiki_data_with_gemini(raw_text: str, novel_title: str, query: str = "", target_category: str = "", genre: str = "") -> Tuple[List[Dict[str, Any]], str]:
    """Uses Gemini to extract or generate spoiler-free 1-line glossary cards."""
    client = get_gemini_client()
    if not client:
        return [], "Gemini client not initialized. Please ensure GEMINI_API_KEY is set in .env"

    is_chinese = is_chinese_novel(novel_title, genre)
    non_chinese_note = ""
    if not is_chinese:
        non_chinese_note = f'\nCRITICAL DIRECTIVE: "{novel_title}" is NOT a Chinese, Xianxia, or Danmei novel. Under NO circumstances should you produce or invent Chinese characters, Hanzi, or Pinyin romanizations. Set "pinyin_or_chinese" to "". Do NOT include Chinese or pinyin translations in "aliases".'

    is_character_lookup = bool(
        query and 
        query.strip().lower() not in [novel_title.strip().lower(), "all", "characters", "cast", "wiki", ""]
    )

    if is_character_lookup:
        q_clean = query.strip().lower()
        if q_clean in GENERIC_COMMON_WORDS:
            return [], "Common generic word; not an official novel entity."

        # Prompt designed to look up a Character, Weapon/Item, Clan/Sect, or Location
        if raw_text and len(raw_text.strip()) > 80:
            prompt = f"""
You are an expert editor for Xianxia, Wuxia, and Danmei translated novels.
Below is wiki text for "{query}" from the novel "{novel_title}".
Produce a clean, strictly spoiler-free glossary card for new readers.
Note: This entry can be a Character, a Weapon or Spiritual Item (e.g. "Zidian", "Chenqing", "Suibian"), a Clan/Sect (e.g. "Lanling Jin Clan"), or a Location/Realm (e.g. "Cloud Recesses", "Lotus Pier").

Rules:
1. Extract:
   - 'name': Standard recognized English/Pinyin name (e.g. "Zidian", "Madam Jin", "Cloud Recesses").
   - 'category': One of "Character", "Weapon / Item", "Clan / Sect", or "Location / Concept".
   - 'pinyin_or_chinese': Chinese Hanzi and/or Pinyin (e.g. "紫电" or "金夫人").
   - 'aliases': All other common aliases, translated titles, alternate names, and nicknames.
   - 'sect_or_affiliation': Associated clan, wielder, owner, or region (e.g. "Yunmeng Jiang Clan / Wielded by Madam Yu and Jiang Cheng").
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES (MUST FOLLOW STRICTLY):
   - NEVER mention death, execution, murder, destruction, or endgame plot reveals!
   - NEVER state what happens to it later in the plot or tragic late-story twists.
   - Describe ONLY what/who it is when introduced in the story.
3. CANONICAL VERIFICATION:
   - If this wiki page does not correspond to a specific canonical named entity in "{novel_title}", return an empty array: []

Wiki Text:
\"\"\"
{raw_text[:12000]}
\"\"\"

Return a valid JSON array with 1 object:
[
  {{
    "name": "Primary Name",
    "category": "Weapon / Item",
    "pinyin_or_chinese": "Chinese/Pinyin or empty",
    "aliases": ["Alias 1", "Alternate Name"],
    "sect_or_affiliation": "Sect, Clan, or Wielder",
    "summary": "Strictly 1-sentence spoiler-free introductory description with zero plot fates or deaths."
  }}
]
Only return valid JSON array.
"""
        else:
            prompt = f"""
You are an authoritative scholar and canon fact-checker for translated Xianxia, Wuxia, and Danmei literature.
The user is reading chapters in a book titled "{novel_title}".
They want to verify and look up the entry "{query}".

CRITICAL CANONICAL INTEGRITY & TRANSLATION DIRECTIVES:
1. TRANSLATION SYNONYMS & UNIVERSES:
   - Recognize canonical entities across translation variations (e.g. "Sect" vs "Clan" vs "Family", such as "Yunmeng Jiang Sect" = "Yunmeng Jiang Clan" = 云梦江氏; "Gusu Lan Sect" = "Gusu Lan Clan" = 姑苏蓝氏; "Lanling Jin Sect" = "Lanling Jin Clan" = 兰陵金氏; "Qishan Wen Sect" = "Qishan Wen Clan" = 岐山温氏).
   - If "{novel_title}" is a custom title, placeholder, or imported volume, recognize "{query}" if it is a verifiable canonical entity in Xianxia/Danmei literature (such as Mo Dao Zu Shi, TGCF, SVSSS, Erha/2ha, etc.). Always include the user's queried string "{query}" in the 'aliases' array so it matches reader text.
2. PRIMARY CANONICAL ENTITY CONSOLIDATION:
   - If "{query}" is a title, courtesy name (字), birth name (名), epithet, alias, or moniker of an established character (for example, "Yiling Laozu" or "Yiling Patriarch" or "Wei Ying" is Wei Wuxian; "Hanguang-jun" or "Lan Zhan" is Lan Wangji; "Lianfang-zun" is Jin Guangyao; "Zewu-jun" is Lan Xichen; "San Lang" or "Crimson Rain Sought Flower" is Hua Cheng; "Taizi Dianxia" is Xie Lian; "Taxian-jun" or "Mo Ran" is Mo Weiyu), ALWAYS set 'name' to the character's primary canonical standard name (e.g. "Wei Wuxian") and include "{query}" in the 'aliases' array. Do NOT create an isolated separate entry under the moniker.
3. GENERIC WORD REJECTION:
   - If "{query}" is a generic English dictionary word, common object, descriptive phrase, or minor background element not given a specific canonical name/identity, return an empty array: []
4. STRICT CANONICAL ENTITY REQUIREMENTS:
   - Return a glossary card ONLY if "{query}" refers to a specific, recognized, NAMED Character, Weapon/Artifact, Clan/Sect, or Canonical Location/Lore.
   - If it is not a verifiable named canonical entity, return []!
5. CRITICAL ANTI-SPOILER RULES (MUST FOLLOW STRICTLY):
   - NEVER mention death, execution, murder, or whether a character/item is destroyed!
   - NEVER state what happens to them in the plot.
   - Describe ONLY its baseline nature upon introduction.

Return a valid JSON array with 1 object (or [] if not verifiable canon):
[
  {{
    "name": "Standard Canon Name",
    "category": "Clan / Sect",
    "pinyin_or_chinese": "Chinese Hanzi or Pinyin",
    "aliases": ["{query}", "Alternate Translation"],
    "sect_or_affiliation": "Affiliation or Region",
    "summary": "One sentence introductory description with zero plot fates or deaths."
  }}
]
Only return valid JSON array.
"""
    cat = target_category or detect_category_from_text(raw_text) or detect_category_from_text(query) or "Character"

    if cat == "Location / Realm":
        prompt = f"""
You are an authoritative scholar for Xianxia, Wuxia, and Danmei translated literature.
Below is wiki / guide data regarding locations and realms in the novel "{novel_title}".
{f"Wiki Text:\n{raw_text[:12000]}" if raw_text and len(raw_text.strip()) > 40 else f"Generate a comprehensive, strictly spoiler-free directory of 15-25 major canonical locations, mountains, cities, sect headquarters, and realms in '{novel_title}'."}

Rules:
1. For each canonical location:
   - 'name': Primary recognized English/Pinyin name (e.g. "Cloud Recesses", "Lotus Pier", "Burial Mounds", "Nightless City", "Golden Carp Tower", "Guanyin Temple", "Yi City", "Dafan Mountain", "Caiyi Town").
   - 'category': "Location / Realm".
   - 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. "云深不知处").
   - 'aliases': All alternate translations, romanizations, and regional titles.
   - 'sect_or_affiliation': Associated clan, sect, or region (e.g. "Gusu Lan Clan", "Yunmeng Jiang Clan").
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES (MUST FOLLOW STRICTLY):
   - NEVER mention destruction, massacre, battle deaths, siege outcomes, or late plot revelations!
   - Describe ONLY what the place is when introduced in the story.
3. CANONICAL VERIFICATION:
   - Only return genuine canonical locations in "{novel_title}". Exclude generic words or non-novel entities.

Return a valid JSON array of objects:
[
  {{
    "name": "Primary Location Name",
    "category": "Location / Realm",
    "pinyin_or_chinese": "Chinese / Pinyin",
    "aliases": ["Alias 1", "Pinyin/Translation"],
    "sect_or_affiliation": "Associated Clan or Region",
    "summary": "Strictly 1-sentence spoiler-free introductory description with zero plot fates or destructions."
  }}
]
Only return valid JSON array.
"""
    elif cat == "Weapon / Item":
        prompt = f"""
You are an authoritative scholar for Xianxia, Wuxia, and Danmei translated literature.
Below is wiki / guide data regarding weapons, spiritual tools, and artifacts in the novel "{novel_title}".
{f"Wiki Text:\n{raw_text[:12000]}" if raw_text and len(raw_text.strip()) > 40 else f"Generate a comprehensive, strictly spoiler-free directory of 15-25 major canonical spiritual weapons, musical instruments, talismans, and artifacts in '{novel_title}'."}

Rules:
1. For each canonical weapon or spiritual item:
   - 'name': Primary recognized English/Pinyin name (e.g. "Bichen", "Suibian", "Zidian", "Chenqing", "Stygian Tiger Seal").
   - 'category': "Weapon / Item".
   - 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. "紫电").
   - 'aliases': All alternate translations, wielder titles, and nicknames.
   - 'sect_or_affiliation': Associated wielder, creator, or clan (e.g. "Jiang Cheng / Yunmeng Jiang Clan").
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES (MUST FOLLOW STRICTLY):
   - NEVER mention death, execution, destruction, or endgame plot reveals!
   - Describe ONLY its baseline nature when introduced.

Return a valid JSON array of objects:
[
  {{
    "name": "Weapon Name",
    "category": "Weapon / Item",
    "pinyin_or_chinese": "Chinese / Pinyin",
    "aliases": ["Alias 1"],
    "sect_or_affiliation": "Wielder or Clan",
    "summary": "Strictly 1-sentence spoiler-free introductory description."
  }}
]
Only return valid JSON array.
"""
    elif cat == "Clan / Sect":
        prompt = f"""
You are an authoritative scholar for Xianxia, Wuxia, and Danmei translated literature.
Below is wiki / guide data regarding cultivation clans, sects, and factions in the novel "{novel_title}".
{f"Wiki Text:\n{raw_text[:12000]}" if raw_text and len(raw_text.strip()) > 40 else f"Generate a comprehensive, strictly spoiler-free directory of all major cultivation clans, sects, and factions in '{novel_title}'."}

Rules:
1. For each canonical clan or sect:
   - 'name': Standard recognized name (e.g. "Gusu Lan Clan", "Yunmeng Jiang Clan", "Lanling Jin Clan", "Qishan Wen Clan", "Qinghe Nie Clan").
   - 'category': "Clan / Sect".
   - 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. "姑苏蓝氏").
   - 'aliases': Alternate translations (e.g. "Gusu Lan Sect", "Yunmeng Jiang Sect", "Clan" vs "Sect").
   - 'sect_or_affiliation': Headquarters region or motif (e.g. "Cloud Recesses, Gusu").
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES:
   - NEVER mention clan downfall, massacre, or war outcomes!

Return a valid JSON array of objects:
[
  {{
    "name": "Clan Name",
    "category": "Clan / Sect",
    "pinyin_or_chinese": "Chinese / Pinyin",
    "aliases": ["Alternate Translation"],
    "sect_or_affiliation": "Headquarters Region",
    "summary": "Strictly 1-sentence spoiler-free introductory description."
  }}
]
Only return valid JSON array.
"""
    elif cat == "Concept / Lore":
        prompt = f"""
You are an authoritative scholar for Xianxia, Wuxia, and Danmei translated literature.
Below is wiki / guide data regarding cultivation concepts, spiritual techniques, and lore in the novel "{novel_title}".
{f"Wiki Text:\n{raw_text[:12000]}" if raw_text and len(raw_text.strip()) > 40 else f"Generate a comprehensive, strictly spoiler-free directory of 10-20 major cultivation concepts, spiritual techniques, and lore terms in '{novel_title}'."}

Rules:
1. For each concept:
   - 'name': Standard recognized English/Pinyin name (e.g. "Golden Core", "Resentful Energy", "Inquiry", "Demonic Cultivation").
   - 'category': "Concept / Lore".
   - 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. "金丹").
   - 'aliases': Alternate translations and pinyin.
   - 'sect_or_affiliation': Associated discipline or clan.
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES:
   - NEVER mention endgame reveals, character deaths, or secret plot twists!

Return a valid JSON array of objects:
[
  {{
    "name": "Concept Name",
    "category": "Concept / Lore",
    "pinyin_or_chinese": "Chinese / Pinyin",
    "aliases": ["Alternate Translation"],
    "sect_or_affiliation": "Discipline / Clan",
    "summary": "Strictly 1-sentence spoiler-free introductory description."
  }}
]
Only return valid JSON array.
"""
    elif raw_text and len(raw_text.strip()) > 80:
        prompt = f"""
You are an expert editor for Xianxia, Wuxia, and Danmei translated novels.
Below is text from a character wiki / guide for the novel "{novel_title}".
Produce a clean, strictly spoiler-free character glossary for new readers.

Rules:
1. Extract the main characters, courtesy names (字), birth names (名), titles (号), and sect affiliations.
2. CRITICAL ANTI-SPOILER RULES FOR 'summary' (MUST FOLLOW STRICTLY):
   - NEVER mention death, execution, murder, or whether a character is alive or dead!
   - NEVER state what happens to them in the plot or how their story ends (e.g. NEVER write "who dies...", "fatally forced to...", "murdered by...", "later killed...").
   - NEVER reveal secret evil masterminds, hidden betrayals, or tragic late-story plot twists.
   - The summary must answer ONLY "Who is this person when introduced?": their baseline social occupation, sect rank, family relation, or personality (e.g. "A servant boy in the Mo household", "Mo Xuanyu's cousin", "A junior disciple of the Gusu Lan Clan").
3. Keep all common aliases, courtesy names, and clan titles.

Wiki Text:
\"\"\"
{raw_text[:12000]}
\"\"\"

Return a valid JSON array of objects:
[
  {{
    "name": "Primary Name",
    "category": "Character",
    "pinyin_or_chinese": "Chinese/Pinyin or empty",
    "aliases": ["Alias 1", "Courtesy Name", "Title"],
    "sect_or_affiliation": "Sect or Clan",
    "summary": "Strictly 1-sentence spoiler-free introductory description with zero plot fates or deaths."
  }}
]
Only return valid JSON array.
"""
    else:
        # Fallback to Gemini's deep knowledge of the novel
        prompt = f"""
You are an expert on Xianxia, Wuxia, and Danmei translated novels.
Generate a comprehensive, strictly spoiler-free character directory for the novel "{novel_title}".
Include the primary protagonists, major sect leaders, disciples, and key supporting figures (aim for 15-25 characters).

Rules:
1. For each character, identify:
   - 'name': Primary recognized English/Pinyin name (e.g. "Wei Wuxian", "Lan Wangji", "Jiang Cheng", "Jin Ling", "Nie Huaisang", "Wen Ning", "Lan Xichen", "Jiang Yanli").
   - 'category': "Character".
   - 'pinyin_or_chinese': Chinese Hanzi or Pinyin (e.g. "魏无羡").
   - 'aliases': All common aliases, birth names, courtesy names (字), and clan titles (号) (e.g. ["Wei Ying", "Yiling Patriarch", "A-Xian"]).
   - 'sect_or_affiliation': Their clan or faction (e.g. "Yunmeng Jiang Clan", "Gusu Lan Clan", "Lanling Jin Clan").
   - 'summary': Strictly ONE SENTENCE, completely spoiler-free introductory description.
2. CRITICAL ANTI-SPOILER RULES (MUST FOLLOW STRICTLY):
   - NEVER mention death, execution, murder, or whether a character is alive or dead!
   - NEVER state what happens to them in the plot (e.g. do NOT write "who dies...", "fatally forced to...", "murdered by...", "who falls victim to...").
   - NEVER reveal secret evil masterminds, hidden betrayals, or endgame revelations.
   - The summary must describe ONLY their baseline role upon introduction: their personality, occupation, sect rank, or family relation (e.g. "A gentle young disciple of the Qishan Wen Clan skilled in archery", "The domineering matriarch of the Mo family estate", "A servant boy in the Mo household").

Return a valid JSON array of objects:
[
  {{
    "name": "Primary Name",
    "category": "Character",
    "pinyin_or_chinese": "Hanzi or Pinyin",
    "aliases": ["Alias 1", "Title 1"],
    "sect_or_affiliation": "Sect Name",
    "summary": "One sentence introductory description with zero plot fates or deaths."
  }}
]
Only return valid JSON array.
"""

    models_to_try = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.5-flash-lite"]
    last_err = None

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
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)
            result = []
            for item in data:
                name = item.get("name", "").strip()
                summary = item.get("summary", "").strip()
                if not name:
                    continue

                # Failsafe check: if summary explicitly mentions non-canon or absence
                lower_sum = summary.lower()
                if any(h in lower_sum for h in ["not mentioned in canon", "not canonical", "fictional character not", "does not appear in", "not a real character", "not in the novel"]):
                    continue

                # Ensure queried string is included in aliases ONLY if it is a specific character/entity name, not a batch/category
                aliases = item.get("aliases", [])
                is_batch_or_cat = any(k in query.lower() for k in ["category:", "locations", "location", "characters", "character", "weapons", "weapon", "items", "item", "clans", "clan", "sects", "sect", "concepts", "concept", "lore", "all", "cast", "wiki"])
                if query and not is_batch_or_cat and query.strip().lower() != name.lower() and query.strip() not in aliases:
                    aliases.append(query.strip())

                # Filter out accidental generic category words from aliases
                clean_aliases = [
                    a for a in aliases 
                    if a and a.strip().lower() not in ["location", "locations", "character", "characters", "weapon", "weapons", "item", "items", "clan", "clans", "sect", "sects", "concept", "concepts", "lore", "all", "cast", "wiki"]
                ]

                card = {
                    "id": slugify(name),
                    "name": name,
                    "category": item.get("category") or cat or "Character",
                    "pinyin_or_chinese": item.get("pinyin_or_chinese", "") if is_chinese else "",
                    "aliases": clean_aliases,
                    "sect_or_affiliation": item.get("sect_or_affiliation", ""),
                    "affiliation": item.get("sect_or_affiliation", ""),
                    "summary": summary
                }
                clean_entry_for_novel(card, is_chinese=is_chinese)
                result.append(card)
            return result, ""
        except Exception as e:
            last_err = str(e)
            print(f"Notice: Model {model_name} encountered error ({last_err}). Trying fallback model...")
            continue

    print(f"Error sanitizing/generating wiki data across all models: {last_err}")
    return [], last_err or "Service temporarily busy"
