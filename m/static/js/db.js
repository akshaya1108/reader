/**
 * Client-Side IndexedDB Storage for Xianxia Reader Mobile.
 * Stores downloaded books, chapters, lore entries, reading progress, and offline edit queues.
 * 100% offline-capable on iOS Safari and modern browsers.
 */

const DB_NAME = 'XianxiaReaderDB';
const DB_VERSION = 1;

class OfflineDB {
  constructor() {
    this.db = null;
    this._initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Books store (keyed by book id)
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }

        // Chapters store (keyed by [bookId, chapter_number])
        if (!db.objectStoreNames.contains('chapters')) {
          const chStore = db.createObjectStore('chapters', { keyPath: ['book_id', 'chapter_number'] });
          chStore.createIndex('book_id', 'book_id', { unique: false });
        }

        // Glossary store (keyed by [book_id, id])
        if (!db.objectStoreNames.contains('glossary')) {
          const glStore = db.createObjectStore('glossary', { keyPath: ['book_id', 'id'] });
          glStore.createIndex('book_id', 'book_id', { unique: false });
        }

        // Downloads registry (keyed by book_id)
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', { keyPath: 'book_id' });
        }

        // Outbound Sync Queue for offline edits
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      req.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this._initPromise;
  }

  // --- Books ---
  async saveBooks(books) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      store.clear();
      books.forEach(b => store.put(b));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getBooks() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const req = tx.objectStore('books').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getBook(bookId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const req = tx.objectStore('books').get(bookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async updateBookProgress(bookId, { lastReadChapter, bookmark, lastReadAt }) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const getReq = store.get(bookId);
      getReq.onsuccess = () => {
        const book = getReq.result || { id: bookId };
        if (lastReadChapter !== undefined) book.last_read_chapter = lastReadChapter;
        if (bookmark !== undefined) book.bookmark = bookmark;
        if (lastReadAt !== undefined) book.last_read_at = lastReadAt;
        store.put(book);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Chapters ---
  async saveChapters(bookId, chapters) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readwrite');
      const store = tx.objectStore('chapters');
      chapters.forEach(ch => {
        store.put({
          book_id: bookId,
          chapter_number: Number(ch.chapter_number),
          title: ch.title || `Chapter ${ch.chapter_number}`,
          content: ch.content || '',
          word_count: Number(ch.word_count || 0)
        });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getChapter(bookId, chapterNum) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readonly');
      const req = tx.objectStore('chapters').get([bookId, Number(chapterNum)]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getChaptersList(bookId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readonly');
      const index = tx.objectStore('chapters').index('book_id');
      const req = index.getAll(IDBKeyRange.only(bookId));
      req.onsuccess = () => {
        const list = (req.result || []).map(ch => ({
          chapter_number: ch.chapter_number,
          title: ch.title,
          word_count: ch.word_count
        }));
        list.sort((a, b) => a.chapter_number - b.chapter_number);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteChapter(bookId, chapterNum) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction('chapters', 'readwrite');
      tx.objectStore('chapters').delete([bookId, Number(chapterNum)]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async reconcileChaptersList(bookId, freshList) {
    const db = await this.init();
    const freshNums = new Set((freshList || []).map(ch => Number(ch.chapter_number)));
    return new Promise((resolve) => {
      const tx = db.transaction('chapters', 'readwrite');
      const store = tx.objectStore('chapters');
      const index = store.index('book_id');
      const req = index.getAll(IDBKeyRange.only(bookId));
      req.onsuccess = () => {
        const cached = req.result || [];
        cached.forEach(ch => {
          if (!freshNums.has(Number(ch.chapter_number))) {
            store.delete([bookId, Number(ch.chapter_number)]);
          }
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // --- Glossary ---
  async saveGlossary(bookId, entries) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('glossary', 'readwrite');
      const store = tx.objectStore('glossary');
      const index = store.index('book_id');
      const req = index.getAll(IDBKeyRange.only(bookId));
      req.onsuccess = () => {
        const cached = req.result || [];
        const freshIds = new Set((entries || []).map(e => e.id || (e.name || '').toLowerCase().trim().replace(/\s+/g, '-')));
        cached.forEach(old => {
          if (!freshIds.has(old.id)) {
            store.delete([bookId, old.id]);
          }
        });
        (entries || []).forEach(item => {
          const gid = item.id || (item.name || '').toLowerCase().trim().replace(/\s+/g, '-');
          store.put({
            book_id: bookId,
            id: gid,
            name: item.name || '',
            category: item.category || 'Character',
            pinyin_or_chinese: item.pinyin_or_chinese || '',
            aliases: Array.isArray(item.aliases) ? item.aliases : [],
            affiliation: item.affiliation || item.sect_or_affiliation || '',
            sect_or_affiliation: item.sect_or_affiliation || item.affiliation || '',
            summary: item.summary || '',
            mentions: Number(item.mentions || 0)
          });
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getGlossary(bookId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('glossary', 'readonly');
      const index = tx.objectStore('glossary').index('book_id');
      const req = index.getAll(IDBKeyRange.only(bookId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveGlossaryEntry(bookId, entry) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('glossary', 'readwrite');
      const store = tx.objectStore('glossary');
      const gid = entry.id || (entry.name || '').toLowerCase().trim().replace(/\s+/g, '-');
      store.put({
        book_id: bookId,
        id: gid,
        name: entry.name || '',
        category: entry.category || 'Character',
        pinyin_or_chinese: entry.pinyin_or_chinese || '',
        aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
        affiliation: entry.affiliation || entry.sect_or_affiliation || '',
        sect_or_affiliation: entry.sect_or_affiliation || entry.affiliation || '',
        summary: entry.summary || '',
        mentions: Number(entry.mentions || 0)
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteGlossaryEntry(bookId, charId) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction('glossary', 'readwrite');
      tx.objectStore('glossary').delete([bookId, charId]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  // --- Downloads Registry ---
  async getDownloadStatus(bookId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloads', 'readonly');
      const req = tx.objectStore('downloads').get(bookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async setDownloadStatus(bookId, status) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('downloads', 'readwrite');
      tx.objectStore('downloads').put({ book_id: bookId, ...status });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteDownloadedBook(bookId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['chapters', 'glossary', 'downloads'], 'readwrite');
      
      // Delete chapters
      const chStore = tx.objectStore('chapters');
      const chIndex = chStore.index('book_id');
      const chReq = chIndex.getAllKeys(IDBKeyRange.only(bookId));
      chReq.onsuccess = () => {
        (chReq.result || []).forEach(k => chStore.delete(k));
      };

      // Delete downloads record
      tx.objectStore('downloads').delete(bookId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Outbound Offline Sync Queue ---
  async queueSyncItem(item) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add({ ...item, queued_at: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSyncQueue() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeSyncItem(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDB = new OfflineDB();
