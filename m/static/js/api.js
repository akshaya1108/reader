/**
 * Supabase & Offline IndexedDB Hybrid API Adapter for Xianxia Reader Mobile.
 * Connects directly to cloud Supabase with local-first IndexedDB offline caching.
 * Ensures complete offline capability on iPhone and seamless auto-sync.
 */

import { offlineDB } from './db.js';

const SUPABASE_URL = 'https://bhpajsjpimiifmfiqybj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3AORVL5y3dIAqH_UbnfzVg_ruEGFr5O';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const UPSERT_HEADERS = {
  ...HEADERS,
  'Prefer': 'resolution=merge-duplicates'
};

let lastSyncTimestamp = new Date();


async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function getEffectiveGeminiApiKey() {
  const DEFAULT_KEY = atob('QVEuQWI4Uk42SU5QdEVtdjRFOTF1aHY5MzhyTGVCM1VkamJRRWpuTlNBQS0ySzk1WGlzdnc=');
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('xianxia_gemini_api_key');
      if (stored && stored.trim() !== DEFAULT_KEY) {
        localStorage.removeItem('xianxia_gemini_api_key');
      }
    } catch (_) {}
  }
  return DEFAULT_KEY;
}

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest'
];

function isChineseNovel(title = '', genre = '') {
  const t = (title || '').toLowerCase();
  const g = (genre || '').toLowerCase();
  const keywords = ['xianxia', 'danmei', 'wuxia', 'cultivation', 'xuanhuan', 'chinese', 'qihuan'];
  if (keywords.some(kw => t.includes(kw) || g.includes(kw))) return true;
  const knownTitles = [
    'mo dao zu shi', 'grandmaster of demonic cultivation', 'tian guan ci fu',
    'heaven official', 'scum villain', 'erha', 'dumb husky', '2ha',
    'sha po lang', 'qiang jin jiu'
  ];
  if (knownTitles.some(kt => t.includes(kt))) return true;
  return /[\u4e00-\u9fff]/.test(title + genre);
}

async function callGeminiDirect(prompt) {
  const apiKey = getEffectiveGeminiApiKey();
  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 250,
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`Gemini model ${model} responded with ${res.status}. Trying next model...`);
        continue;
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          if (parsed && typeof parsed === 'object') return [parsed];
        } catch (_) {
          const m = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              if (Array.isArray(parsed) && parsed.length > 0) return parsed;
              if (parsed && typeof parsed === 'object') return [parsed];
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.warn(`Gemini model ${model} error:`, err);
      continue;
    }
  }
  return null;
}

function escapeSearchHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractChapterSearchSnippets(contentHtml, query) {
  if (!contentHtml || !query) return [];

  let rawParagraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(contentHtml)) !== null) {
    rawParagraphs.push(m[1]);
  }

  if (rawParagraphs.length === 0) {
    const clean = contentHtml.replace(/<br\s*\/?>/gi, '\n');
    rawParagraphs = clean.split('\n').map(p => p.trim()).filter(Boolean);
  }

  const matches = [];
  const qLower = query.toLowerCase();

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const pHtml = rawParagraphs[pIdx];
    let text = pHtml.replace(/<[^>]+>/g, '');
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!text) continue;

    const textLower = text.toLowerCase();
    let start = 0;
    while (true) {
      const pos = textLower.indexOf(qLower, start);
      if (pos === -1) break;

      const matchText = text.slice(pos, pos + query.length);
      const beforeStr = text.slice(0, pos);
      const afterStr = text.slice(pos + query.length);

      const beforeWords = beforeStr.trim().split(/\s+/).filter(Boolean);
      const afterWords = afterStr.trim().split(/\s+/).filter(Boolean);

      let snippetBefore = '';
      if (beforeWords.length > 14) {
        snippetBefore = '...' + beforeWords.slice(-14).join(' ') + ' ';
      } else {
        snippetBefore = beforeStr;
      }

      let snippetAfter = '';
      if (afterWords.length > 14) {
        snippetAfter = ' ' + afterWords.slice(0, 14).join(' ') + '...';
      } else {
        snippetAfter = afterStr;
      }

      const safeBefore = escapeSearchHtml(snippetBefore);
      const safeMatch = `<mark class="search-match">${escapeSearchHtml(matchText)}</mark>`;
      const safeAfter = escapeSearchHtml(snippetAfter);
      const snippetHtml = `${safeBefore}${safeMatch}${safeAfter}`;

      matches.push({
        paragraph_index: pIdx,
        snippet_html: snippetHtml,
        text_before: snippetBefore,
        match_text: matchText,
        text_after: snippetAfter
      });

      start = pos + query.length;
    }
  }

  return matches;
}

