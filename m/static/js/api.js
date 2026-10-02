/**
 * Supabase & Offline IndexedDB Hybrid API Adapter for Xianxia Reader Mobile.
 * Connects directly to cloud Supabase with local-first IndexedDB offline caching.
 * Ensures complete offline capability on iPhone and seamless auto-sync.
 */

import { offlineDB } from './db.js';

const SUPABASE_URL = 'https://giqhugtncggxansflxaz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qfLGtg3uwojI-ITrA_t2ig_Wc-MpjuJ';

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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/books?select=*&order=title.asc`, {
          headers: HEADERS,
          cache: 'no-store'
        });
        if (res.ok) {
          const books = await res.json();
          // Normalize fields for frontend compatibility
          const normalized = books.map(b => ({
            ...b,
            cover: b.cover_image || b.cover || '',
            chapters_count: b.total_chapters || b.chapters_count || 0,
            total_words: b.word_count || b.total_words || 0
          }));
          await offlineDB.saveBooks(normalized);
          lastSyncTimestamp = new Date();
          return normalized;
        }
      } catch (e) {
        console.warn('Network error loading books from cloud, falling back to local DB:', e);
      }
    }

    // Offline / network failure fallback
    const localBooks = await offlineDB.getBooks();
    return localBooks.map(b => ({
      ...b,
      cover: b.cover_image || b.cover || '',
      chapters_count: b.total_chapters || b.chapters_count || 0,
      total_words: b.word_count || b.total_words || 0
    }));
  },

  async getBook(bookId) {
    const books = await this.getBooks();
    return books.find(b => b.id === bookId) || await offlineDB.getBook(bookId);
  },

  async updateBook(bookId, data) {
    // 1. Update local IndexedDB immediately
    await offlineDB.updateBookProgress(bookId, {
      lastReadChapter: data.last_read_chapter,
      bookmark: data.bookmark,
      lastReadAt: data.last_read_at || new Date().toISOString()
    });

    // 2. Update cloud if online, else queue
    const payload = {};
    if (data.last_read_chapter !== undefined) payload.last_read_chapter = data.last_read_chapter;
    if (data.last_read_at !== undefined) payload.last_read_at = data.last_read_at;
    if (data.bookmark !== undefined) payload.bookmark = data.bookmark;
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
    } else {
      await offlineDB.queueSyncItem({ type: 'update_book', bookId, payload });
    }

    return { success: true };
  },

  async getChapters(bookId) {
    // Check if book is saved offline
    const isOffline = await offlineDB.getDownloadStatus(bookId);
    if (isOffline) {
      const localChapters = await offlineDB.getChaptersList(bookId);
      if (localChapters && localChapters.length > 0) {
        return localChapters;
      }
    }

    // Fetch chapters list from Supabase
    if (this.isOnline()) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&select=chapter_number,title,word_count&order=chapter_number.asc`,
          { headers: HEADERS, cache: 'no-store' }
        );
        if (res.ok) {
          const list = await res.json();
          lastSyncTimestamp = new Date();
          return list;
        }
      } catch (e) {
        console.warn('Network error loading chapters list from cloud:', e);
      }
    }

    // Fallback to local chapters
    return await offlineDB.getChaptersList(bookId);
  },

  async getChapter(bookId, chapterNum) {
    const num = Number(chapterNum);

    // 1. Check local IndexedDB first for instant zero-latency load
    const cached = await offlineDB.getChapter(bookId, num);
    if (cached && cached.content) {
      return cached;
    }

    // 2. Fetch from Supabase if online
    if (this.isOnline()) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${encodeURIComponent(bookId)}&chapter_number=eq.${num}&select=*`,
          { headers: HEADERS, cache: 'no-store' }
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
        console.warn(`Failed to fetch chapter ${num} from cloud:`, e);
      }
    }

    if (cached) return cached;
    throw new Error(`Chapter ${num} not available offline. Please connect to download.`);
  },

  async getGlossary(bookId) {
    let targetBookId = bookId;
    try {
      const book = await this.getBook(bookId);
      if (book && book.shared_glossary_id) {
        targetBookId = book.shared_glossary_id;
      }
    } catch (e) {}

    if (this.isOnline()) {
      try {
        let res = await fetch(
          `${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(bookId)}&select=*&order=name.asc`,
          { headers: HEADERS, cache: 'no-store' }
        );
        let entries = res.ok ? await res.json() : [];

        // Fallback: If no entries found under bookId but targetBookId is different, fetch targetBookId
        if ((!entries || entries.length === 0) && targetBookId !== bookId) {
          const resTarget = await fetch(
            `${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetBookId)}&select=*&order=name.asc`,
            { headers: HEADERS, cache: 'no-store' }
          );
          if (resTarget.ok) {
            entries = await resTarget.json();
          }
        }

        if (entries && entries.length > 0) {
          await offlineDB.saveGlossary(bookId, entries);
          if (targetBookId !== bookId) {
            await offlineDB.saveGlossary(targetBookId, entries);
          }
          lastSyncTimestamp = new Date();
          return entries;
        }
      } catch (e) {
        console.warn('Network error loading glossary from cloud, using local DB:', e);
      }
    }

    let localEntries = await offlineDB.getGlossary(bookId);
    if ((!localEntries || localEntries.length === 0) && targetBookId !== bookId) {
      localEntries = await offlineDB.getGlossary(targetBookId);
    }
    return localEntries || [];
  },

  async saveGlossaryEntry(bookId, entry) {
    let targetBookId = bookId;
    try {
      const book = await this.getBook(bookId);
      if (book && book.shared_glossary_id) {
        targetBookId = book.shared_glossary_id;
      }
    } catch (e) {}

    const gid = entry.id || (entry.name || '').toLowerCase().trim().replace(/\s+/g, '-');
    const row = {
      book_id: bookId,
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

    // 1. Save to local IndexedDB immediately
    await offlineDB.saveGlossaryEntry(bookId, row);
    if (targetBookId !== bookId) {
      await offlineDB.saveGlossaryEntry(targetBookId, { ...row, book_id: targetBookId });
    }

    // 2. Auto-sync to Supabase if online
    if (this.isOnline()) {
      const rows = [row];
      if (targetBookId !== bookId) {
        rows.push({ ...row, book_id: targetBookId });
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/glossary`, {
          method: 'POST',
          headers: UPSERT_HEADERS,
          body: JSON.stringify(rows)
        });
        if (res.ok) {
          lastSyncTimestamp = new Date();
          return row;
        } else {
          console.warn('Supabase glossary save failed, queued locally:', await res.text());
          await offlineDB.queueSyncItem({ type: 'save_glossary', bookId, row });
        }
      } catch (e) {
        console.warn('Network error saving glossary, queued locally:', e);
        await offlineDB.queueSyncItem({ type: 'save_glossary', bookId, row });
      }
    } else {
      await offlineDB.queueSyncItem({ type: 'save_glossary', bookId, row });
    }

    return row;
  },

  async deleteGlossaryEntry(bookId, charId) {
    let targetBookId = bookId;
    try {
      const book = await this.getBook(bookId);
      if (book && book.shared_glossary_id) {
        targetBookId = book.shared_glossary_id;
      }
    } catch (e) {}

    // Delete locally
    const db = await offlineDB.init();
    await new Promise((resolve) => {
      const tx = db.transaction('glossary', 'readwrite');
      tx.objectStore('glossary').delete([bookId, charId]);
      if (targetBookId !== bookId) {
        tx.objectStore('glossary').delete([targetBookId, charId]);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    if (this.isOnline()) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(bookId)}&id=eq.${encodeURIComponent(charId)}`, {
          method: 'DELETE',
          headers: HEADERS
        });
        if (targetBookId !== bookId) {
          await fetch(`${SUPABASE_URL}/rest/v1/glossary?book_id=eq.${encodeURIComponent(targetBookId)}&id=eq.${encodeURIComponent(charId)}`, {
            method: 'DELETE',
            headers: HEADERS
          });
        }
        lastSyncTimestamp = new Date();
      } catch (e) {
        console.warn('Failed to delete on cloud:', e);
      }
    }

    return { success: true };
  },

  async lookupCharacter(bookId, name, add = false) {
    // 1. Check local / cached glossary first
    const entries = await this.getGlossary(bookId);
    const lowerName = name.toLowerCase().trim();
    const existing = entries.find(e =>
      (e.name || '').toLowerCase() === lowerName ||
      (Array.isArray(e.aliases) && e.aliases.some(a => (a || '').toLowerCase() === lowerName)) ||
      (e.pinyin_or_chinese && e.pinyin_or_chinese.toLowerCase() === lowerName)
    );

    if (existing) {
      return {
        found: true,
        is_alias: (existing.name || '').toLowerCase() !== lowerName,
        matched_as_alias: (existing.name || '').toLowerCase() !== lowerName,
        primary_name: existing.name,
        name: existing.name,
        character: existing
      };
    }

    // 2. If online and local Flask backend is reachable, call AI lookup
    if (this.isOnline()) {
      try {
        const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/lookup-character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, add })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.character) {
            await this.saveGlossaryEntry(bookId, data.character);
          }
          return data;
        }
      } catch (e) {
        // Local server not running, that is completely fine!
      }
    }

    return {
      found: false,
      message: 'Lore lookup unavailable offline. You can manually add this entry to the glossary.'
    };
  },

  async search(bookId, query, scope = 'all', ch = null) {
    const qLower = query.toLowerCase().trim();

    // Fast local offline search across chapters & lore
    const results = {
      query,
      results: [],
      lore_matches: [],
      total_matches: 0,
      scope
    };

    if (scope === 'all' || scope === 'lore') {
      const glossary = await this.getGlossary(bookId);
      results.lore_matches = glossary.filter(g =>
        (g.name || '').toLowerCase().includes(qLower) ||
        (g.summary || '').toLowerCase().includes(qLower) ||
        (Array.isArray(g.aliases) && g.aliases.some(a => (a || '').toLowerCase().includes(qLower))) ||
        (g.affiliation || '').toLowerCase().includes(qLower)
      );
    }

    // If local server is running, use comprehensive server-side search
    if (this.isOnline()) {
      try {
        let url = `/api/books/${encodeURIComponent(bookId)}/search?q=${encodeURIComponent(query)}&scope=${scope}`;
        if (ch !== null) url += `&ch=${ch}`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (e) {}
    }

    return results;
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
            const cache = await caches.open('xianxia-mobile-v19');
            for (const ch of fullChapters) {
              const matches = (ch.content || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
              for (const m of matches) {
                let imgUrl = m[1];
                if (imgUrl.startsWith('/api/books/')) {
                  const sub = imgUrl.match(/\/api\/books\/([^\/]+)\/images\/(.+)$/);
                  if (sub) {
                    imgUrl = `../data/chapters/${sub[1]}/images/${sub[2]}`;
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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/books?select=id&limit=1`, {
        headers: HEADERS,
        cache: 'no-store'
      });
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
        cloudStatus: 'Connection Error',
        geminiStatus: 'Unavailable',
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