function searchGlossaryClientSide(glossary, query) {
  if (!glossary || !query) return [];
  const qLower = query.toLowerCase().trim();
  const results = [];

  for (const entry of glossary) {
    const name = entry.name || '';
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    const pinyin = entry.pinyin_or_chinese || '';
    const summary = entry.summary || entry.notes || '';
    const sect = entry.affiliation || entry.sect_or_affiliation || '';
    const category = entry.category || 'Character';

    let matchedField = null;
    let matchedAlias = null;

    if (name.toLowerCase().includes(qLower)) {
      matchedField = 'name';
    } else {
      const foundAlias = aliases.find(a => (a || '').toLowerCase().includes(qLower));
      if (foundAlias) {
        matchedField = 'alias';
        matchedAlias = foundAlias;
      } else if (pinyin && pinyin.toLowerCase().includes(qLower)) {
        matchedField = 'pinyin';
      } else if (summary && summary.toLowerCase().includes(qLower)) {
        matchedField = 'summary';
      } else if (sect && sect.toLowerCase().includes(qLower)) {
        matchedField = 'sect';
      }
    }

    if (matchedField) {
      results.push({
        ...entry,
        id: entry.id,
        name,
        category,
        pinyin_or_chinese: pinyin,
        aliases,
        affiliation: sect,
        sect_or_affiliation: sect,
        summary,
        matched_field: matchedField,
        matched_alias: matchedAlias
      });
    }
  }

  return results;
}

export const api = {
  getLastSyncTime() {
    return lastSyncTimestamp;
  },

  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  async getBooks() {
    if (this.isOnline()) {
      try {
        const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/books?select=*&order=title.asc`, {
          headers: HEADERS,
          cache: 'no-store'
        }, 2500);
        if (res.ok) {
          const books = await res.json();
          // Normalize fields for frontend compatibility
          const normalized = books.map(b => {
            const sharedId = b.shared_glossary_id || (b.bookmark && b.bookmark._shared_glossary_id) || null;
            return {
              ...b,
              cover: b.cover_image || b.cover || '',
              chapters_count: b.total_chapters || b.chapters_count || 0,
              total_words: b.word_count || b.total_words || 0,
              shared_glossary_id: sharedId
            };
          });
          try {
            if (normalized.length > 0) {
              await offlineDB.saveBooks(normalized);
            }
          } catch (storageErr) {
            console.warn('Storage cache notice:', storageErr);
          }
          lastSyncTimestamp = new Date();
          return normalized;
        }
      } catch (e) {
        console.warn('Cloud books fetch timeout or network error, immediately using local cache:', e);
      }
    }

    // Offline / network failure fallback
    const localBooks = await offlineDB.getBooks();
    return localBooks.map(b => {
      const sharedId = b.shared_glossary_id || (b.bookmark && b.bookmark._shared_glossary_id) || null;
      return {
        ...b,
        cover: b.cover_image || b.cover || '',
        chapters_count: b.total_chapters || b.chapters_count || 0,
        total_words: b.word_count || b.total_words || 0,
        shared_glossary_id: sharedId
      };
    });
  },

  async getClusterBookIds(bookId) {
    try {
      const books = await this.getBooks();
      const targetBook = books.find(b => b.id === bookId);
      let canonicalId = targetBook?.shared_glossary_id || (targetBook?.bookmark && targetBook.bookmark._shared_glossary_id);
      if (!canonicalId) {
        for (const cl of KNOWN_CLUSTERS) {
          if (cl.includes(bookId)) {
            canonicalId = 'the-two-towers';
            break;
          }
        }
      }
      if (!canonicalId) canonicalId = bookId;

      const cluster = new Set([bookId, canonicalId]);
      for (const cl of KNOWN_CLUSTERS) {
        if (cl.includes(bookId) || cl.includes(canonicalId)) {
          cl.forEach(id => cluster.add(id));
        }
      }
      books.forEach(b => {
        const bCanon = b.shared_glossary_id || (b.bookmark && b.bookmark._shared_glossary_id);
        if (b.id === canonicalId || bCanon === canonicalId || bCanon === bookId || b.id === bookId) {
          cluster.add(b.id);
        }
      });
      return Array.from(cluster).filter(Boolean);
    } catch (e) {
      console.warn('Error resolving cluster book ids:', e);
      for (const cl of KNOWN_CLUSTERS) {
        if (cl.includes(bookId)) return cl;
      }
      return [bookId];
    }
  },

  async getBook(bookId) {
    const books = await this.getBooks();
    return books.find(b => b.id === bookId) || await offlineDB.getBook(bookId);
  },

  async updateBook(bookId, data) {
    const canonId = await this.getGlossaryCanonicalId(bookId);
    const books = await this.getBooks();
    const targetBook = books.find(b => b.id === bookId);
    const clusterCanon = targetBook?.shared_glossary_id || (canonId !== bookId ? canonId : null);

    const nowIso = data.last_read_at || new Date().toISOString();

    let bookmarkPayload = data.bookmark;
    if (bookmarkPayload !== undefined) {
      if (bookmarkPayload && typeof bookmarkPayload === 'object') {
        if (clusterCanon && !bookmarkPayload._shared_glossary_id) {
          bookmarkPayload = { ...bookmarkPayload, _shared_glossary_id: clusterCanon };
        }
      } else if (bookmarkPayload === null && clusterCanon) {
        bookmarkPayload = { _shared_glossary_id: clusterCanon };
      }
    }

    // 1. Update local IndexedDB immediately
    await offlineDB.updateBookProgress(bookId, {
      lastReadChapter: data.last_read_chapter,
      bookmark: bookmarkPayload,
      bookmarks: data.bookmarks,
      lastReadAt: nowIso
    });

    // 2. Update cloud if online, else queue
    const payload = {};
    if (data.last_read_chapter !== undefined) payload.last_read_chapter = data.last_read_chapter;
    payload.last_read_at = nowIso;
    if (bookmarkPayload !== undefined) payload.bookmark = bookmarkPayload;
    if (data.bookmarks !== undefined) payload.bookmarks = data.bookmarks;

    if (this.isOnline()) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${encodeURIComponent(bookId)}`, {
          method: 'PATCH',
          headers: HEADERS,
          body: JSON.stringify(payload)
        });
        if (res.ok) lastSyncTimestamp = new Date();
      } catch (e) {
        console.warn('Failed to sync progress to cloud, queued locally:', e);
        await offlineDB.queueSyncItem({ type: 'update_book', bookId, payload });
      }

      // Direct sync to local Flask backend when on Wi-Fi / local server
      if (typeof window !== 'undefined' && (window.location.origin.includes(':5001') || !window.location.hostname.includes('github.io'))) {
        try {
          await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (_) {}
      }
    } else {
      await offlineDB.queueSyncItem({ type: 'update_book', bookId, payload });
    }

    return { success: true };
  },

  async getChapters(bookId) {
    // 1. If online, fetch fresh list from cloud or local server first
    if (this.isOnline()) {
      try {
        const res = await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&select=chapter_number,title,word_count&order=chapter_number.asc`,
          { headers: HEADERS, cache: 'no-store' },
          2500
        );
        if (res.ok) {
          const list = await res.json();
          // Prune any deleted chapters from local IndexedDB
          await offlineDB.reconcileChaptersList(bookId, list);
          lastSyncTimestamp = new Date();
          return list;
        }
      } catch (e) {
        console.warn('Network timeout or error loading chapters list from cloud:', e);
      }
    }

    // 2. Check if book has downloaded/cached chapters in local IndexedDB
    const localChapters = await offlineDB.getChaptersList(bookId);
    if (localChapters && localChapters.length > 0) {
      return localChapters;
    }

    return [];
  },

  async deleteChapter(bookId, chapterNum) {
    const num = Number(chapterNum);
    // 1. Delete from local IndexedDB
    await offlineDB.deleteChapter(bookId, num);

    // 2. Delete from Supabase if online
    if (this.isOnline()) {
      try {
        await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&chapter_number=eq.${num}`,
          { method: 'DELETE', headers: HEADERS },
          3000
        );
        lastSyncTimestamp = new Date();
      } catch (e) {
        console.warn(`Failed to delete chapter ${num} from cloud:`, e);
      }
    }
    return { success: true };
  },

  async getChapter(bookId, chapterNum) {
    const num = Number(chapterNum);

    // 1. If online, fetch fresh chapter from cloud or local server first so chapter edits reflect
    if (this.isOnline()) {
      try {
        const res = await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&chapter_number=eq.${num}&select=*`,
          { headers: HEADERS, cache: 'no-store' },
          3000
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0) {
            const ch = rows[0];
            await offlineDB.saveChapters(bookId, [ch]);
            lastSyncTimestamp = new Date();
            return ch;
          }
        }
      } catch (e) {
        console.warn(`Cloud fetch chapter ${num} timed out or failed, falling back to offline cache:`, e);
      }
    }

    // 2. Check local IndexedDB (offline or cloud failed)
    const cached = await offlineDB.getChapter(bookId, num);
    if (cached && cached.content) {
      return cached;
    }

    throw new Error(`Chapter ${num} not available offline. Please connect to download.`);
  },

  async getGlossaryCanonicalId(bookId) {
    try {
      const books = await this.getBooks();
      const targetBook = books.find(b => b.id === bookId);
      return targetBook?.shared_glossary_id || (targetBook?.bookmark && targetBook.bookmark._shared_glossary_id) || bookId;
    } catch (_) {
      return bookId;
    }
  },

  async getGlossary(bookId) {
    const targetId = await this.getGlossaryCanonicalId(bookId);

    if (this.isOnline()) {
      try {
        const res = await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetId)}&select=*&order=name.asc`,
          { headers: HEADERS, cache: 'no-store' },
          2500
        );
        if (res.ok) {
          const entries = await res.json();
          // Store directly into canonical room in IndexedDB
          await offlineDB.saveGlossary(targetId, entries);
          if (targetId !== bookId) {
            await offlineDB.saveGlossary(bookId, entries);
          }
          lastSyncTimestamp = new Date();
          return entries;
        }
      } catch (e) {
        console.warn('Network error loading canonical glossary from cloud:', e);
      }
    }

    // Offline / fallback to local IndexedDB
    let local = await offlineDB.getGlossary(targetId);
    if ((!local || local.length === 0) && targetId !== bookId) {
      local = await offlineDB.getGlossary(bookId);
    }
    return local || [];
  },

  async saveGlossaryEntry(bookId, entry) {
    const targetId = await this.getGlossaryCanonicalId(bookId);
    const gid = entry.id || (entry.name || '').toLowerCase().trim().replace(/\s+/g, '-');
    const row = {
      book_id: targetId,
      id: gid,
      name: entry.name || '',
      category: entry.category || 'Character',
      pinyin_or_chinese: entry.pinyin_or_chinese || '',
      aliases: Array.isArray(entry.aliases) ? entry.aliases : (entry.aliases ? [entry.aliases] : []),
      affiliation: entry.affiliation || entry.sect_or_affiliation || '',
      sect_or_affiliation: entry.sect_or_affiliation || entry.affiliation || '',
      summary: entry.summary || entry.notes || '',
      mentions: Number(entry.mentions || 0),
      updated_at: new Date().toISOString()
    };

    // 1. Save directly into canonical room in IndexedDB
    await offlineDB.saveGlossaryEntry(targetId, row);
    if (targetId !== bookId) {
      await offlineDB.saveGlossaryEntry(bookId, { ...row, book_id: bookId });
    }

    // 2. Save directly into canonical room in Supabase
    if (this.isOnline()) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/glossary`, {
          method: 'POST',
          headers: UPSERT_HEADERS,
          body: JSON.stringify([row])
        });
        if (res.ok) {
          lastSyncTimestamp = new Date();
        } else {
          await offlineDB.queueSyncItem({ type: 'save_glossary', bookId: targetId, row });
        }
      } catch (e) {
        await offlineDB.queueSyncItem({ type: 'save_glossary', bookId: targetId, row });
      }

      // Direct sync to local Flask backend when on Wi-Fi / local server
      if (typeof window !== 'undefined' && (window.location.origin.includes(':5001') || !window.location.hostname.includes('github.io'))) {
        try {
          await fetch(`/api/books/${encodeURIComponent(targetId)}/glossary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(row)
          });
        } catch (_) {}
      }
    } else {
      await offlineDB.queueSyncItem({ type: 'save_glossary', bookId: targetId, row });
    }

    return row;
  },

  async deleteGlossaryEntry(bookId, charId, charName = '') {
    const targetId = await this.getGlossaryCanonicalId(bookId);
    const cleanId = (charId || '').trim();
    const cleanName = (charName || '').trim();
    const slugName = cleanName.toLowerCase().replace(/\s+/g, '-');

    // 1. Delete directly from canonical room in IndexedDB
    if (cleanId) await offlineDB.deleteGlossaryEntry(targetId, cleanId);
    if (cleanName) await offlineDB.deleteGlossaryEntry(targetId, cleanName);
    if (slugName && slugName !== cleanId) await offlineDB.deleteGlossaryEntry(targetId, slugName);

    if (targetId !== bookId) {
      if (cleanId) await offlineDB.deleteGlossaryEntry(bookId, cleanId);
      if (cleanName) await offlineDB.deleteGlossaryEntry(bookId, cleanName);
      if (slugName && slugName !== cleanId) await offlineDB.deleteGlossaryEntry(bookId, slugName);
    }

    // 2. Delete directly from canonical room in Supabase
    if (this.isOnline()) {
      try {
        if (cleanId) {
          await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetId)}&id=eq.${encodeURIComponent(cleanId)}`, {
            method: 'DELETE',
            headers: HEADERS
          });
        }
        if (cleanName) {
          await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetId)}&name=eq.${encodeURIComponent(cleanName)}`, {
            method: 'DELETE',
            headers: HEADERS
          });
        }
        if (slugName && slugName !== cleanId) {
          await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetId)}&id=eq.${encodeURIComponent(slugName)}`, {
            method: 'DELETE',
            headers: HEADERS
          });
        }
        lastSyncTimestamp = new Date();
      } catch (e) {
        console.warn(`Failed to delete glossary entry from cloud for ${targetId}:`, e);
        await offlineDB.queueSyncItem({ type: 'delete_glossary', bookId: targetId, charId: cleanId });
      }

      // Direct sync to local Flask backend when on Wi-Fi / local server
      if (typeof window !== 'undefined' && (window.location.origin.includes(':5001') || !window.location.hostname.includes('github.io'))) {
        try {
          await fetch(`/api/books/${encodeURIComponent(targetId)}/glossary/${encodeURIComponent(cleanId || slugName)}`, {
            method: 'DELETE'
          });
        } catch (_) {}
      }
    } else {
      await offlineDB.queueSyncItem({ type: 'delete_glossary', bookId: targetId, charId: cleanId });
    }

    return { success: true };
  },

  async lookupCharacter(bookId, name, add = false) {
    const targetBookId = await this.getGlossaryCanonicalId(bookId);
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { found: false, message: 'Name is required' };
    }
    const lowerName = cleanName.toLowerCase();

    // 1. Check local / cached glossary first
    const entries = await this.getGlossary(targetBookId);
    const existing = entries.find(e =>
      (e.name || '').toLowerCase() === lowerName ||
      (Array.isArray(e.aliases) && e.aliases.some(a => (a || '').toLowerCase() === lowerName)) ||
      (e.pinyin_or_chinese && e.pinyin_or_chinese.toLowerCase() === lowerName)
    );

    if (existing) {
      if (add) {
        const isDiff = (existing.name || '').toLowerCase() !== lowerName;
        if (isDiff) {
          const arr = Array.isArray(existing.aliases) ? [...existing.aliases] : [];
          if (!arr.some(a => (a || '').toLowerCase() === lowerName)) {
            existing.aliases = [...arr, cleanName];
            await this.saveGlossaryEntry(targetBookId, existing);
          }
        }
        return {
          found: true,
          already_existed: true,
          merged_into: existing.name,
          character: existing
        };
      }
      return {
        found: true,
        already_existed: true,
        is_alias: (existing.name || '').toLowerCase() !== lowerName,
        matched_as_alias: (existing.name || '').toLowerCase() !== lowerName,
        primary_name: existing.name,
        name: existing.name,
        character: existing
      };
    }

    // 2. If online and NOT on static GitHub Pages, try local Flask backend
    const isGitHub = typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.protocol === 'file:');
    if (!isGitHub && this.isOnline()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`/api/books/${encodeURIComponent(targetBookId)}/lookup-character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cleanName, add }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.found && data.character) {
            await this.saveGlossaryEntry(targetBookId, data.character);
            return data;
          }
        }
      } catch (_) {
        // Backend not on same origin or timed out - proceed to direct Gemini fallback
      }
    }

    // 3. Direct Gemini AI lookup fallback (runs on GitHub Pages and standalone mobile PWA)
    if (this.isOnline()) {
      try {
        const books = await this.getBooks();
        const book = books.find(b => b.id === targetBookId || b.id === bookId);
        const bookTitle = book ? (book.title || book.id) : targetBookId;
        const genre = book ? (book.genre || '') : '';
        const isChinese = isChineseNovel(bookTitle, genre);
        const prompt = `You are a canon lore expert for "${bookTitle}".
Identify the term "${cleanName}" in the novel (or its broader fantasy, mythological, Vedic, or literary lore).
If "${cleanName}" is an adjective, plural, or variant (e.g. "elven" -> Elves, "dwarven" -> Dwarves, "orcs" -> Orcs), resolve to canonical entity and keep "${cleanName}" in aliases.
If "${cleanName}" is a title, moniker, or courtesy name (e.g. "Yiling Laozu" -> Wei Wuxian, "Vyasa" -> Krishna Dvaipayana Vyasadeva), resolve to primary canonical name and keep "${cleanName}" in aliases.
Category must be exactly one of: "Character", "Race / Creature", "Location / Realm", "Weapon / Item", "Clan / Sect", "Concept / Lore".
Summary must be exactly ONE concise spoiler-free sentence.

Return a JSON array with 1 object:
[
  {
    "name": "Standard Canonical Name",
    "category": "Character",
    "pinyin_or_chinese": ${isChinese ? '"Hanzi / Pinyin"' : '""'},
    "aliases": ["${cleanName}"],
    "affiliation": "Clan, Realm, or Affiliation",
    "summary": "One concise spoiler-free sentence introductory description."
  }
]`;

        const dataArr = await callGeminiDirect(prompt);
        if (Array.isArray(dataArr) && dataArr.length > 0) {
          const raw = dataArr[0];
          const standardName = (raw.name || cleanName).trim();
          if (standardName) {
            // Check if AI resolved term to an existing character in glossary
            const matchInGlossary = entries.find(e =>
              (e.name || '').toLowerCase() === standardName.toLowerCase() ||
              (Array.isArray(e.aliases) && e.aliases.some(a => (a || '').toLowerCase() === standardName.toLowerCase()))
            );

            if (matchInGlossary) {
              const curAliases = Array.isArray(matchInGlossary.aliases) ? matchInGlossary.aliases : [];
              if (!curAliases.some(a => (a || '').toLowerCase() === lowerName)) {
                matchInGlossary.aliases = [...curAliases, cleanName];
              }
              if (add) {
                await this.saveGlossaryEntry(targetBookId, matchInGlossary);
              }
              return {
                found: true,
                character: matchInGlossary,
                merged_into: matchInGlossary.name,
                already_existed: true
              };
            }

            // Brand new character / entity
            const newAliases = Array.isArray(raw.aliases) ? [...raw.aliases] : [];
            if (!newAliases.some(a => (a || '').toLowerCase() === lowerName) && lowerName !== standardName.toLowerCase()) {
              newAliases.push(cleanName);
            }

            const cleanId = standardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `entity-${Date.now()}`;
            const newChar = {
              id: cleanId,
              name: standardName,
              category: raw.category || 'Character',
              affiliation: raw.affiliation || raw.sect_or_affiliation || '',
              sect_or_affiliation: raw.affiliation || raw.sect_or_affiliation || '',
              pinyin_or_chinese: isChinese ? (raw.pinyin_or_chinese || '') : '',
              aliases: newAliases,
              summary: raw.summary || '',
              mentions: 0
            };

            if (add) {
              await this.saveGlossaryEntry(targetBookId, newChar);
            }

            return {
              found: true,
              character: newChar,
              already_existed: false
            };
          }
        }
      } catch (geminiErr) {
        console.error('Direct Gemini lookup error:', geminiErr);
      }
    }

    return {
      found: false,
      message: 'Lore lookup unavailable offline. You can manually add this entry to the glossary.'
    };
  },

  async scrapeWiki(bookId, urlOrTitle) {
    const targetBookId = await this.getGlossaryCanonicalId(bookId);
    const cleanQuery = (urlOrTitle || '').trim();
    if (!cleanQuery) return { success: false, message: 'URL or title required' };

    // 1. Try local server first if available
    if (this.isOnline()) {
      try {
        const res = await fetch(`/api/books/${encodeURIComponent(targetBookId)}/scrape-wiki`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wiki_url_or_title: cleanQuery })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.characters) {
            for (const char of data.characters) {
              await this.saveGlossaryEntry(targetBookId, char);
            }
          }
          return data;
        }
      } catch (_) {}
    }

    // 2. Direct Gemini fallback
    const entityName = cleanQuery.replace(/^https?:\/\/.*\/wiki\//i, '').replace(/_/g, ' ').replace(/Category:/i, '').trim();
    const lookupRes = await this.lookupCharacter(targetBookId, entityName, false);
    if (lookupRes && lookupRes.character) {
      return {
        success: true,
        characters: [lookupRes.character],
        added_count: 1
      };
    }

    return { success: false, message: 'Could not extract details for this entry.' };
  },

  async search(bookId, query, scope = 'all', ch = null) {
    const qTrim = (query || '').trim();
    if (!qTrim) {
      return {
        query: '',
        glossary_matches: [],
        chapter_matches: [],
        total_lore_matches: 0,
        total_chapter_matches: 0,
        total_matches: 0,
        scope
      };
    }

    // 1. Try local Flask server if running
    if (this.isOnline()) {
      try {
        let url = `/api/books/${encodeURIComponent(bookId)}/search?q=${encodeURIComponent(qTrim)}&scope=${scope}`;
        if (ch !== null && ch !== undefined) url += `&ch=${ch}`;
        const res = await fetch(url);
        if (res.ok) {
          const serverData = await res.json();
          if (serverData && (Array.isArray(serverData.chapter_matches) || Array.isArray(serverData.glossary_matches))) {
            return serverData;
          }
        }
      } catch (e) {
        // Fall back to Supabase and IndexedDB search
      }
    }

    // 2. Client-side & Cloud search (GitHub Pages & offline capability)
    let glossaryMatches = [];
    if (scope === 'all' || scope === 'lore') {
      try {
        const glossary = await this.getGlossary(bookId);
        glossaryMatches = searchGlossaryClientSide(glossary, qTrim);
      } catch (err) {
        console.warn('Error fetching glossary for search:', err);
      }
    }

    let chapterMatches = [];
    let totalChapterMatches = 0;

    if (scope === 'all' || scope === 'chapters' || scope === 'all_chapters' || scope === 'this_chapter') {
      let matchingChapters = [];
      const targetCh = (ch !== null && ch !== undefined) ? Number(ch) : null;

      // Query Supabase chapters table if online
      if (this.isOnline()) {
        try {
          const encodedPattern = encodeURIComponent(`*${qTrim}*`);
          let sUrl = `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&content=ilike.${encodedPattern}&select=chapter_number,title,content&order=chapter_number.asc`;
          if (targetCh !== null) {
            sUrl += `&chapter_number=eq.${targetCh}`;
          }
          const sRes = await fetch(sUrl, { headers: HEADERS, cache: 'no-store' });
          if (sRes.ok) {
            matchingChapters = await sRes.json();
          }
        } catch (e) {
          console.warn('Supabase chapter search failed, falling back to local DB:', e);
        }
      }

      // If offline or Supabase returned no rows, search offline IndexedDB chapters
      if (!matchingChapters || matchingChapters.length === 0) {
        try {
          const qLower = qTrim.toLowerCase();
          if (targetCh !== null) {
            const singleCh = await offlineDB.getChapter(bookId, targetCh);
            if (singleCh && singleCh.content && singleCh.content.toLowerCase().includes(qLower)) {
              matchingChapters = [singleCh];
            }
          } else {
            const allOffline = await offlineDB.getAllChapters(bookId);
            matchingChapters = (allOffline || []).filter(c => c.content && c.content.toLowerCase().includes(qLower));
          }
        } catch (e) {
          console.warn('Offline DB search failed:', e);
        }
      }

      // Extract snippets from matching chapters
      for (const chItem of (matchingChapters || [])) {
        const chNum = Number(chItem.chapter_number);
        if (targetCh !== null && chNum !== targetCh) continue;
        const snippets = extractChapterSearchSnippets(chItem.content || '', qTrim);
        if (snippets.length > 0) {
          totalChapterMatches += snippets.length;
          chapterMatches.push({
            chapter_number: chNum,
            title: chItem.title || `Chapter ${chNum}`,
            match_count: snippets.length,
            snippets: snippets
          });
        }
      }
      chapterMatches.sort((a, b) => a.chapter_number - b.chapter_number);
    }

    return {
      query: qTrim,
      glossary_matches: glossaryMatches,
      chapter_matches: chapterMatches,
      total_lore_matches: glossaryMatches.length,
      total_chapter_matches: totalChapterMatches,
      total_matches: glossaryMatches.length + totalChapterMatches,
      scope
    };
  },

  // --- Offline Book Downloader ---
  async isBookDownloaded(bookId) {
    const status = await offlineDB.getDownloadStatus(bookId);
    return Boolean(status && status.downloadedAt);
  },

  async downloadBookForOffline(bookId, onProgress = () => {}) {
    if (!this.isOnline()) {
      throw new Error('Internet connection required to download books.');
    }

    onProgress({ status: 'starting', percent: 0, message: 'Preparing download...' });

    // 1. Fetch glossary
    onProgress({ status: 'glossary', percent: 5, message: 'Downloading lore glossary...' });
    const glRes = await fetch(
      `${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(bookId)}&select=*`,
      { headers: HEADERS }
    );
    if (glRes.ok) {
      const glEntries = await glRes.json();
      await offlineDB.saveGlossary(bookId, glEntries);
    }

    // 2. Fetch chapter list
    onProgress({ status: 'chapters_list', percent: 10, message: 'Fetching chapter index...' });
    const chListRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&select=chapter_number,title,word_count&order=chapter_number.asc`,
      { headers: HEADERS }
    );
    if (!chListRes.ok) throw new Error('Failed to load chapter list.');
    const chaptersList = await chListRes.json();
    const totalChapters = chaptersList.length;

    if (totalChapters === 0) {
      await offlineDB.setDownloadStatus(bookId, {
        downloadedAt: new Date().toISOString(),
        totalChapters: 0
      });
      onProgress({ status: 'complete', percent: 100, message: 'Download complete (0 chapters).' });
      return;
    }

    // 3. Batch download full chapter contents
    const batchSize = 10;
    let downloadedCount = 0;

    for (let i = 0; i < totalChapters; i += batchSize) {
      const chunkNums = chaptersList.slice(i, i + batchSize).map(c => c.chapter_number);
      const inQuery = chunkNums.join(',');
      
      const chunkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&chapter_number=in.(${inQuery})&select=*`,
        { headers: HEADERS }
      );

      if (chunkRes.ok) {
        const fullChapters = await chunkRes.json();
        await offlineDB.saveChapters(bookId, fullChapters);
        downloadedCount += fullChapters.length;

        // Pre-cache chapter images for offline viewing
        if (typeof caches !== 'undefined') {
          try {
            const cacheNames = await caches.keys();
            const activeCache = cacheNames[0] || 'xianxia-mobile-v27';
            const cache = await caches.open(activeCache);
            for (const ch of fullChapters) {
              const matches = (ch.content || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
              for (const m of matches) {
                let imgUrl = m[1];
                if (!imgUrl || imgUrl.startsWith('data:')) continue;
                if (imgUrl.startsWith('/api/books/')) {
                  const sub = imgUrl.match(/\/api\/books\/([^\/]+)\/images\/(.+)$/);
                  if (sub) {
                    const bId = sub[1];
                    const fName = sub[2];
                    const relUrl = `../data/chapters/${bId}/images/${fName}`;
                    const rawUrl = `https://raw.githubusercontent.com/akshaya1108/reader/main/data/chapters/${bId}/images/${fName}`;
                    cache.add(relUrl).catch(() => cache.add(rawUrl).catch(() => {}));
                    continue;
                  }
                }
                cache.add(imgUrl).catch(() => {});
              }
            }
          } catch (_) {}
        }
      }

      const pct = Math.min(95, Math.round(10 + (downloadedCount / totalChapters) * 85));
      onProgress({
        status: 'downloading',
        percent: pct,
        message: `Saved ${downloadedCount} of ${totalChapters} chapters (${pct}%)...`
      });
    }

    // 4. Mark download complete
    await offlineDB.setDownloadStatus(bookId, {
      downloadedAt: new Date().toISOString(),
      totalChapters
    });

    lastSyncTimestamp = new Date();
    onProgress({ status: 'complete', percent: 100, message: 'All chapters downloaded for offline reading!' });
  },

  async deleteOfflineBook(bookId) {
    await offlineDB.deleteDownloadedBook(bookId);
    return { success: true };
  },

  // --- Auto-Sync Outbound Queue ---
  async flushSyncQueue() {
    if (!this.isOnline()) return;

    const queue = await offlineDB.getSyncQueue();
    if (!queue || queue.length === 0) return;

    console.log(`Flushing ${queue.length} pending offline sync items to Supabase...`);
    for (const item of queue) {
      try {
        if (item.type === 'save_glossary') {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/glossary`, {
            method: 'POST',
            headers: UPSERT_HEADERS,
            body: JSON.stringify([item.row])
          });
          if (res.ok) await offlineDB.removeSyncItem(item.id);
        } else if (item.type === 'delete_glossary') {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(item.bookId)}&id=eq.${encodeURIComponent(item.charId)}`, {
            method: 'DELETE',
            headers: HEADERS
          });
          if (res.ok) await offlineDB.removeSyncItem(item.id);
        } else if (item.type === 'update_book') {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${encodeURIComponent(item.bookId)}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify(item.payload)
          });
          if (res.ok) await offlineDB.removeSyncItem(item.id);
        }
      } catch (e) {
        console.warn('Sync item failed to send:', e);
      }
    }
    lastSyncTimestamp = new Date();
  },

  // --- Connection Status Check ---
  async checkConnectionStatus() {
    const isOnline = this.isOnline();
    if (!isOnline) {
      return {
        online: false,
        cloudStatus: 'Offline',
        geminiStatus: 'Unavailable Offline',
        lastSync: lastSyncTimestamp
      };
    }

    try {
      const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/books?select=id&limit=1`, {
        headers: HEADERS,
        cache: 'no-store'
      }, 3000);
      const cloudOk = res.ok;

      // Flush sync queue in background
      this.flushSyncQueue().catch(() => {});

      return {
        online: true,
        cloudStatus: cloudOk ? 'Connected (Supabase)' : 'Connecting...',
        geminiStatus: 'Ready',
        lastSync: lastSyncTimestamp
      };
    } catch (e) {
      return {
        online: false,
        cloudStatus: 'Connection Timeout (Local mode active)',
        geminiStatus: 'Unavailable Offline',
        lastSync: lastSyncTimestamp
      };
    }
  }
};

// Auto flush queue when phone reconnects to internet
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Device is online. Flushing sync queue...');
    api.flushSyncQueue();
  });
}
