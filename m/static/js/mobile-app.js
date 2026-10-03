/**
 * Xianxia Mobile Reader - Minimalist & Modern Reader Architecture
 * Focuses purely on an elegant reading experience, smooth book browsing,
 * reliable paragraph bookmarking, and complete glossary management.
 */

import { api } from './api.js';

// --- Category Display Configuration ---
const CATEGORIES = [
  { key: 'Character', slug: 'character', label: 'Characters', dotClass: 'dot-character', badgeClass: 'badge-cat-character' },
  { key: 'Race / Creature', slug: 'race-creature', label: 'Races & Creatures', dotClass: 'dot-creature', badgeClass: 'badge-cat-creature' },
  { key: 'Weapon / Item', slug: 'weapon-item', label: 'Weapons & Items', dotClass: 'dot-weapon', badgeClass: 'badge-cat-weapon' },
  { key: 'Clan / Sect', slug: 'clan-sect', label: 'Clans & Sects', dotClass: 'dot-clan', badgeClass: 'badge-cat-clan' },
  { key: 'Location / Realm', slug: 'location-realm', label: 'Locations & Realms', dotClass: 'dot-location', badgeClass: 'badge-cat-location' },
  { key: 'Concept / Lore', slug: 'concept-lore', label: 'Concepts & Lore', dotClass: 'dot-concept', badgeClass: 'badge-cat-concept' }
];

function normalizeCategory(raw) {
  if (!raw) return 'Character';
  const c = String(raw).toLowerCase().trim();
  if (c.includes('creature') || c.includes('race') || c.includes('beast') || c.includes('species') || c.includes('monster') || c.includes('animal') || c.includes('demon')) return 'Race / Creature';
  if (c.includes('weapon') || c.includes('item') || c.includes('artifact')) return 'Weapon / Item';
  if (c.includes('clan') || c.includes('sect') || c.includes('faction') || c.includes('group')) return 'Clan / Sect';
  if (c.includes('location') || c.includes('realm') || c.includes('place') || c.includes('city') || c.includes('mountain')) return 'Location / Realm';
  if (c.includes('concept') || c.includes('lore') || c.includes('technique') || c.includes('magic') || c.includes('term')) return 'Concept / Lore';
  return 'Character';
}

function getCategorySlug(category) {
  const norm = normalizeCategory(category);
  const found = CATEGORIES.find(cfg => cfg.key === norm);
  return found ? found.slug : 'character';
}

function getCategoryBadgeClass(category) {
  const norm = normalizeCategory(category);
  const found = CATEGORIES.find(cfg => cfg.key === norm);
  return found ? found.badgeClass : 'badge-cat-character';
}

// --- Global Application State ---
const state = {
  books: [],
  activeBookId: null,
  currentBook: null,
  chapters: [],
  glossary: [],
  glossaryMap: new Map(),
  activeView: 'library',
  activeChapterNum: 1,
  currentChapterData: null,
  activeSelectedText: '',
  isCheckingLore: false,
  librarySearchQuery: '',
  librarySortBy: 'last_read',
  glossaryCategoryFilter: 'all',
  glossarySortBy: 'relevance',
  glossarySearchQuery: '',
  readerSettings: {
    font: 'serif',
    theme: 'sepia',
    fontSizeRem: 1.05
  }
};

const SORT_LABELS = {
  last_read: 'Last Read...',
  date_desc: 'Date Added...',
  date_asc: 'Date Added (Old)...',
  title_asc: 'Novel Name...',
  title_desc: 'Novel (Z - A)...',
  author_asc: 'Author Name...',
  author_desc: 'Author (Z - A)...',
  words_desc: 'Word Count...',
  words_asc: 'Word (Low)...'
};

// --- Utility Functions ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(message, options = {}) {
  const toast = document.getElementById('mobile-toast');
  if (!toast) return;

  const loading = typeof options === 'boolean' ? options : (options?.loading || false);
  const duration = typeof options === 'number' ? options : (options?.duration !== undefined ? options.duration : 2200);

  if (loading) {
    toast.innerHTML = `<span class="toast-loading-spinner"></span><span>${escapeHtml(message)}</span>`;
  } else {
    toast.textContent = message;
  }

  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }
}

function hideToast() {
  const toast = document.getElementById('mobile-toast');
  if (toast) {
    toast.classList.remove('visible');
    if (toastTimer) clearTimeout(toastTimer);
  }
}

function syncThemeMetaColor() {
  const meta = document.getElementById('meta-theme-color');
  if (!meta) return;
  const t = state.readerSettings.theme;
  if (t === 'dark') meta.setAttribute('content', '#141210');
  else if (t === 'light') meta.setAttribute('content', '#ffffff');
  else meta.setAttribute('content', '#fbf8f2');
}

// --- View Router ---
function switchView(viewName) {
  if (!['library', 'book', 'glossary', 'reader'].includes(viewName)) return;
  state.activeView = viewName;

  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById(`view-${viewName}`);
  if (targetPane) targetPane.classList.add('active');

  // Bottom Nav handling: only in book overview or glossary when glossary is enabled
  const bottomNav = document.getElementById('bottom-nav');
  const isGlossaryEnabled = state.currentBook ? (state.currentBook.enable_glossary !== false) : false;
  if (bottomNav) {
    const showNav = (viewName === 'book' || viewName === 'glossary') && isGlossaryEnabled;
    bottomNav.style.display = showNav ? 'flex' : 'none';

    // Toggle active state on tabs
    const tabChapters = document.getElementById('nav-tab-chapters');
    const tabGlossary = document.getElementById('nav-tab-glossary');
    if (tabChapters && tabGlossary) {
      tabChapters.classList.toggle('active', viewName === 'book');
      tabGlossary.classList.toggle('active', viewName === 'glossary');
    }
  }

  if (viewName === 'book') {
    const viewBookEl = document.getElementById('view-book');
    if (viewBookEl) {
      viewBookEl.classList.toggle('no-bottom-nav', !isGlossaryEnabled);
    }
    renderBookOverview();
  } else if (viewName === 'glossary') {
    renderGlossaryShelves();
  } else if (viewName === 'library') {
    renderLibrary();
  }
}

// --- Reader Settings (Persisted in localStorage) ---
function loadReaderSettings() {
  try {
    const raw = localStorage.getItem('xianxia_mobile_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.readerSettings = { ...state.readerSettings, ...parsed };
    }
  } catch (e) {
    console.warn('Error reading settings from localStorage:', e);
  }
  applyReaderSettings();
}

function saveReaderSettings() {
  try {
    localStorage.setItem('xianxia_mobile_settings', JSON.stringify(state.readerSettings));
  } catch (e) {
    console.warn('Error saving settings to localStorage:', e);
  }
}

function applyReaderSettings() {
  const body = document.body;
  // Theme
  body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
  body.classList.add(`theme-${state.readerSettings.theme}`);
  syncThemeMetaColor();

  // Font
  body.classList.remove('font-serif', 'font-sans');
  body.classList.add(`font-${state.readerSettings.font}`);

  // Font Size
  document.documentElement.style.setProperty('--reader-font-size', `${state.readerSettings.fontSizeRem}rem`);

  // Update Settings UI active states
  const btnSerif = document.getElementById('btn-font-serif');
  const btnSans = document.getElementById('btn-font-sans');
  if (btnSerif && btnSans) {
    btnSerif.classList.toggle('active', state.readerSettings.font === 'serif');
    btnSans.classList.toggle('active', state.readerSettings.font === 'sans');
  }

  const btnLight = document.getElementById('btn-theme-light');
  const btnSepia = document.getElementById('btn-theme-sepia');
  const btnDark = document.getElementById('btn-theme-dark');
  if (btnLight && btnSepia && btnDark) {
    btnLight.classList.toggle('active', state.readerSettings.theme === 'light');
    btnSepia.classList.toggle('active', state.readerSettings.theme === 'sepia');
    btnDark.classList.toggle('active', state.readerSettings.theme === 'dark');
  }
}

// --- 1. Library View (Search & Sort Filtering) ---
function getBookLastReadTime(book) {
  if (!book) return 0;
  try {
    const lsTime = localStorage.getItem(`xianxia_book_last_read_${book.id}`);
    if (lsTime) {
      const parsed = parseInt(lsTime, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {}

  if (book.last_read_at) {
    const d = new Date(book.last_read_at).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  if (book.updated_at) {
    const d = new Date(book.updated_at).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  if (book.created_at) {
    const d = new Date(book.created_at).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  return (book._orderIndex !== undefined ? book._orderIndex : 0);
}

function getFilteredAndSortedLibraryBooks() {
  let list = [...state.books];

  const query = (state.librarySearchQuery || '').trim().toLowerCase();
  if (query) {
    list = list.filter(b => {
      const titleMatch = (b.title || '').toLowerCase().includes(query);
      const authorMatch = (b.author || '').toLowerCase().includes(query);
      return titleMatch || authorMatch;
    });
  }

  const sortBy = state.librarySortBy || 'last_read';
  list.sort((a, b) => {
    switch (sortBy) {
      case 'last_read':
        return getBookLastReadTime(b) - getBookLastReadTime(a);
      case 'date_asc':
        return (a._orderIndex ?? 0) - (b._orderIndex ?? 0);
      case 'date_desc':
        return (b._orderIndex ?? 0) - (a._orderIndex ?? 0);
      case 'title_asc':
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      case 'title_desc':
        return (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' });
      case 'author_asc':
        return (a.author || '').localeCompare(b.author || '', undefined, { sensitivity: 'base' });
      case 'author_desc':
        return (b.author || '').localeCompare(a.author || '', undefined, { sensitivity: 'base' });
      case 'words_desc':
        return (b.total_words || 0) - (a.total_words || 0);
      case 'words_asc':
        return (a.total_words || 0) - (b.total_words || 0);
      default:
        return getBookLastReadTime(b) - getBookLastReadTime(a);
    }
  });

  return list;
}

function renderLibrary() {
  const listEl = document.getElementById('library-books-list');
  const countBadge = document.getElementById('library-count-badge');
  const sortSelect = document.getElementById('library-sort-select');
  const sortLabel = document.getElementById('library-sort-label');
  if (!listEl) return;

  if (sortSelect && state.librarySortBy) {
    sortSelect.value = state.librarySortBy;
  }
  if (sortLabel) {
    sortLabel.textContent = SORT_LABELS[state.librarySortBy] || 'Last Read...';
  }

  const displayedBooks = getFilteredAndSortedLibraryBooks();
  const query = (state.librarySearchQuery || '').trim();

  if (countBadge) {
    if (query) {
      countBadge.textContent = `${displayedBooks.length} of ${state.books.length} ${state.books.length === 1 ? 'Book' : 'Books'}`;
    } else {
      countBadge.textContent = `${state.books.length} ${state.books.length === 1 ? 'Book' : 'Books'}`;
    }
  }

  if (state.books.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1;">
        No novels in your library yet.
      </div>
    `;
    return;
  }

  if (displayedBooks.length === 0) {
    listEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--border-subtle);">
        <p style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">No matching books found</p>
        <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">No novels match "${escapeHtml(query)}".</p>
        <button type="button" id="btn-reset-library-search" style="padding: 7px 16px; font-family: var(--font-sans); font-size: 0.82rem; font-weight: 600; border-radius: 18px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-main); cursor: pointer;">
          Clear Search
        </button>
      </div>
    `;
    const resetBtn = listEl.querySelector('#btn-reset-library-search');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const input = document.getElementById('library-search-input');
        if (input) input.value = '';
        state.librarySearchQuery = '';
        const clearBtn = document.getElementById('btn-clear-library-search');
        if (clearBtn) clearBtn.style.display = 'none';
        renderLibrary();
      });
    }
    return;
  }

  listEl.innerHTML = displayedBooks.map(b => {
    const total = b.chapters_count || 1;
    const current = b.last_read_chapter || b.last_chapter || 0;
    const percent = Math.min(100, Math.round((current / total) * 100));

    // SVG circle progress: circumference for r=16 is 2 * PI * 16 = 100.53
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    const progressColor = percent === 100 ? '#5c8672' : (b.color || '#ba6d78');
    const color = b.color || '#ba6d78';
    const words = b.total_words || 0;

    let coverHtml = '';
    if (b.cover) {
      coverHtml = `
        <img src="${b.cover}" alt="${escapeHtml(b.title)} cover" class="book-cover-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
        <div class="empty-cover-placeholder" style="display: none;">
          <div class="empty-cover-icon" style="background: ${color}18; color: ${color};">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
        </div>
      `;
    } else {
      coverHtml = `
        <div class="empty-cover-placeholder">
          <div class="empty-cover-icon" style="background: ${color}18; color: ${color};">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
        </div>
      `;
    }

    return `
      <div class="book-card" data-book-id="${b.id}">
        <div class="book-cover-wrap">
          <span class="badge-category" style="color: ${color};">${escapeHtml(b.genre || 'Novel')}</span>
          ${coverHtml}
        </div>
        <div class="book-card-body">
          <h3 class="home-book-title book-title" title="${escapeHtml(b.title)}">${escapeHtml(b.title)}</h3>
          <p class="home-book-author book-author">${escapeHtml(b.author ? `by ${b.author}` : 'Unknown Author')}</p>
          <div class="home-card-footer card-footer">
            <div class="book-stats">
              <span class="stat-ch-count">${b.chapters_count || 0} CHAPTERS</span>
              <span class="stat-words">${Number(words).toLocaleString()} WORDS</span>
            </div>
            <div class="progress-circle-wrap" title="${percent === 100 ? 'Completed' : `Chapter ${current} of ${total} (${percent}%)`}">
              <div class="circle-box">
                <svg viewBox="0 0 40 40">
                  <circle class="circle-bg" cx="20" cy="20" r="${radius}"></circle>
                  <circle class="circle-val" cx="20" cy="20" r="${radius}" 
                          style="stroke: ${progressColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeDashoffset};"></circle>
                </svg>
                <span class="circle-label">${percent}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', async () => {
      const bookId = card.dataset.bookId;
      card.classList.add('card-opening');
      showToast('Opening novel...', { loading: true, duration: 4000 });
      state.activeBookId = bookId;
      state.currentBook = state.books.find(b => b.id === bookId) || state.books[0];
      switchView('book');
      await selectBook(bookId);
      hideToast();
      card.classList.remove('card-opening');
    });
  });
}

function setupLibraryFilters() {
  const searchInput = document.getElementById('library-search-input');
  const clearBtn = document.getElementById('btn-clear-library-search');
  const sortSelect = document.getElementById('library-sort-select');
  const sortLabel = document.getElementById('library-sort-label');

  const savedSort = localStorage.getItem('xianxia_mobile_home_sort') || 'last_read';
  state.librarySortBy = savedSort;
  if (sortLabel) {
    sortLabel.textContent = SORT_LABELS[state.librarySortBy] || 'Last Read...';
  }
  if (sortSelect) {
    sortSelect.value = savedSort;
    sortSelect.addEventListener('change', (e) => {
      state.librarySortBy = e.target.value;
      localStorage.setItem('xianxia_mobile_home_sort', state.librarySortBy);
      if (sortLabel) {
        sortLabel.textContent = SORT_LABELS[state.librarySortBy] || 'Last Read...';
      }
      renderLibrary();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.librarySearchQuery = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = state.librarySearchQuery ? 'flex' : 'none';
      }
      renderLibrary();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.blur();
      }
      state.librarySearchQuery = '';
      clearBtn.style.display = 'none';
      renderLibrary();
    });
  }
}

// --- 2. Book Selection & Overview ---
async function selectBook(bookId) {
  state.activeBookId = bookId;
  state.currentBook = state.books.find(b => b.id === bookId) || state.books[0];

  const nowMs = Date.now();
  try {
    localStorage.setItem(`xianxia_book_last_read_${bookId}`, String(nowMs));
  } catch (e) {}
  if (state.currentBook) {
    state.currentBook.last_read_at = new Date(nowMs).toISOString();
  }

  // Populate hero section immediately
  renderBookOverview();

  // Show animated loading spinner and jumping dots in chapters container
  const listEl = document.getElementById('chapters-list-container');
  if (listEl) {
    listEl.innerHTML = `
      <div class="chapters-loading-container">
        <div class="loading-spinner-ring"></div>
        <div class="loading-dots-row">
          <span>Loading chapters</span>
          <span class="loading-dot">.</span>
          <span class="loading-dot">.</span>
          <span class="loading-dot">.</span>
        </div>
      </div>
    `;
  }

  try {
    const [chapters, glossary] = await Promise.all([
      api.getChapters(bookId),
      api.getGlossary(bookId).catch(() => [])
    ]);

    state.chapters = chapters;
    state.glossary = glossary || [];
    buildGlossaryMap();
    populateReaderChapterSelect();

    renderBookOverview();
  } catch (err) {
    console.error('Error loading book data:', err);
    showToast('Failed to load book chapters');
  }
}

function populateReaderChapterSelect() {
  const select = document.getElementById('reader-chapter-select');
  if (!select) return;
  select.innerHTML = '';
  if (!state.chapters || state.chapters.length === 0) {
    const opt = document.createElement('option');
    opt.value = '1';
    opt.textContent = 'Chapter 1';
    select.appendChild(opt);
    return;
  }
  state.chapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = String(ch.chapter_number);
    const rawTitle = (ch.title || '').trim();
    opt.textContent = rawTitle || `Chapter ${ch.chapter_number}`;
    select.appendChild(opt);
  });
  if (state.activeChapterNum) {
    select.value = String(state.activeChapterNum);
  }
}

function isCurrentBookChinese() {
  const g = ((state.currentBook && state.currentBook.genre) || '').toLowerCase();
  const t = ((state.currentBook && state.currentBook.title) || '').toLowerCase();
  const chineseKeywords = ['xianxia', 'danmei', 'wuxia', 'cultivation', 'xuanhuan', 'chinese', 'qihuan'];
  for (const kw of chineseKeywords) {
    if (g.includes(kw) || t.includes(kw)) return true;
  }
  const knownTitles = ['mo dao zu shi', 'grandmaster of demonic cultivation', 'tian guan ci fu', 'heaven official', 'scum villain', 'erha', 'dumb husky', '2ha'];
  for (const kt of knownTitles) {
    if (t.includes(kt)) return true;
  }
  return /[\u4e00-\u9fff]/.test(t) || /[\u4e00-\u9fff]/.test(g);
}

function buildGlossaryMap() {
  state.glossaryMap.clear();
  if (!state.glossary || state.glossary.length === 0) return;
  const isChinese = isCurrentBookChinese();

  state.glossary.forEach(entry => {
    if (entry.name && entry.name.trim()) {
      state.glossaryMap.set(entry.name.toLowerCase().trim(), entry);
    }
    if (isChinese && entry.pinyin_or_chinese && entry.pinyin_or_chinese.trim() && !['n/a', 'none', 'null'].includes(entry.pinyin_or_chinese.toLowerCase().trim())) {
      state.glossaryMap.set(entry.pinyin_or_chinese.toLowerCase().trim(), entry);
    }
    if (Array.isArray(entry.aliases)) {
      entry.aliases.forEach(alias => {
        if (alias && alias.trim()) {
          state.glossaryMap.set(alias.toLowerCase().trim(), entry);
        }
      });
    }
  });
}

function renderBookOverview() {
  const book = state.currentBook;
  if (!book) return;

  // Hero Section
  const heroTitle = document.getElementById('book-hero-title');
  const heroAuthor = document.getElementById('book-hero-author');
  const metaGenre = document.getElementById('book-meta-genre');
  const metaChapters = document.getElementById('book-meta-chapters');
  const metaWords = document.getElementById('book-meta-words');

  if (heroTitle) heroTitle.textContent = book.title || 'Novel';
  if (heroAuthor) heroAuthor.textContent = book.author ? `by ${book.author}` : 'Unknown Author';
  if (metaGenre) metaGenre.textContent = (book.genre || 'WEB NOVEL').toUpperCase();

  const totalChapters = state.chapters.length || book.chapters_count || 0;
  if (metaChapters) metaChapters.textContent = `${totalChapters} CHAPTERS`;

  const totalWords = book.total_words || 0;
  const wordsText = totalWords > 1000 ? `~${Math.round(totalWords / 1000).toLocaleString()}k WORDS` : `${totalWords} WORDS`;
  if (metaWords) metaWords.textContent = wordsText;

  // Continue Button (Single clean line)
  const lastReadCh = book.last_read_chapter || book.last_chapter || 1;
  const btnContinueLabel = document.getElementById('btn-book-continue-label');
  if (btnContinueLabel) {
    btnContinueLabel.textContent = `Continue — Chapter ${lastReadCh}`;
  }

  // Compact Bookmark Icon Button
  const btnBookmark = document.getElementById('btn-book-bookmark');
  const bm = book.bookmark;
  if (bm && bm.chapter_number) {
    if (btnBookmark) {
      btnBookmark.style.display = 'flex';
      btnBookmark.title = `Jump to bookmark (Ch ${bm.chapter_number})`;
    }
  } else {
    if (btnBookmark) btnBookmark.style.display = 'none';
  }

  // Offline Download Button Setup
  const btnDownload = document.getElementById('btn-book-download');
  if (btnDownload) {
    api.isBookDownloaded(book.id).then(isDownloaded => {
      btnDownload.classList.toggle('downloaded', isDownloaded);
      btnDownload.title = isDownloaded ? 'Downloaded for offline reading' : 'Download for offline reading';
    });
  }

  // Bottom Navigation Bar: completely hidden if glossary is disabled
  const isGlossaryEnabled = book.enable_glossary !== false;
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = (state.activeView === 'book' && isGlossaryEnabled) ? 'flex' : 'none';
  }

  const viewBookEl = document.getElementById('view-book');
  if (viewBookEl) {
    viewBookEl.classList.toggle('no-bottom-nav', !isGlossaryEnabled);
  }

  // Render Chapters
  renderChaptersList(state.chapters);
}

function renderChaptersList(chaptersToRender) {
  const container = document.getElementById('chapters-list-container');
  const badgeEl = document.getElementById('book-ch-count-badge');
  if (!container) return;

  if (badgeEl) {
    badgeEl.textContent = `${chaptersToRender.length}`;
  }

  if (chaptersToRender.length === 0) {
    container.innerHTML = '<div style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No matching chapters found.</div>';
    return;
  }

  const book = state.currentBook;
  const lastReadCh = book ? (book.last_read_chapter || book.last_chapter || 1) : 1;
  const bm = book ? book.bookmark : null;
  const bookmarkedCh = bm ? bm.chapter_number : null;

  container.innerHTML = chaptersToRender.map(ch => {
    const isLastRead = ch.chapter_number === lastReadCh;
    const isBookmarked = bookmarkedCh !== null && ch.chapter_number === bookmarkedCh;
    const titleText = ch.title || `Chapter ${ch.chapter_number}`;
    const wordCountText = ch.word_count ? `${ch.word_count.toLocaleString()} words` : '';

    // Subtle orange bookmark SVG icon inline with chapter pill (exactly like desktop)
    const bookmarkIconHtml = isBookmarked ? `
      <span class="ch-item-bookmark-icon" title="Bookmarked in this chapter">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#e67e22" stroke="#d35400" stroke-width="1">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      </span>
    ` : '';

    return `
      <div class="chapter-item-row ${isLastRead ? 'is-last-read' : ''}" data-ch="${ch.chapter_number}">
        <div class="ch-item-left">
          <span class="ch-item-pill">CH ${ch.chapter_number}</span>
          <div class="ch-item-text-wrap">
            <span class="ch-item-title">${escapeHtml(titleText)}</span>
            <span class="ch-item-words">${wordCountText}</span>
          </div>
        </div>
        <div class="ch-item-right">
          ${bookmarkIconHtml}
          <div class="ch-item-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.chapter-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const chNum = parseInt(row.dataset.ch, 10);
      loadChapter(chNum);
      switchView('reader');
    });
  });
}

// --- 3. Glossary Shelves View ---
function renderGlossaryShelves() {
  const container = document.getElementById('glossary-shelves-container');
  const countBadge = document.getElementById('glossary-total-badge');
  if (!container) return;

  const total = state.glossary.length;
  if (countBadge) countBadge.textContent = `${total}`;

  const q = (state.glossarySearchQuery || '').toLowerCase().trim();
  const catFilter = state.glossaryCategoryFilter || 'all';
  const sortBy = state.glossarySortBy || 'relevance';

  // Categories to display
  const categoriesToRender = CATEGORIES.filter(c => catFilter === 'all' || c.key === catFilter);

  // Group entries by category
  const grouped = {};
  categoriesToRender.forEach(cfg => { grouped[cfg.key] = []; });

  state.glossary.forEach((item, originalIdx) => {
    if (item._origIdx === undefined) item._origIdx = originalIdx;

    const normCat = normalizeCategory(item.category);
    if (!grouped[normCat]) return;

    if (q) {
      const inName = (item.name || '').toLowerCase().includes(q);
      const inPinyin = (item.pinyin_or_chinese || item.pinyin || '').toLowerCase().includes(q);
      const inAffil = (item.affiliation || item.sect_or_affiliation || '').toLowerCase().includes(q);
      const inSummary = (item.summary || item.notes || '').toLowerCase().includes(q);
      const inAliases = (item.aliases || []).some(a => String(a).toLowerCase().includes(q));
      if (!inName && !inPinyin && !inAffil && !inSummary && !inAliases) return;
    }

    grouped[normCat].push(item);
  });

  // Sort entries within each category shelf
  Object.keys(grouped).forEach(k => {
    grouped[k].sort((a, b) => {
      if (sortBy === 'relevance') {
        const countA = Number(a.mentions || a.mentions_count || a.mention_count || 0);
        const countB = Number(b.mentions || b.mentions_count || b.mention_count || 0);
        if (countB !== countA) return countB - countA;
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'alpha') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'time_newest') {
        return (b._origIdx || 0) - (a._origIdx || 0);
      }
      return 0;
    });
  });

  let totalVisible = 0;
  Object.values(grouped).forEach(arr => { totalVisible += arr.length; });

  if (totalVisible === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 0.9rem;">
        No glossary entries found matching your search.
      </div>
    `;
    return;
  }

  container.innerHTML = categoriesToRender.map(cfg => {
    const items = grouped[cfg.key] || [];
    if (items.length === 0) return '';

    const cardsHtml = items.map(char => {
      const normCat = normalizeCategory(char.category);
      const catSlug = getCategorySlug(normCat);
      const badgeClass = getCategoryBadgeClass(normCat);
      const affilText = char.affiliation || char.sect_or_affiliation || '';
      const summaryText = char.summary || char.notes || '';
      const mentions = Number(char.mentions || char.mentions_count || char.mention_count || 0);

      let allAliases = Array.isArray(char.aliases) ? [...char.aliases] : [];
      if (char.pinyin_or_chinese && !allAliases.some(a => (a || '').toLowerCase() === char.pinyin_or_chinese.toLowerCase())) {
        allAliases.push(char.pinyin_or_chinese);
      }
      const aliasesHtml = allAliases
        .map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`)
        .join('');

      return `
        <div class="glossary-card-item cat-box-${catSlug}" data-char-name="${escapeHtml(char.name)}">
          <div>
            <div class="card-top-row">
              <span class="card-cat-badge ${badgeClass}">${escapeHtml(normCat)}</span>
              ${mentions > 0 ? `<span class="card-mentions has-mentions">${mentions.toLocaleString()} ${mentions === 1 ? 'mention' : 'mentions'}</span>` : ''}
            </div>
            <h4 class="card-name">${escapeHtml(char.name)}</h4>
            ${affilText ? `<div class="card-affiliation">${escapeHtml(affilText)}</div>` : ''}
            ${aliasesHtml ? `<div class="card-aliases-row">${aliasesHtml}</div>` : ''}
          </div>
          ${summaryText ? `<p class="card-summary">${escapeHtml(summaryText)}</p>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="glossary-shelf-row">
        <div class="glossary-shelf-header">
          <div class="glossary-shelf-title-wrap">
            <span class="glossary-shelf-dot ${cfg.dotClass}"></span>
            <h3 class="glossary-shelf-title">${escapeHtml(cfg.label)}</h3>
            <span class="glossary-shelf-count">${items.length}</span>
          </div>
        </div>
        <div class="glossary-horizontal-track">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Tapping a card opens Lore Sheet in centered modal mode with Edit option
  container.querySelectorAll('.glossary-card-item').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.charName;
      openLoreSheet(name, true);
    });
  });
}

// --- 4. Reader View ---
async function loadChapter(chapterNum, targetParagraphIdx = null, isSearchJump = false) {
  state.activeChapterNum = chapterNum;

  const topTitle = document.getElementById('reader-top-title');
  const chSelect = document.getElementById('reader-chapter-select');
  const canvasChNum = document.getElementById('canvas-ch-num');
  const canvasChTitle = document.getElementById('canvas-ch-title');
  const readerBody = document.getElementById('reader-body-text');
  const stepperLabel = document.getElementById('stepper-ch-label');
  const btnPrev = document.getElementById('btn-step-prev');
  const btnNext = document.getElementById('btn-step-next');

  if (chSelect) {
    chSelect.value = String(chapterNum);
  }
  const foundCh = (state.chapters || []).find(c => c.chapter_number === chapterNum);
  const initialTitle = foundCh && foundCh.title ? foundCh.title : `Chapter ${chapterNum}`;
  if (topTitle) topTitle.textContent = initialTitle;
  if (canvasChNum) canvasChNum.textContent = `CHAPTER ${chapterNum}`;
  if (canvasChTitle) canvasChTitle.textContent = 'Loading...';
  if (readerBody) {
    readerBody.innerHTML = '<div style="padding: 40px 0; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Opening chapter...</div>';
  }

  // Update stepper buttons
  const total = state.chapters.length || 1;
  if (stepperLabel) stepperLabel.textContent = `Ch ${chapterNum} / ${total}`;
  if (btnPrev) btnPrev.disabled = chapterNum <= 1;
  if (btnNext) btnNext.disabled = chapterNum >= total;

  // Scroll to top by default
  const canvas = document.getElementById('reader-scroll-canvas');
  if (canvas) canvas.scrollTop = 0;

  try {
    const chapterData = await api.getChapter(state.activeBookId, chapterNum);
    state.currentChapterData = chapterData;

    if (canvasChTitle) canvasChTitle.textContent = chapterData.title || `Chapter ${chapterNum}`;
    if (topTitle) topTitle.textContent = chapterData.title || `Chapter ${chapterNum}`;
    if (chSelect) chSelect.value = String(chapterNum);

    renderReaderText(chapterData.content);

    // Update last_read_chapter and last_read_at in state and backend
    const nowMs = Date.now();
    try {
      localStorage.setItem(`xianxia_book_last_read_${state.activeBookId}`, String(nowMs));
    } catch (e) {}

    if (state.currentBook) {
      state.currentBook.last_read_at = new Date(nowMs).toISOString();
      state.currentBook.last_read_chapter = chapterNum;
      state.currentBook.last_chapter = chapterNum;
      api.updateBook(state.activeBookId, {
        last_read_chapter: chapterNum,
        last_chapter: chapterNum,
        last_read_at: new Date(nowMs).toISOString()
      }).catch(e => console.warn('Error saving last read chapter:', e));
    }

    // Determine if this chapter has a bookmark or search jump to highlight & autoscroll
    const bm = state.currentBook ? state.currentBook.bookmark : null;
    let targetIdx = targetParagraphIdx;
    if (targetIdx === null && bm && bm.chapter_number === chapterNum && typeof bm.paragraph_index === 'number') {
      targetIdx = bm.paragraph_index;
    }

    if (targetIdx !== null) {
      setTimeout(() => {
        const targetP = readerBody.querySelector(`p[data-p-idx="${targetIdx}"]`);
        if (targetP) {
          if (isSearchJump) {
            targetP.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetP.classList.remove('search-target-paragraph');
            void targetP.offsetWidth;
            targetP.classList.add('search-target-paragraph');
          } else {
            readerBody.querySelectorAll('p.bookmarked-line').forEach(el => el.classList.remove('bookmarked-line'));
            targetP.classList.add('bookmarked-line');
            if (canvas) {
              canvas.scrollTo({
                top: Math.max(0, targetP.offsetTop - 120),
                behavior: 'smooth'
              });
            }
          }
        }
      }, 180);
    }
  } catch (err) {
    console.error('Error loading chapter:', err);
    if (canvasChTitle) canvasChTitle.textContent = 'Error';
    if (readerBody) {
      readerBody.innerHTML = '<div style="padding: 40px 0; text-align: center; color: var(--text-muted);">Failed to load chapter content. Please try again.</div>';
    }
  }
}

/**
 * Universal Paragraph Normalization & Lore Tagging Engine
 * Handles standard <p> HTML, nested <div> structures (like MDZS), and raw text.
 */
function renderReaderText(rawHtml) {
  const container = document.getElementById('reader-body-text');
  if (!container) return;

  const temp = document.createElement('div');
  temp.innerHTML = rawHtml || '';

  // 1. Sanitize out inline styling/attributes
  temp.querySelectorAll('*').forEach(el => {
    el.removeAttribute('style');
    el.removeAttribute('color');
    el.removeAttribute('face');
  });

  // Resolve chapter images for portable hosting (GitHub Pages, mobile)
  temp.querySelectorAll('img').forEach(img => {
    const rawSrc = img.getAttribute('src') || '';
    if (rawSrc.startsWith('/api/books/')) {
      const match = rawSrc.match(/\/api\/books\/([^\/]+)\/images\/(.+)$/);
      if (match) {
        const bookId = match[1];
        const filename = match[2];
        const isGithub = window.location.hostname.includes('github.io');
        const isSubpath = window.location.pathname.includes('/m');
        if (isGithub || isSubpath) {
          img.setAttribute('src', `../data/chapters/${bookId}/images/${filename}`);
        }
      }
    }
    img.classList.add('reader-image');
    img.setAttribute('loading', 'lazy');

    img.addEventListener('error', () => {
      const currentSrc = img.getAttribute('src') || '';
      if (currentSrc.includes('/data/chapters/')) {
        const fallback = currentSrc.replace(/^.*\/data\/chapters\//, '/api/books/');
        if (fallback !== currentSrc && !window.location.hostname.includes('github.io')) {
          img.setAttribute('src', fallback);
          return;
        }
      }
      img.style.display = 'none';
      if (img.parentElement && img.parentElement.classList.contains('reader-image-wrap')) {
        img.parentElement.style.display = 'none';
      }
    }, { once: true });
  });

  // 2. Check if <p> tags exist; if not, extract leaf divs (critical for MDZS)
  let pList = Array.from(temp.querySelectorAll('p'));
  if (pList.length === 0) {
    const allDivs = Array.from(temp.querySelectorAll('div'));
    const leafDivs = allDivs.filter(d => !d.querySelector('div') && d.textContent.trim());
    if (leafDivs.length > 0) {
      const newContainer = document.createElement('div');
      leafDivs.forEach(ld => {
        const p = document.createElement('p');
        p.innerHTML = ld.innerHTML;
        newContainer.appendChild(p);
      });
      temp.innerHTML = newContainer.innerHTML;
    } else {
      const parts = temp.innerHTML.split(/(?:<br\s*\/?>\s*){2,}|\n\n+/gi);
      temp.innerHTML = parts.map(pt => pt.trim() ? `<p>${pt.trim()}</p>` : '').join('');
    }
  }

  // 3. Remove redundant <br> tags between <p>
  temp.querySelectorAll('p + br, br + p, br + br').forEach(br => br.remove());

  // Extract all paragraphs
  const paragraphs = Array.from(temp.querySelectorAll('p'));

  // Build sorted list of lore terms (longest first to avoid substring collision)
  const loreTerms = Array.from(state.glossaryMap.keys())
    .filter(t => t.length >= 2)
    .sort((a, b) => b.length - a.length);

  let loreRegex = null;
  if (loreTerms.length > 0 && state.currentBook && state.currentBook.enable_glossary !== false) {
    const escaped = loreTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      loreRegex = new RegExp(`(?<=^|[^\\p{L}\\p{N}_])(${escaped.join('|')})(?=[^\\p{L}\\p{N}_]|$)`, 'giu');
    } catch (e) {
      loreRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    }
  }

  // 4. Process each paragraph: tag paragraph indices and highlight lore
  paragraphs.forEach((p, idx) => {
    p.setAttribute('data-p-idx', idx);

    if (loreRegex) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let n;
      while ((n = walker.nextNode())) {
        textNodes.push(n);
      }

      textNodes.forEach(node => {
        const text = node.nodeValue;
        if (!text || !loreRegex.test(text)) return;

        loreRegex.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = loreRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }

          const matchedWord = match[0];
          const matchedEntry = state.glossaryMap.get(matchedWord.toLowerCase().trim());
          const primaryName = matchedEntry ? matchedEntry.name : matchedWord;
          const normCat = matchedEntry ? normalizeCategory(matchedEntry.category) : 'Character';
          const catSlug = getCategorySlug(normCat);

          const span = document.createElement('span');
          span.className = `char-tag char-tag-${catSlug}`;
          span.setAttribute('data-char-name', primaryName);
          span.setAttribute('data-category', normCat);
          span.textContent = matchedWord;
          frag.appendChild(span);

          lastIndex = loreRegex.lastIndex;
        }

        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        if (node.parentNode) {
          node.parentNode.replaceChild(frag, node);
        }
      });
    }
  });

  container.innerHTML = temp.innerHTML;
  applyHighlightsToReader(container);

  // Click on reader image to view full-resolution in a new tab
  container.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (img.src) {
        window.open(img.src, '_blank');
      }
    });
  });
}

// --- Bookmark Handling (Silent without popup pill as requested) ---
async function saveBookmark(chNum, paragraphIdx = 0) {
  if (!state.currentBook) return;

  const sharedId = state.currentBook.shared_glossary_id ||
    (state.currentBook.bookmark && state.currentBook.bookmark._shared_glossary_id) ||
    (state.activeBookId.includes('fellowship') || state.activeBookId.includes('two-towers') || state.activeBookId.includes('return-of-the-king') ? 'the-two-towers' : null);

  const bookmarkData = {
    chapter_number: chNum,
    paragraph_index: paragraphIdx,
    ...(sharedId ? { _shared_glossary_id: sharedId } : {})
  };

  state.currentBook.bookmark = bookmarkData;

  const btnBookmark = document.getElementById('btn-book-bookmark');
  if (btnBookmark) {
    btnBookmark.style.display = 'flex';
    btnBookmark.title = `Jump to bookmark (Ch ${chNum})`;
  }

  // Instant local storage backup
  try {
    localStorage.setItem(`xianxia_bookmark_${state.activeBookId}`, JSON.stringify(bookmarkData));
  } catch (e) {}

  try {
    const nowIso = new Date().toISOString();
    state.currentBook.last_read_at = nowIso;
    await api.updateBook(state.activeBookId, {
      bookmark: bookmarkData,
      last_read_at: nowIso
    });
  } catch (e) {
    console.error('Error saving bookmark:', e);
  }
}

async function removeBookmark() {
  if (!state.currentBook) return;

  const sharedId = state.currentBook.shared_glossary_id ||
    (state.currentBook.bookmark && state.currentBook.bookmark._shared_glossary_id) ||
    (state.activeBookId.includes('fellowship') || state.activeBookId.includes('two-towers') || state.activeBookId.includes('return-of-the-king') ? 'the-two-towers' : null);

  state.currentBook.bookmark = sharedId ? { _shared_glossary_id: sharedId } : null;

  const btnBookmark = document.getElementById('btn-book-bookmark');
  if (btnBookmark) {
    btnBookmark.style.display = 'none';
  }

  try {
    localStorage.removeItem(`xianxia_bookmark_${state.activeBookId}`);
  } catch (e) {}

  try {
    const nowIso = new Date().toISOString();
    state.currentBook.last_read_at = nowIso;
    await api.updateBook(state.activeBookId, {
      bookmark: sharedId ? { _shared_glossary_id: sharedId } : null,
      last_read_at: nowIso
    });
  } catch (e) {
    console.error('Error removing bookmark:', e);
  }
}

// --- Touch & Reader Interactions Setup ---
function setupReaderInteractions() {
  const canvas = document.getElementById('reader-scroll-canvas');
  const readerBody = document.getElementById('reader-body-text');
  const viewReader = document.getElementById('view-reader');
  const progressBar = document.getElementById('reader-progress-line');
  const selectionBar = document.getElementById('mobile-selection-bar');

  if (!canvas || !readerBody) return;

  // Scroll reading progress indicator & hide text selection bubble on scroll
  canvas.addEventListener('scroll', () => {
    const totalScroll = canvas.scrollHeight - canvas.clientHeight;
    if (totalScroll > 0 && progressBar) {
      const pct = Math.min(100, Math.round((canvas.scrollTop / totalScroll) * 100));
      progressBar.style.width = `${pct}%`;
    }
    if (selectionBar) selectionBar.style.display = 'none';
  }, { passive: true });

  // Floating selection bubble: listen to text selections
  function checkTextSelection() {
    if (state.isCheckingLore) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (selectionBar) selectionBar.style.display = 'none';
      return;
    }
    const text = sel.toString().trim();
    if (text.length >= 2 && text.length <= 350) {
      state.activeSelectedText = text;

      // Find enclosing paragraph index
      let targetP = null;
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let node = range.commonAncestorContainer;
        while (node && node !== document.body) {
          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-p-idx')) {
            targetP = node;
            break;
          }
          node = node.parentNode;
        }
      }
      state.activeSelectedParagraphIdx = targetP ? parseInt(targetP.getAttribute('data-p-idx'), 10) : 0;

      // If text > 50 chars or has newlines, hide Add to Glossary button (lore entities are short names)
      const btnAddLore = document.getElementById('btn-selection-add-lore');
      const sep1 = document.getElementById('selection-sep-1');
      if (text.length > 50 || text.includes('\n')) {
        if (btnAddLore) btnAddLore.style.display = 'none';
        if (sep1) sep1.style.display = 'none';
      } else {
        if (btnAddLore) btnAddLore.style.display = 'flex';
        if (sep1) sep1.style.display = 'block';
      }

      if (selectionBar) selectionBar.style.display = 'block';
    } else {
      if (selectionBar) selectionBar.style.display = 'none';
    }
  }

  document.addEventListener('selectionchange', () => {
    if (state.activeView === 'reader') {
      setTimeout(checkTextSelection, 100);
    }
  });

  const btnSelectionAdd = document.getElementById('btn-selection-add-lore');
  const btnSelectionText = document.getElementById('mobile-selection-btn-text');
  const btnSelectionIcon = document.getElementById('mobile-selection-btn-icon');

  const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const ICON_SPINNER = `<svg class="selection-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
  const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const ICON_UNAVAILABLE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  if (btnSelectionAdd) {
    btnSelectionAdd.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    });

    btnSelectionAdd.addEventListener('click', async (e) => {
      e.stopPropagation();
      const word = state.activeSelectedText;
      if (!word || !state.activeBookId) return;

      state.isCheckingLore = true;
      btnSelectionAdd.className = 'btn-selection-action loading';
      btnSelectionAdd.disabled = true;
      if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_SPINNER;
      if (btnSelectionText) btnSelectionText.textContent = 'Checking...';

      try {
        const data = await api.lookupCharacter(state.activeBookId, word, true);

        if (data && data.found && data.character) {
          btnSelectionAdd.className = 'btn-selection-action success';
          if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_CHECK;
          if (btnSelectionText) btnSelectionText.textContent = 'Added!';

          if (data.already_existed) {
            showToast(`"${word}" is already in glossary under ${data.character.name}!`);
          } else if (data.merged_into && data.merged_into.toLowerCase() !== word.toLowerCase()) {
            showToast(`Added "${word}" to ${data.merged_into}'s aliases in glossary!`);
          } else {
            showToast(`Added "${data.character.name}" (${data.character.category || 'Entry'}) to glossary!`);
          }

          state.glossary = await api.getGlossary(state.activeBookId);
          buildGlossaryMap();

          if (state.activeView === 'reader' && state.currentChapterData) {
            renderReaderText(state.currentChapterData.content);
          } else if (state.activeView === 'glossary') {
            renderGlossaryShelves();
          }

          setTimeout(() => {
            state.isCheckingLore = false;
            if (selectionBar) selectionBar.style.display = 'none';
            btnSelectionAdd.className = 'btn-selection-action';
            btnSelectionAdd.disabled = false;
            if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_PLUS;
            if (btnSelectionText) btnSelectionText.textContent = 'Add to Glossary';
            if (window.getSelection) window.getSelection().removeAllRanges();
          }, 800);
        } else {
          btnSelectionAdd.className = 'btn-selection-action unavailable';
          if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_UNAVAILABLE;
          if (btnSelectionText) btnSelectionText.textContent = 'Unavailable';
          setTimeout(() => {
            state.isCheckingLore = false;
            if (selectionBar) selectionBar.style.display = 'none';
            btnSelectionAdd.className = 'btn-selection-action';
            btnSelectionAdd.disabled = false;
            if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_PLUS;
            if (btnSelectionText) btnSelectionText.textContent = 'Add to Glossary';
          }, 1400);
        }
      } catch (err) {
        console.error('Lookup character error:', err);
        btnSelectionAdd.className = 'btn-selection-action unavailable';
        if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_UNAVAILABLE;
        if (btnSelectionText) btnSelectionText.textContent = 'Unavailable';
        setTimeout(() => {
          state.isCheckingLore = false;
          if (selectionBar) selectionBar.style.display = 'none';
          btnSelectionAdd.className = 'btn-selection-action';
          btnSelectionAdd.disabled = false;
          if (btnSelectionIcon) btnSelectionIcon.innerHTML = ICON_PLUS;
          if (btnSelectionText) btnSelectionText.textContent = 'Add to Glossary';
        }, 1400);
      }
    });
  }

  const btnSelectionHighlight = document.getElementById('btn-selection-highlight');
  if (btnSelectionHighlight) {
    btnSelectionHighlight.addEventListener('pointerdown', (e) => e.preventDefault());
    btnSelectionHighlight.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleCreateHighlight();
    });
  }

  const btnSelectionNote = document.getElementById('btn-selection-note');
  if (btnSelectionNote) {
    btnSelectionNote.addEventListener('pointerdown', (e) => e.preventDefault());
    btnSelectionNote.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = state.activeSelectedText;
      const pIdx = state.activeSelectedParagraphIdx ?? 0;
      if (!text || !state.activeBookId) return;

      if (selectionBar) selectionBar.style.display = 'none';
      if (window.getSelection) window.getSelection().removeAllRanges();

      openNoteEditor({
        id: null,
        chapter_number: Number(state.activeChapterNum),
        paragraph_index: pIdx,
        text: text,
        note: ''
      });
    });
  }

  // Double tap to bookmark & single tap to toggle controls
  let lastTapTime = 0;
  let singleTapTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let didMove = false;

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    didMove = false;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
      didMove = true;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (didMove) return;

    // Check if tapping a lore term
    const targetTag = e.target.closest('.char-tag');
    if (targetTag) {
      e.preventDefault();
      // Remove any existing active-tag highlights
      document.querySelectorAll('.char-tag.active-tag').forEach(el => el.classList.remove('active-tag'));
      // Add color-coded highlight to the tapped term!
      targetTag.classList.add('active-tag');
      openLoreSheet(targetTag.dataset.charName);
      return;
    }

    const now = Date.now();
    const timeDiff = now - lastTapTime;

    if (timeDiff > 40 && timeDiff < 350) {
      // DOUBLE TAP DETECTED!
      if (singleTapTimer) clearTimeout(singleTapTimer);
      lastTapTime = 0;

      // Clear native selection caused by double-tap
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      if (selectionBar) selectionBar.style.display = 'none';

      // Find paragraph under finger coordinates
      const touch = e.changedTouches[0];
      const p = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('p[data-p-idx]');
      if (p) {
        const pIdx = parseInt(p.getAttribute('data-p-idx'), 10);
        const currentBm = state.currentBook ? state.currentBook.bookmark : null;
        const isAlreadyBookmarked = p.classList.contains('bookmarked-line') || (
          currentBm &&
          currentBm.chapter_number === state.activeChapterNum &&
          currentBm.paragraph_index === pIdx
        );

        readerBody.querySelectorAll('p.bookmarked-line').forEach(el => el.classList.remove('bookmarked-line'));

        if (isAlreadyBookmarked) {
          removeBookmark();
        } else {
          p.classList.add('bookmarked-line');
          saveBookmark(state.activeChapterNum, pIdx);
        }
      }
    } else {
      lastTapTime = now;
      if (singleTapTimer) clearTimeout(singleTapTimer);
      singleTapTimer = setTimeout(() => {
        // Single tap: toggle distraction-free mode (hide/show header & bottom stepper)
        viewReader.classList.toggle('controls-hidden');
      }, 300);
    }
  });

  // Click on lore term support (desktop and tap fallback)
  readerBody.addEventListener('click', (e) => {
    const targetTag = e.target.closest('.char-tag');
    if (targetTag) {
      document.querySelectorAll('.char-tag.active-tag').forEach(el => el.classList.remove('active-tag'));
      targetTag.classList.add('active-tag');
      openLoreSheet(targetTag.dataset.charName);
    }
  });

  // Desktop double click support
  readerBody.addEventListener('dblclick', (e) => {
    const p = e.target.closest('p[data-p-idx]');
    if (p) {
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      const pIdx = parseInt(p.getAttribute('data-p-idx'), 10);
      const currentBm = state.currentBook ? state.currentBook.bookmark : null;
      const isAlreadyBookmarked = p.classList.contains('bookmarked-line') || (
        currentBm &&
        currentBm.chapter_number === state.activeChapterNum &&
        currentBm.paragraph_index === pIdx
      );

      readerBody.querySelectorAll('p.bookmarked-line').forEach(el => el.classList.remove('bookmarked-line'));

      if (isAlreadyBookmarked) {
        removeBookmark();
      } else {
        p.classList.add('bookmarked-line');
        saveBookmark(state.activeChapterNum, pIdx);
      }
    }
  });

  // Reader Back Button (Returns to Book Overview)
  const btnBack = document.getElementById('btn-reader-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => switchView('book'));
  }

  // Chapter dropdown select in reader top bar
  const chapterSelect = document.getElementById('reader-chapter-select');
  if (chapterSelect) {
    chapterSelect.addEventListener('change', (e) => {
      const chNum = parseInt(e.target.value, 10);
      if (!isNaN(chNum) && chNum !== state.activeChapterNum) {
        loadChapter(chNum);
      }
    });
  }

  // Stepper Previous / Next
  const btnPrev = document.getElementById('btn-step-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.activeChapterNum > 1) {
        loadChapter(state.activeChapterNum - 1);
      }
    });
  }

  const btnNext = document.getElementById('btn-step-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (state.activeChapterNum < state.chapters.length) {
        loadChapter(state.activeChapterNum + 1);
      }
    });
  }
}

// --- Lore Card Popup Sheet (Matched to Desktop Web App Layout) ---
let currentLoreItem = null;

function switchLoreDualTab(tabName) {
  const tabLore = document.getElementById('tab-btn-lore');
  const tabNote = document.getElementById('tab-btn-note');
  const paneLore = document.getElementById('lore-pane-view');
  const paneNote = document.getElementById('note-pane-view');
  const btnEdit = document.getElementById('btn-sheet-lore-edit');

  if (tabName === 'note' && paneNote) {
    tabLore?.classList.remove('active');
    tabNote?.classList.add('active');
    paneLore?.classList.add('hidden-pane');
    paneNote?.classList.remove('hidden-pane');
    if (btnEdit) btnEdit.style.display = 'none';
  } else if (paneLore) {
    tabLore?.classList.add('active');
    tabNote?.classList.remove('active');
    paneLore?.classList.remove('hidden-pane');
    paneNote?.classList.add('hidden-pane');
    if (btnEdit) btnEdit.style.display = '';
  }
}

function openLoreSheet(charName, asCenteredModal = false) {
  if (!charName) return;
  const entry = state.glossaryMap.get(charName.toLowerCase().trim()) ||
    state.glossary.find(g => (g.name && g.name.toLowerCase() === charName.toLowerCase()));

  if (!entry) return;
  currentLoreItem = entry;

  const backdrop = document.getElementById('sheet-backdrop-lore');
  const sheetCard = document.getElementById('sheet-card-lore');
  const content = document.getElementById('sheet-lore-content');
  const btnEdit = document.getElementById('btn-sheet-lore-edit');
  if (btnEdit) btnEdit.style.display = '';

  const normCat = normalizeCategory(entry.category);
  const catSlug = getCategorySlug(normCat);
  const badgeClass = getCategoryBadgeClass(normCat);

  // Set category-tinted container class on sheet card
  if (sheetCard) {
    sheetCard.className = `sheet-card cat-box-${catSlug}`;
  }

  if (backdrop) {
    if (asCenteredModal) {
      backdrop.classList.add('modal-mode');
    } else {
      backdrop.classList.remove('modal-mode');
    }
  }

  const affil = entry.affiliation || entry.sect_or_affiliation || '';
  const aliasesList = Array.isArray(entry.aliases) ? [...entry.aliases] : (entry.aliases ? [entry.aliases] : []);
  if (isCurrentBookChinese() && entry.pinyin_or_chinese && !['n/a', 'none', 'null', (entry.name || '').toLowerCase()].includes(entry.pinyin_or_chinese.toLowerCase().trim()) && !aliasesList.includes(entry.pinyin_or_chinese)) {
    aliasesList.unshift(entry.pinyin_or_chinese);
  }
  const aliasesHtml = aliasesList
    .map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`)
    .join('');
  const summary = entry.summary || entry.notes || '';

  // Check if an exact note or highlight is attached to this lore word
  const currentChNum = Number(state.activeChapterNum);
  const exactHl = (state.currentBook?.bookmarks || []).find(
    b => Number(b.chapter_number) === currentChNum &&
         b.text && b.text.trim().toLowerCase() === charName.toLowerCase().trim()
  );

  // Also check if part of a broader containing sentence highlight
  const containingHl = !exactHl && (state.currentBook?.bookmarks || []).find(
    b => Number(b.chapter_number) === currentChNum &&
         b.text && b.text.toLowerCase().includes(charName.toLowerCase().trim())
  );

  const lorePaneHtml = `
    <div class="lore-card-header-row">
      <h3 class="lore-card-primary-name">${escapeHtml(entry.name || charName)}</h3>
      <span class="card-cat-badge ${badgeClass}">${escapeHtml(normCat)}</span>
    </div>
    ${affil ? `<div class="lore-card-affiliation">${escapeHtml(affil)}</div>` : ''}
    ${aliasesHtml ? `<div class="lore-card-aliases"><span class="lore-card-aliases-label">Aliases:</span> <div class="card-aliases-row" style="margin-top: 4px;">${aliasesHtml}</div></div>` : ''}
    <div class="lore-card-summary-box">${escapeHtml(summary || 'No description provided.')}</div>
    ${containingHl ? `
      <div class="lore-containing-note-pill" id="lore-pill-containing-note">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        <span>View note on highlighted passage &rsaquo;</span>
      </div>
    ` : ''}
  `;

  if (exactHl) {
    const hasNote = Boolean(exactHl.note && exactHl.note.trim());
    const d = exactHl.created_at ? new Date(exactHl.created_at) : new Date();
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const notePaneHtml = `
      <div class="note-quote-box" style="border-left-color: ${hasNote ? 'var(--primary)' : '#f5c542'};">
        <span class="note-quote-icon" style="color: ${hasNote ? 'var(--primary)' : '#c69527'};">“</span>
        <div class="note-quote-text">${escapeHtml(exactHl.text)}</div>
      </div>
      <div class="note-view-body">
        <div class="note-view-content" style="font-style: ${hasNote ? 'normal' : 'italic'};">
          ${escapeHtml(hasNote ? exactHl.note : 'Highlighted word in text.')}
        </div>
      </div>
      <div class="note-view-footer">
        <span class="note-view-date">Saved ${dateStr}</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn-sheet-text-action" id="btn-exact-note-edit" style="font-size: 0.82rem;">${hasNote ? 'Edit Note' : 'Add Note'}</button>
          <button type="button" class="btn-note-remove" id="btn-exact-note-delete" style="font-size: 0.82rem;">Delete</button>
        </div>
      </div>
    `;

    if (content) {
      content.innerHTML = `
        <div class="lore-dual-tabs" id="lore-dual-tabs">
          <button type="button" class="lore-dual-tab-btn active" id="tab-btn-lore">Lore</button>
          <button type="button" class="lore-dual-tab-btn" id="tab-btn-note">${hasNote ? 'Personal Note' : 'Highlight'}</button>
        </div>
        <div class="lore-swipe-panes-wrapper">
          <div class="lore-pane-view" id="lore-pane-view">${lorePaneHtml}</div>
          <div class="lore-pane-view hidden-pane" id="note-pane-view">${notePaneHtml}</div>
        </div>
      `;

      // Attach tab click listeners
      document.getElementById('tab-btn-lore')?.addEventListener('click', () => switchLoreDualTab('lore'));
      document.getElementById('tab-btn-note')?.addEventListener('click', () => switchLoreDualTab('note'));

      // Attach edit note listener
      document.getElementById('btn-exact-note-edit')?.addEventListener('click', () => {
        const toEdit = exactHl;
        if (backdrop) backdrop.classList.remove('active');
        openNoteEditor(toEdit);
      });

      // Attach delete note listener with confirm dialog
      document.getElementById('btn-exact-note-delete')?.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: hasNote ? 'Delete Note?' : 'Remove Highlight?',
          message: hasNote
            ? 'Are you sure you want to delete this note and remove its highlight?'
            : 'Are you sure you want to remove this highlight?',
          confirmText: 'Delete'
        });
        if (!confirmed) return;
        if (backdrop) backdrop.classList.remove('active');
        deleteNoteOrHighlight(exactHl.id);
      });
    }
  } else {
    if (content) {
      content.innerHTML = lorePaneHtml;
    }
  }

  // If there's a containing note pill, wire its click to open Note Viewer
  const containingPill = document.getElementById('lore-pill-containing-note');
  if (containingPill && containingHl) {
    containingPill.addEventListener('click', () => {
      if (backdrop) backdrop.classList.remove('active');
      openNoteViewer(containingHl);
    });
  }

  if (backdrop) backdrop.classList.add('active');
}

// --- Highlights & Notes Engine (Cloud Synced to Supabase & Offline-First) ---
function applyHighlightsToReader(container) {
  if (!container || !state.currentBook) return;
  const rawBookmarks = state.currentBook.bookmarks;
  if (!Array.isArray(rawBookmarks) || rawBookmarks.length === 0) return;

  const currentChNum = Number(state.activeChapterNum);
  const chapterHighlights = rawBookmarks.filter(
    b => Number(b.chapter_number) === currentChNum && b.text && String(b.text).trim().length > 0
  );
  if (chapterHighlights.length === 0) return;

  // Sort highlights by quote length descending
  const sorted = [...chapterHighlights].sort((a, b) => (b.text || '').length - (a.text || '').length);

  sorted.forEach(hl => {
    const quote = (hl.text || '').trim();
    if (!quote) return;
    const isNote = Boolean(hl.note && hl.note.trim());
    const hlClass = isNote ? 'reader-note' : 'reader-highlight';

    // 1. Locate the paragraph
    let targetP = null;
    if (hl.paragraph_index !== undefined) {
      targetP = container.querySelector(`p[data-p-idx="${hl.paragraph_index}"]`);
    }
    if (!targetP || !targetP.textContent.includes(quote)) {
      targetP = Array.from(container.querySelectorAll('p[data-p-idx]')).find(p => p.textContent.includes(quote));
    }
    if (!targetP) return;

    // Check if an existing .char-tag exactly matches the quote
    const exactTag = Array.from(targetP.querySelectorAll('.char-tag')).find(
      el => el.textContent.trim().toLowerCase() === quote.toLowerCase()
    );
    if (exactTag && quote.length === exactTag.textContent.trim().length) {
      exactTag.classList.add(hlClass);
      exactTag.setAttribute('data-hl-id', hl.id);
      return;
    }

    // 2. Multi-Node Range Highlighter across paragraph text content
    const pText = targetP.textContent;
    let matchStart = pText.indexOf(quote);
    if (matchStart === -1) {
      matchStart = pText.toLowerCase().indexOf(quote.toLowerCase());
    }
    if (matchStart === -1) return;
    const matchEnd = matchStart + quote.length;

    // Collect all text nodes with their global offsets in the paragraph
    const walker = document.createTreeWalker(targetP, NodeFilter.SHOW_TEXT, null, false);
    const nodeInfos = [];
    let currOffset = 0;
    let tNode;
    while ((tNode = walker.nextNode())) {
      const len = tNode.nodeValue.length;
      nodeInfos.push({
        node: tNode,
        start: currOffset,
        end: currOffset + len,
        len: len
      });
      currOffset += len;
    }

    // Walk nodes backwards so splitting does not invalidate earlier offsets
    for (let i = nodeInfos.length - 1; i >= 0; i--) {
      const info = nodeInfos[i];
      if (info.end <= matchStart || info.start >= matchEnd) {
        continue; // No overlap
      }

      const overlapStart = Math.max(matchStart, info.start);
      const overlapEnd = Math.min(matchEnd, info.end);
      const localStart = overlapStart - info.start;
      const localEnd = overlapEnd - info.start;

      const parentEl = info.node.parentElement;
      if (parentEl && parentEl.classList.contains('char-tag')) {
        // Text node is inside a lore term
        parentEl.classList.add(hlClass);
        parentEl.setAttribute('data-hl-id', hl.id);
      } else {
        // Raw text node or inside non-tag element: split and wrap
        let targetTextNode = info.node;
        if (localEnd < targetTextNode.nodeValue.length) {
          targetTextNode.splitText(localEnd);
        }
        if (localStart > 0) {
          targetTextNode = targetTextNode.splitText(localStart);
        }

        const span = document.createElement('span');
        span.className = hlClass;
        span.setAttribute('data-hl-id', hl.id);
        if (targetTextNode.parentNode) {
          targetTextNode.parentNode.insertBefore(span, targetTextNode);
          span.appendChild(targetTextNode);
        }
      }
    }
  });

  // Attach tap listeners to highlighted and noted spans (excluding char-tag which has lore priority)
  container.querySelectorAll('.reader-highlight, .reader-note').forEach(el => {
    if (!el.classList.contains('char-tag')) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const hlId = el.getAttribute('data-hl-id');
        const hl = (state.currentBook?.bookmarks || []).find(b => b.id === hlId);
        if (hl) {
          openNoteViewer(hl);
        }
      });
    }
  });
}

async function handleCreateHighlight() {
  const text = state.activeSelectedText;
  const pIdx = state.activeSelectedParagraphIdx ?? 0;
  if (!text || !state.activeBookId || !state.currentBook) return;

  const nowIso = new Date().toISOString();
  const newHl = {
    id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    chapter_number: Number(state.activeChapterNum),
    paragraph_index: pIdx,
    text: text,
    note: '',
    color: 'amber',
    created_at: nowIso,
    updated_at: nowIso
  };

  if (!Array.isArray(state.currentBook.bookmarks)) {
    state.currentBook.bookmarks = [];
  }
  state.currentBook.bookmarks.push(newHl);

  const selectionBar = document.getElementById('mobile-selection-bar');
  if (selectionBar) selectionBar.style.display = 'none';
  if (window.getSelection) window.getSelection().removeAllRanges();

  // Optimistic immediate UI update (zero perceived lag)
  if (state.currentChapterData) {
    renderReaderText(state.currentChapterData.content);
  }
  showToast('Saving highlight...', { loading: true, duration: 3500 });

  try {
    await api.updateBook(state.activeBookId, {
      bookmarks: state.currentBook.bookmarks,
      last_read_at: nowIso
    });
    showToast('Highlighted!');
  } catch (err) {
    console.error('Error saving highlight:', err);
    showToast('Saved locally');
  }
}

function openNoteEditor(noteData) {
  state.activeEditingNote = noteData;
  const backdrop = document.getElementById('sheet-backdrop-note-edit');
  const title = document.getElementById('note-edit-title');
  const quoteText = document.getElementById('note-edit-quote-text');
  const textarea = document.getElementById('note-edit-textarea');
  const btnDelete = document.getElementById('btn-note-edit-delete');

  if (title) title.textContent = noteData.id ? 'Edit Note' : 'Add Note';
  if (quoteText) quoteText.textContent = noteData.text || '';
  if (textarea) {
    textarea.value = noteData.note || '';
    setTimeout(() => textarea.focus(), 150);
  }
  if (btnDelete) {
    btnDelete.style.display = noteData.id ? 'block' : 'none';
  }

  if (backdrop) backdrop.classList.add('active');
}

function closeNoteEditor() {
  const backdrop = document.getElementById('sheet-backdrop-note-edit');
  if (backdrop) backdrop.classList.remove('active');
  state.activeEditingNote = null;
}

async function saveNoteFromEditor() {
  const textarea = document.getElementById('note-edit-textarea');
  const btnSave = document.getElementById('btn-note-edit-save');
  const noteText = textarea ? textarea.value.trim() : '';
  const current = state.activeEditingNote;
  if (!current || !state.activeBookId || !state.currentBook) return;

  if (btnSave) {
    btnSave.innerHTML = '<span class="btn-spinner-ring"></span> Saving...';
    btnSave.disabled = true;
  }

  if (!Array.isArray(state.currentBook.bookmarks)) {
    state.currentBook.bookmarks = [];
  }
  const bookmarks = state.currentBook.bookmarks;
  const nowIso = new Date().toISOString();

  if (current.id) {
    const idx = bookmarks.findIndex(b => b.id === current.id);
    if (idx !== -1) {
      bookmarks[idx].note = noteText;
      bookmarks[idx].updated_at = nowIso;
    }
  } else {
    const newHl = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      chapter_number: Number(current.chapter_number),
      paragraph_index: Number(current.paragraph_index),
      text: current.text,
      note: noteText,
      color: 'amber',
      created_at: nowIso,
      updated_at: nowIso
    };
    bookmarks.push(newHl);
  }

  closeNoteEditor();
  closeNoteViewer();

  // Optimistic immediate UI update
  if (state.currentChapterData) {
    renderReaderText(state.currentChapterData.content);
  }
  renderAllNotesList();
  showToast(noteText ? 'Saving note...' : 'Saving highlight...', { loading: true, duration: 3500 });

  try {
    await api.updateBook(state.activeBookId, {
      bookmarks: bookmarks,
      last_read_at: nowIso
    });
    showToast(noteText ? 'Note saved!' : 'Highlight saved!');
  } catch (err) {
    console.error('Error updating note:', err);
    showToast('Saved locally');
  } finally {
    if (btnSave) {
      btnSave.textContent = 'Save';
      btnSave.disabled = false;
    }
  }
}

function openNoteViewer(hl) {
  state.activeViewingNote = hl;
  const backdrop = document.getElementById('sheet-backdrop-note-view');
  const chBadge = document.getElementById('note-view-ch-badge');
  const typeBadge = document.getElementById('note-view-type-badge');
  const quoteText = document.getElementById('note-view-quote-text');
  const content = document.getElementById('note-view-content');
  const dateEl = document.getElementById('note-view-date');
  const btnEdit = document.getElementById('btn-note-view-edit');
  const btnDelete = document.getElementById('btn-note-view-delete');

  const hasNote = Boolean(hl.note && hl.note.trim());
  if (chBadge) chBadge.textContent = `CHAPTER ${hl.chapter_number}`;
  if (typeBadge) {
    typeBadge.textContent = hasNote ? 'Personal Note' : 'Highlight';
    typeBadge.className = `note-type-badge ${hasNote ? 'type-note' : 'type-highlight'}`;
  }
  if (quoteText) quoteText.textContent = `“${hl.text}”`;
  if (content) {
    content.textContent = hasNote ? hl.note : 'Highlighted passage in text.';
    content.style.fontStyle = hasNote ? 'normal' : 'italic';
  }
  const quoteBox = backdrop ? backdrop.querySelector('.note-quote-box') : null;
  if (quoteBox) {
    quoteBox.style.borderLeftColor = hasNote ? 'var(--primary)' : '#f5c542';
  }
  const quoteIcon = backdrop ? backdrop.querySelector('.note-quote-icon') : null;
  if (quoteIcon) {
    quoteIcon.style.color = hasNote ? 'var(--primary)' : '#c69527';
  }
  if (dateEl) {
    const d = hl.created_at ? new Date(hl.created_at) : new Date();
    dateEl.textContent = `Saved ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (btnEdit) btnEdit.textContent = hasNote ? 'Edit Note' : 'Add Note';
  if (btnDelete) btnDelete.textContent = hasNote ? 'Delete Note' : 'Remove Highlight';

  if (backdrop) backdrop.classList.add('active');
}

function closeNoteViewer() {
  const backdrop = document.getElementById('sheet-backdrop-note-view');
  if (backdrop) backdrop.classList.remove('active');
  state.activeViewingNote = null;
}

async function deleteNoteOrHighlight(id) {
  if (!id || !state.currentBook || !state.activeBookId) return;
  state.currentBook.bookmarks = (state.currentBook.bookmarks || []).filter(b => b.id !== id);

  closeNoteViewer();
  closeNoteEditor();

  // Optimistic immediate UI update
  if (state.currentChapterData) {
    renderReaderText(state.currentChapterData.content);
  }
  renderAllNotesList();
  showToast('Removing...', { loading: true, duration: 3500 });

  const nowIso = new Date().toISOString();
  try {
    await api.updateBook(state.activeBookId, {
      bookmarks: state.currentBook.bookmarks,
      last_read_at: nowIso
    });
    showToast('Removed.');
  } catch (err) {
    console.error('Error deleting note/highlight:', err);
    showToast('Removed locally');
  }
}

function openAllNotesSheet(filter = 'all') {
  state.currentNotesFilter = filter;
  const backdrop = document.getElementById('sheet-backdrop-all-notes');
  renderAllNotesList();
  if (backdrop) backdrop.classList.add('active');
}

function closeAllNotesSheet() {
  const backdrop = document.getElementById('sheet-backdrop-all-notes');
  if (backdrop) backdrop.classList.remove('active');
}

function renderAllNotesList() {
  const listEl = document.getElementById('notes-drawer-list');
  if (!listEl || !state.currentBook) return;

  const allItems = Array.isArray(state.currentBook.bookmarks)
    ? state.currentBook.bookmarks.filter(b => b.text && String(b.text).trim().length > 0)
    : [];

  const notesCount = allItems.filter(b => b.note && b.note.trim().length > 0).length;
  const hlCount = allItems.filter(b => !b.note || !b.note.trim().length > 0).length;

  const countTotalEl = document.getElementById('notes-total-count');
  const countAllEl = document.getElementById('notes-count-all');
  const countNotesEl = document.getElementById('notes-count-notes');
  const countHlEl = document.getElementById('notes-count-highlights');

  if (countTotalEl) countTotalEl.textContent = String(allItems.length);
  if (countAllEl) countAllEl.textContent = String(allItems.length);
  if (countNotesEl) countNotesEl.textContent = String(notesCount);
  if (countHlEl) countHlEl.textContent = String(hlCount);

  document.querySelectorAll('.notes-filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === (state.currentNotesFilter || 'all'));
  });

  const filter = state.currentNotesFilter || 'all';
  let filtered = allItems;
  if (filter === 'notes') {
    filtered = allItems.filter(b => b.note && b.note.trim().length > 0);
  } else if (filter === 'highlights') {
    filtered = allItems.filter(b => !b.note || !b.note.trim().length > 0);
  }

  filtered.sort((a, b) => {
    if (Number(a.chapter_number) !== Number(b.chapter_number)) {
      return Number(a.chapter_number) - Number(b.chapter_number);
    }
    return Number(a.paragraph_index || 0) - Number(b.paragraph_index || 0);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="notes-empty-state">
        <p>No ${filter === 'all' ? 'notes or highlights' : filter} in this novel yet.<br>Select any text while reading to add a highlight or note.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(item => {
    const hasNote = Boolean(item.note && item.note.trim());
    const card = document.createElement('div');
    card.className = 'notes-list-item-card';
    card.setAttribute('data-hl-id', item.id);

    const d = item.created_at ? new Date(item.created_at) : new Date();
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    card.innerHTML = `
      <div class="notes-list-item-header">
        <div class="notes-list-item-meta">
          <span class="notes-list-ch-badge">Ch ${item.chapter_number}</span>
          <span class="notes-list-type-pill ${hasNote ? 'type-note' : 'type-highlight'}">
            ${hasNote ? 'Note' : 'Highlight'}
          </span>
        </div>
        <button type="button" class="notes-list-item-delete" title="Remove">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="notes-list-quote">“${escapeHtml(item.text)}”</div>
      ${hasNote ? `<div class="notes-list-note-text">${escapeHtml(item.note)}</div>` : ''}
      <div class="notes-list-footer">
        <span>${dateStr}</span>
        <span style="color: var(--primary); font-weight: 600;">Tap to jump &rsaquo;</span>
      </div>
    `;

    card.addEventListener('click', async (e) => {
      if (e.target.closest('.notes-list-item-delete')) return;
      closeAllNotesSheet();
      const chNum = Number(item.chapter_number);
      const pIdx = Number(item.paragraph_index || 0);

      if (state.activeChapterNum !== chNum) {
        showToast(`Loading Chapter ${chNum}...`);
        await loadChapter(chNum, pIdx, true);
      } else {
        locateAndHighlightParagraph(pIdx);
      }
    });

    const btnDel = card.querySelector('.notes-list-item-delete');
    if (btnDel) {
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isNote = Boolean(item.note && item.note.trim());
        const confirmed = await showConfirmDialog({
          title: isNote ? 'Delete Note?' : 'Remove Highlight?',
          message: isNote
            ? 'Are you sure you want to delete this note?'
            : 'Are you sure you want to remove this highlight?',
          confirmText: 'Delete'
        });
        if (!confirmed) return;
        deleteNoteOrHighlight(item.id);
      });
    }

    listEl.appendChild(card);
  });
}

function showConfirmDialog({ title = 'Delete Item?', message = 'Are you sure?', confirmText = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm-action');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnConfirm = document.getElementById('btn-confirm-danger');

    if (!modal || !btnCancel || !btnConfirm) {
      resolve(window.confirm(message));
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    btnConfirm.textContent = confirmText;
    btnConfirm.className = danger ? 'btn-confirm-danger' : 'btn-confirm-primary';

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('active');

    let resolved = false;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      modal.classList.remove('active');
      setTimeout(() => {
        if (!modal.classList.contains('active')) {
          modal.style.display = 'none';
        }
      }, 200);
      btnCancel.removeEventListener('click', onCancel);
      btnConfirm.removeEventListener('click', onConfirm);
      modal.removeEventListener('click', onBackdrop);
      resolve(result);
    };

    const onCancel = (e) => {
      e.stopPropagation();
      cleanup(false);
    };

    const onConfirm = (e) => {
      e.stopPropagation();
      cleanup(true);
    };

    const onBackdrop = (e) => {
      if (e.target === modal) cleanup(false);
    };

    btnCancel.addEventListener('click', onCancel);
    btnConfirm.addEventListener('click', onConfirm);
    modal.addEventListener('click', onBackdrop);
  });
}

function setupNotesFeature() {
  const btnNotes = document.getElementById('btn-reader-notes');
  if (btnNotes) {
    btnNotes.addEventListener('click', () => {
      openAllNotesSheet('all');
    });
  }

  const btnAllNotesClose = document.getElementById('btn-all-notes-close');
  if (btnAllNotesClose) {
    btnAllNotesClose.addEventListener('click', closeAllNotesSheet);
  }

  const allNotesBackdrop = document.getElementById('sheet-backdrop-all-notes');
  if (allNotesBackdrop) {
    allNotesBackdrop.addEventListener('click', (e) => {
      if (e.target === allNotesBackdrop) closeAllNotesSheet();
    });
  }

  document.querySelectorAll('.notes-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') || 'all';
      state.currentNotesFilter = filter;
      renderAllNotesList();
    });
  });

  const btnNoteEditClose = document.getElementById('btn-note-edit-close');
  if (btnNoteEditClose) btnNoteEditClose.addEventListener('click', closeNoteEditor);

  const btnNoteEditCancel = document.getElementById('btn-note-edit-cancel');
  if (btnNoteEditCancel) btnNoteEditCancel.addEventListener('click', closeNoteEditor);

  const btnNoteEditSave = document.getElementById('btn-note-edit-save');
  if (btnNoteEditSave) btnNoteEditSave.addEventListener('click', saveNoteFromEditor);

  const btnNoteEditDelete = document.getElementById('btn-note-edit-delete');
  if (btnNoteEditDelete) {
    btnNoteEditDelete.addEventListener('click', async () => {
      if (state.activeEditingNote?.id) {
        const confirmed = await showConfirmDialog({
          title: 'Delete Note?',
          message: 'Are you sure you want to delete this note and remove its highlight?',
          confirmText: 'Delete'
        });
        if (!confirmed) return;
        deleteNoteOrHighlight(state.activeEditingNote.id);
      }
    });
  }

  const noteEditBackdrop = document.getElementById('sheet-backdrop-note-edit');
  if (noteEditBackdrop) {
    noteEditBackdrop.addEventListener('click', (e) => {
      if (e.target === noteEditBackdrop) closeNoteEditor();
    });
  }

  const btnNoteViewClose = document.getElementById('btn-note-view-close');
  if (btnNoteViewClose) btnNoteViewClose.addEventListener('click', closeNoteViewer);

  const btnNoteViewEdit = document.getElementById('btn-note-view-edit');
  if (btnNoteViewEdit) {
    btnNoteViewEdit.addEventListener('click', () => {
      const viewing = state.activeViewingNote;
      closeNoteViewer();
      if (viewing) {
        openNoteEditor(viewing);
      }
    });
  }

  const btnNoteViewDelete = document.getElementById('btn-note-view-delete');
  if (btnNoteViewDelete) {
    btnNoteViewDelete.addEventListener('click', async () => {
      if (!state.activeViewingNote?.id) return;
      const hl = state.activeViewingNote;
      const isNote = Boolean(hl.note && hl.note.trim());
      const confirmed = await showConfirmDialog({
        title: isNote ? 'Delete Note?' : 'Remove Highlight?',
        message: isNote
          ? 'Are you sure you want to delete this note and remove its highlight?'
          : 'Are you sure you want to remove this highlight?',
        confirmText: 'Delete'
      });
      if (!confirmed) return;
      deleteNoteOrHighlight(hl.id);
    });
  }

  const noteViewBackdrop = document.getElementById('sheet-backdrop-note-view');
  if (noteViewBackdrop) {
    noteViewBackdrop.addEventListener('click', (e) => {
      if (e.target === noteViewBackdrop) closeNoteViewer();
    });
  }
}

function setupLoreSheet() {
  const backdrop = document.getElementById('sheet-backdrop-lore');
  const sheetCard = document.getElementById('sheet-card-lore');
  const btnClose = document.getElementById('btn-sheet-lore-close');
  const btnEdit = document.getElementById('btn-sheet-lore-edit');

  if (!backdrop) return;

  const closeLore = () => {
    backdrop.classList.remove('active');
    backdrop.classList.remove('modal-mode');
    document.querySelectorAll('.char-tag.active-tag').forEach(el => el.classList.remove('active-tag'));
    syncThemeMetaColor();
  };

  if (btnClose) {
    btnClose.addEventListener('click', closeLore);
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeLore();
  });

  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      closeLore();
      if (currentLoreItem) {
        openEditLoreSheet(currentLoreItem);
      }
    });
  }

  // Swipe gesture support between Lore and Note tabs
  let loreTouchStartX = 0;
  let loreTouchStartY = 0;
  if (sheetCard) {
    sheetCard.addEventListener('touchstart', (e) => {
      loreTouchStartX = e.touches[0].clientX;
      loreTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    sheetCard.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - loreTouchStartX;
      const diffY = e.changedTouches[0].clientY - loreTouchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          switchLoreDualTab('note');
        } else {
          switchLoreDualTab('lore');
        }
      }
    }, { passive: true });
  }
}

// --- Interactive Alias Tag Manager for Mobile ---
let mobileAliasTagManager = null;

function createMobileAliasTagManager({ container, list, input, onAliasesChanged }) {
  let aliases = [];

  function render() {
    if (!list) return;
    list.innerHTML = '';
    aliases.forEach((alias, idx) => {
      const pill = document.createElement('span');
      pill.className = 'alias-pill';

      const textSpan = document.createElement('span');
      textSpan.className = 'alias-pill-text';
      textSpan.textContent = alias;
      pill.appendChild(textSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'alias-pill-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove alias';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeAlias(idx);
      });
      pill.appendChild(removeBtn);

      list.appendChild(pill);
    });

    if (onAliasesChanged) onAliasesChanged([...aliases]);
  }

  function addAlias(str) {
    if (!str) return;
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    let changed = false;
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (!aliases.some(a => a.toLowerCase() === lower)) {
        aliases.push(part);
        changed = true;
      }
    }
    if (changed) render();
  }

  function removeAlias(idx) {
    if (idx >= 0 && idx < aliases.length) {
      aliases.splice(idx, 1);
      render();
    }
  }

  function setAliases(arr) {
    aliases = [];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'string') {
          addAlias(item);
        }
      }
    } else if (typeof arr === 'string') {
      addAlias(arr);
    }
    if (input) input.value = '';
    render();
  }

  function getAliases() {
    if (input && input.value && input.value.trim()) {
      addAlias(input.value);
      input.value = '';
    }
    return [...aliases];
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13 || e.key === ',') {
        e.preventDefault();
        e.stopPropagation();
        const val = input.value.trim();
        if (val) {
          addAlias(val);
          input.value = '';
        }
      } else if (e.key === 'Backspace' && input.value === '' && aliases.length > 0) {
        removeAlias(aliases.length - 1);
      }
    });

    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if (val) {
        addAlias(val);
        input.value = '';
      }
    });

    input.addEventListener('input', () => {
      if (input.value.includes(',')) {
        addAlias(input.value);
        input.value = '';
      }
    });
  }

  if (container) {
    container.addEventListener('click', (e) => {
      if (input && e.target !== input && !e.target.closest('.alias-pill-remove')) {
        input.focus();
      }
    });
  }

  return {
    getAliases,
    setAliases,
    addAlias,
    removeAlias,
    render
  };
}

// --- Add / Edit Lore Sheet (With Web Autofill & AI Lookup) ---
function openEditLoreSheet(entry = null, defaultName = '') {
  const backdrop = document.getElementById('sheet-backdrop-edit');
  const heading = document.getElementById('edit-sheet-heading');
  const idInput = document.getElementById('edit-lore-id');
  const nameInput = document.getElementById('edit-lore-name');
  const catInput = document.getElementById('edit-lore-category');
  const affilInput = document.getElementById('edit-lore-affiliation');
  const aliasesInput = document.getElementById('edit-lore-aliases');
  const summaryInput = document.getElementById('edit-lore-summary');
  const wikiInput = document.getElementById('edit-wiki-url');
  const btnDelete = document.getElementById('btn-edit-delete');

  if (!backdrop) return;

  if (entry) {
    // Edit Mode
    if (heading) heading.textContent = 'Edit Lore Entry';
    if (idInput) idInput.value = entry.id || '';
    if (nameInput) nameInput.value = entry.name || '';
    if (catInput) catInput.value = normalizeCategory(entry.category);
    if (affilInput) affilInput.value = entry.affiliation || entry.sect_or_affiliation || '';
    
    let allAliases = Array.isArray(entry.aliases) ? [...entry.aliases] : (entry.aliases ? [entry.aliases] : []);
    if (isCurrentBookChinese() && entry.pinyin_or_chinese && !['n/a', 'none', 'null', (entry.name || '').toLowerCase()].includes(entry.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.includes(entry.pinyin_or_chinese)) {
      allAliases.unshift(entry.pinyin_or_chinese);
    }
    if (mobileAliasTagManager) {
      mobileAliasTagManager.setAliases(allAliases);
    } else if (aliasesInput) {
      aliasesInput.value = allAliases.join(', ');
    }
    if (summaryInput) summaryInput.value = entry.summary || entry.notes || '';
    if (wikiInput) wikiInput.value = '';
    if (btnDelete) btnDelete.style.display = 'block';
  } else {
    // Add Mode
    if (heading) heading.textContent = 'Add Lore Entry';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = defaultName || '';
    if (catInput) catInput.value = 'Character';
    if (affilInput) affilInput.value = '';
    if (mobileAliasTagManager) {
      mobileAliasTagManager.setAliases([]);
    } else if (aliasesInput) {
      aliasesInput.value = '';
    }
    if (summaryInput) summaryInput.value = '';
    if (wikiInput) wikiInput.value = '';
    if (btnDelete) btnDelete.style.display = 'none';
  }

  backdrop.classList.add('active');
}

function setupEditLoreSheet() {
  const backdrop = document.getElementById('sheet-backdrop-edit');
  const btnClose = document.getElementById('btn-edit-close');
  const btnCancel = document.getElementById('btn-edit-cancel');
  const form = document.getElementById('form-edit-lore');
  const btnDelete = document.getElementById('btn-edit-delete');
  const btnAiFill = document.getElementById('btn-ai-fill');
  const btnWikiImport = document.getElementById('btn-wiki-import');

  // Initialize interactive alias tag manager on mobile
  const aliasContainer = document.getElementById('edit-lore-alias-container');
  const aliasList = document.getElementById('edit-lore-alias-list');
  const aliasesInput = document.getElementById('edit-lore-aliases');
  if (aliasContainer && aliasList && aliasesInput) {
    mobileAliasTagManager = createMobileAliasTagManager({
      container: aliasContainer,
      list: aliasList,
      input: aliasesInput
    });
  }

  if (!backdrop) return;

  const closeSheet = () => {
    backdrop.classList.remove('active');
    syncThemeMetaColor();
  };

  if (btnClose) btnClose.addEventListener('click', closeSheet);
  if (btnCancel) btnCancel.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet();
  });

  // AI Autofill
  if (btnAiFill) {
    btnAiFill.addEventListener('click', async () => {
      const nameInput = document.getElementById('edit-lore-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        showToast('Please enter a name first');
        return;
      }

      btnAiFill.disabled = true;
      btnAiFill.textContent = 'Thinking...';

      try {
        const res = await api.lookupCharacter(state.activeBookId, name, false);
        if (res && res.character) {
          const c = res.character;
          if (c.category) document.getElementById('edit-lore-category').value = normalizeCategory(c.category);
          if (c.affiliation) document.getElementById('edit-lore-affiliation').value = c.affiliation;

          const aliasesArr = Array.isArray(c.aliases) ? [...c.aliases] : (c.aliases ? [c.aliases] : []);
          if (isCurrentBookChinese() && c.pinyin_or_chinese && !['n/a', 'none', 'null', (c.name || '').toLowerCase()].includes(c.pinyin_or_chinese.toLowerCase().trim()) && !aliasesArr.includes(c.pinyin_or_chinese)) {
            aliasesArr.unshift(c.pinyin_or_chinese);
          }
          if (mobileAliasTagManager) {
            mobileAliasTagManager.setAliases(aliasesArr);
          } else if (aliasesArr.length > 0) {
            document.getElementById('edit-lore-aliases').value = aliasesArr.join(', ');
          }
          if (c.summary) document.getElementById('edit-lore-summary').value = c.summary;
          showToast(`Autofilled details for "${name}"`);
        } else {
          showToast('No information found for this name');
        }
      } catch (err) {
        console.error('AI autofill error:', err);
        showToast('AI lookup failed');
      } finally {
        btnAiFill.disabled = false;
        btnAiFill.textContent = 'Autofill';
      }
    });
  }

  // Wiki Scraper Import
  if (btnWikiImport) {
    btnWikiImport.addEventListener('click', async () => {
      const wikiInput = document.getElementById('edit-wiki-url');
      const urlOrTitle = wikiInput ? wikiInput.value.trim() : '';
      if (!urlOrTitle) {
        showToast('Please enter a wiki URL or character title');
        return;
      }

      btnWikiImport.disabled = true;
      btnWikiImport.textContent = 'Importing...';

      try {
        const res = await api.scrapeWiki(state.activeBookId, urlOrTitle);
        if (res && res.characters && res.characters.length > 0) {
          const c = res.characters[0];
          if (c.name) document.getElementById('edit-lore-name').value = c.name;
          if (c.category) document.getElementById('edit-lore-category').value = normalizeCategory(c.category);
          if (c.affiliation) document.getElementById('edit-lore-affiliation').value = c.affiliation;

          const aliasesArr = Array.isArray(c.aliases) ? [...c.aliases] : (c.aliases ? [c.aliases] : []);
          if (isCurrentBookChinese() && c.pinyin_or_chinese && !['n/a', 'none', 'null', (c.name || '').toLowerCase()].includes(c.pinyin_or_chinese.toLowerCase().trim()) && !aliasesArr.includes(c.pinyin_or_chinese)) {
            aliasesArr.unshift(c.pinyin_or_chinese);
          }
          if (mobileAliasTagManager) {
            mobileAliasTagManager.setAliases(aliasesArr);
          } else if (aliasesArr.length > 0) {
            document.getElementById('edit-lore-aliases').value = aliasesArr.join(', ');
          }
          if (c.summary) document.getElementById('edit-lore-summary').value = c.summary;
          showToast(`Imported details from wiki!`);
        } else if (res && res.added_count > 0) {
          showToast(`Imported ${res.added_count} entries into glossary!`);
          closeSheet();
          state.glossary = await api.getGlossary(state.activeBookId);
          buildGlossaryMap();
          if (state.activeView === 'glossary') renderGlossaryShelves();
        } else {
          showToast('Could not extract details from this link');
        }
      } catch (err) {
        console.error('Wiki import error:', err);
        showToast(err.message || 'Wiki import failed');
      } finally {
        btnWikiImport.disabled = false;
        btnWikiImport.textContent = 'Import';
      }
    });
  }

  // Delete Lore Entry
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = document.getElementById('edit-lore-id').value;
      const name = document.getElementById('edit-lore-name')?.value || '';
      if (!id && !name) return;
      if (!confirm('Are you sure you want to delete this lore entry?')) return;

      btnDelete.disabled = true;
      try {
        await api.deleteGlossaryEntry(state.activeBookId, id, name);
        showToast('Deleted lore entry');
        closeSheet();

        state.glossary = await api.getGlossary(state.activeBookId);
        buildGlossaryMap();
        if (state.activeView === 'glossary') renderGlossaryShelves();
      } catch (err) {
        console.error('Delete error:', err);
        showToast('Failed to delete entry');
      } finally {
        btnDelete.disabled = false;
      }
    });
  }

  // Form Submission (Add or Update)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-lore-id').value;
      const name = document.getElementById('edit-lore-name').value.trim();
      const category = document.getElementById('edit-lore-category').value;
      const affiliation = document.getElementById('edit-lore-affiliation').value.trim();
      const aliasesRaw = document.getElementById('edit-lore-aliases').value.trim();
      const summary = document.getElementById('edit-lore-summary').value.trim();

      if (!name) {
        showToast('Name is required');
        return;
      }

      const aliases = mobileAliasTagManager
        ? mobileAliasTagManager.getAliases()
        : (aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : []);

      const entry = {
        name,
        category,
        affiliation,
        aliases,
        summary
      };
      if (id) entry.id = id;

      const saveBtn = document.getElementById('btn-edit-save');
      if (saveBtn) saveBtn.disabled = true;

      try {
        await api.saveGlossaryEntry(state.activeBookId, entry);
        showToast(`Saved "${name}"`);
        closeSheet();

        state.glossary = await api.getGlossary(state.activeBookId);
        buildGlossaryMap();

        if (state.activeView === 'glossary') {
          renderGlossaryShelves();
        } else if (state.activeView === 'reader' && state.currentChapterData) {
          renderReaderText(state.currentChapterData.content);
        }
      } catch (err) {
        console.error('Save lore error:', err);
        showToast('Failed to save lore entry');
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }
}

// --- Reader Settings Sheet ---
function setupSettingsSheet() {
  const backdrop = document.getElementById('sheet-backdrop-settings');
  const btnOpen = document.getElementById('btn-reader-settings');
  const btnClose = document.getElementById('btn-settings-close');

  if (btnOpen && backdrop) {
    btnOpen.addEventListener('click', () => backdrop.classList.add('active'));
  }
  const closeSettings = () => {
    if (backdrop) backdrop.classList.remove('active');
    syncThemeMetaColor();
  };

  if (btnClose && backdrop) {
    btnClose.addEventListener('click', closeSettings);
  }
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSettings();
    });
  }

  // Font buttons
  const btnSerif = document.getElementById('btn-font-serif');
  const btnSans = document.getElementById('btn-font-sans');
  if (btnSerif) {
    btnSerif.addEventListener('click', () => {
      state.readerSettings.font = 'serif';
      saveReaderSettings();
      applyReaderSettings();
    });
  }
  if (btnSans) {
    btnSans.addEventListener('click', () => {
      state.readerSettings.font = 'sans';
      saveReaderSettings();
      applyReaderSettings();
    });
  }

  // Font size buttons
  const btnDec = document.getElementById('btn-size-dec');
  const btnInc = document.getElementById('btn-size-inc');
  if (btnDec) {
    btnDec.addEventListener('click', () => {
      state.readerSettings.fontSizeRem = Math.max(0.85, state.readerSettings.fontSizeRem - 0.08);
      saveReaderSettings();
      applyReaderSettings();
    });
  }
  if (btnInc) {
    btnInc.addEventListener('click', () => {
      state.readerSettings.fontSizeRem = Math.min(1.45, state.readerSettings.fontSizeRem + 0.08);
      saveReaderSettings();
      applyReaderSettings();
    });
  }

  // Theme buttons
  const btnLight = document.getElementById('btn-theme-light');
  const btnSepia = document.getElementById('btn-theme-sepia');
  const btnDark = document.getElementById('btn-theme-dark');
  if (btnLight) {
    btnLight.addEventListener('click', () => {
      state.readerSettings.theme = 'light';
      saveReaderSettings();
      applyReaderSettings();
    });
  }
  if (btnSepia) {
    btnSepia.addEventListener('click', () => {
      state.readerSettings.theme = 'sepia';
      saveReaderSettings();
      applyReaderSettings();
    });
  }
  if (btnDark) {
    btnDark.addEventListener('click', () => {
      state.readerSettings.theme = 'dark';
      saveReaderSettings();
      applyReaderSettings();
    });
  }
}

// --- Book View Controls & Search ---
function setupBookViewControls() {
  // Back to Library Button
  const btnBack = document.getElementById('btn-book-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => switchView('library'));
  }

  // Continue Button
  const btnContinue = document.getElementById('btn-book-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      const lastCh = state.currentBook ? (state.currentBook.last_read_chapter || state.currentBook.last_chapter || 1) : 1;
      loadChapter(lastCh);
      switchView('reader');
    });
  }

  // Compact Jump to Bookmark Button
  const btnBookmark = document.getElementById('btn-book-bookmark');
  if (btnBookmark) {
    btnBookmark.addEventListener('click', () => {
      const bm = state.currentBook ? state.currentBook.bookmark : null;
      if (bm && bm.chapter_number) {
        loadChapter(bm.chapter_number, bm.paragraph_index);
        switchView('reader');
      }
    });
  }

  // Download for Offline Reading Button
  const btnDownload = document.getElementById('btn-book-download');
  if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
      if (!state.activeBookId) return;
      const isDownloaded = await api.isBookDownloaded(state.activeBookId);
      if (isDownloaded) {
        const confirmRedownload = confirm('This novel is already saved offline. Re-download to update all chapters and lore?');
        if (!confirmRedownload) return;
      }

      btnDownload.classList.add('downloading');
      showToast('Downloading novel for offline reading...');
      try {
        await api.downloadBookForOffline(state.activeBookId, (progress) => {
          showToast(progress.message);
        });
        btnDownload.classList.remove('downloading');
        btnDownload.classList.add('downloaded');
        btnDownload.title = 'Downloaded for offline reading';
        showToast('Download complete! Available for offline reading.');
      } catch (err) {
        btnDownload.classList.remove('downloading');
        showToast(err.message || 'Download failed.');
      }
    });
  }

  // Chapter filter input & clear button
  const inputSearch = document.getElementById('input-chapter-search');
  const btnClearChapter = document.getElementById('btn-clear-chapter-search');
  if (inputSearch) {
    inputSearch.addEventListener('input', () => {
      const q = inputSearch.value.trim().toLowerCase();
      if (btnClearChapter) {
        btnClearChapter.style.display = inputSearch.value ? 'flex' : 'none';
      }
      if (!q) {
        renderChaptersList(state.chapters);
      } else {
        const filtered = state.chapters.filter(ch => {
          const numMatch = String(ch.chapter_number) === q;
          const titleMatch = (ch.title || '').toLowerCase().includes(q);
          return numMatch || titleMatch;
        });
        renderChaptersList(filtered);
      }
    });
  }

  if (btnClearChapter) {
    btnClearChapter.addEventListener('click', () => {
      if (inputSearch) {
        inputSearch.value = '';
        inputSearch.blur();
      }
      btnClearChapter.style.display = 'none';
      renderChaptersList(state.chapters);
    });
  }

  // Glossary back button
  const btnGlossaryBack = document.getElementById('btn-glossary-back');
  if (btnGlossaryBack) {
    btnGlossaryBack.addEventListener('click', () => switchView('book'));
  }

  // Glossary Add Lore button
  const btnGlossaryAdd = document.getElementById('btn-glossary-add-lore');
  if (btnGlossaryAdd) {
    btnGlossaryAdd.addEventListener('click', () => openEditLoreSheet());
  }

  // Glossary Search & Filter inputs
  const inputGlossarySearch = document.getElementById('input-glossary-search');
  const btnClearGlossary = document.getElementById('btn-clear-glossary-search');
  if (inputGlossarySearch) {
    inputGlossarySearch.addEventListener('input', () => {
      state.glossarySearchQuery = inputGlossarySearch.value;
      if (btnClearGlossary) {
        btnClearGlossary.style.display = inputGlossarySearch.value ? 'flex' : 'none';
      }
      renderGlossaryShelves();
    });
  }

  if (btnClearGlossary) {
    btnClearGlossary.addEventListener('click', () => {
      if (inputGlossarySearch) {
        inputGlossarySearch.value = '';
        inputGlossarySearch.blur();
      }
      state.glossarySearchQuery = '';
      btnClearGlossary.style.display = 'none';
      renderGlossaryShelves();
    });
  }

  const selectCat = document.getElementById('select-glossary-category');
  if (selectCat) {
    selectCat.addEventListener('change', () => {
      state.glossaryCategoryFilter = selectCat.value;
      renderGlossaryShelves();
    });
  }

  const selectSort = document.getElementById('select-glossary-sort');
  if (selectSort) {
    selectSort.addEventListener('change', () => {
      state.glossarySortBy = selectSort.value;
      renderGlossaryShelves();
    });
  }

  // Bottom Navigation tabs (Chapters <-> Glossary)
  const tabChapters = document.getElementById('nav-tab-chapters');
  const tabGlossary = document.getElementById('nav-tab-glossary');
  if (tabChapters) {
    tabChapters.addEventListener('click', () => switchView('book'));
  }
  if (tabGlossary) {
    tabGlossary.addEventListener('click', () => switchView('glossary'));
  }
}

// --- 6. Edge Swipe Navigation ---
function setupEdgeSwipeNavigation() {
  let startX = 0;
  let startY = 0;
  let isEdgeSwipe = false;

  window.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touch.clientX <= 45) {
      startX = touch.clientX;
      startY = touch.clientY;
      isEdgeSwipe = true;
    } else {
      isEdgeSwipe = false;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!isEdgeSwipe) return;
    isEdgeSwipe = false;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (deltaX > 60 && Math.abs(deltaY) < deltaX * 0.8) {
      const hasActiveModal = document.querySelector('.sheet-backdrop.active, .mobile-search-overlay.active');
      if (hasActiveModal) return;

      if (state.activeView === 'book') {
        switchView('library');
      } else if (state.activeView === 'glossary') {
        switchView('book');
      } else if (state.activeView === 'reader') {
        switchView('book');
      }
    }
  }, { passive: true });
}

// --- 7. Full-Page Search Overlay Engine ---
let searchState = {
  query: '',
  scope: 'all',
  data: null,
  debounceTimer: null
};

function openSearchOverlay(initialScope = null) {
  if (!state.activeBookId) {
    showToast('Select a book first');
    return;
  }

  const overlay = document.getElementById('mobile-search-overlay');
  const input = document.getElementById('mobile-search-input');
  const thisChPill = document.getElementById('m-pill-this-chapter');
  const lorePill = document.getElementById('m-pill-lore');

  if (!overlay) return;

  const enableGlossary = state.currentBook ? (state.currentBook.enable_glossary !== false) : true;
  if (lorePill) {
    lorePill.style.display = enableGlossary ? 'inline-flex' : 'none';
  }

  const hasActiveCh = (state.activeChapterNum !== null && state.activeChapterNum !== undefined);
  if (thisChPill) {
    thisChPill.style.display = hasActiveCh ? 'inline-flex' : 'none';
  }

  if (initialScope) {
    searchState.scope = initialScope;
  } else if (!hasActiveCh && searchState.scope === 'this_chapter') {
    searchState.scope = 'all';
  }

  updateSearchScopePillsUI();
  overlay.classList.add('active');

  const resultsArea = document.getElementById('mobile-search-results-area');
  if (resultsArea) {
    resultsArea.scrollTop = 0;
  }

  if (input) {
    try {
      input.focus({ preventScroll: true });
    } catch (e) {
      input.focus();
    }
    if (input.value) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  window.scrollTo(0, 0);
  if (document.body) document.body.scrollTop = 0;

  const btnClear = document.getElementById('btn-mobile-search-clear');
  if (btnClear && input) {
    btnClear.style.display = input.value.trim().length > 0 ? 'flex' : 'none';
  }

  if (input && input.value.trim().length >= 2) {
    executeSearch(input.value.trim(), searchState.scope);
  }
}

function closeSearchOverlay() {
  const overlay = document.getElementById('mobile-search-overlay');
  if (overlay) overlay.classList.remove('active');
  const input = document.getElementById('mobile-search-input');
  if (input) input.blur();
  window.scrollTo(0, 0);
  if (document.body) document.body.scrollTop = 0;
}

function updateSearchScopePillsUI() {
  const pills = document.querySelectorAll('#mobile-search-pills .search-pill');
  pills.forEach(p => {
    p.classList.toggle('active', p.dataset.scope === searchState.scope);
  });
}

function setupSearch() {
  const btnBookSearch = document.getElementById('btn-book-search');
  const btnReaderSearch = document.getElementById('btn-reader-search');
  const btnClose = document.getElementById('btn-search-close');
  const input = document.getElementById('mobile-search-input');
  const btnClear = document.getElementById('btn-mobile-search-clear');
  const pillsContainer = document.getElementById('mobile-search-pills');

  if (btnBookSearch) {
    btnBookSearch.addEventListener('click', () => openSearchOverlay('all'));
  }

  if (btnReaderSearch) {
    btnReaderSearch.addEventListener('click', () => openSearchOverlay('all'));
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeSearchOverlay);
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (input) {
        input.value = '';
        input.blur();
      }
      btnClear.style.display = 'none';
      searchState.query = '';
      searchState.data = null;
      resetSearchResultsView();
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (btnClear) btnClear.style.display = q.length > 0 ? 'flex' : 'none';

      if (searchState.debounceTimer) clearTimeout(searchState.debounceTimer);

      if (q.length < 2) {
        searchState.query = q;
        searchState.data = null;
        resetSearchResultsView();
        return;
      }

      searchState.debounceTimer = setTimeout(() => {
        searchState.query = q;
        executeSearch(q, searchState.scope);
      }, 280);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q.length >= 2) {
          if (searchState.debounceTimer) clearTimeout(searchState.debounceTimer);
          searchState.query = q;
          executeSearch(q, searchState.scope);
        }
      } else if (e.key === 'Escape') {
        closeSearchOverlay();
      }
    });
  }

  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.search-pill');
      if (!pill) return;
      const scope = pill.dataset.scope;
      if (scope === searchState.scope) return;
      searchState.scope = scope;
      updateSearchScopePillsUI();
      if (searchState.data && searchState.query) {
        renderMobileSearchResults(searchState.data, searchState.query, scope);
      }
    });
  }
}

function resetSearchResultsView() {
  const emptyState = document.getElementById('m-search-empty-state');
  const loadingState = document.getElementById('m-search-loading-state');
  const resultsList = document.getElementById('m-search-results-list');

  if (emptyState) {
    emptyState.style.display = 'block';
    emptyState.innerHTML = '<p>Type at least 2 characters to search dialogue, scenes, character names, or lore across this novel.</p>';
  }
  if (loadingState) loadingState.style.display = 'none';
  if (resultsList) {
    resultsList.style.display = 'none';
    resultsList.innerHTML = '';
  }

  updateScopeCountBadges(0, 0, 0, 0);
}

function updateScopeCountBadges(allCount, thisChCount, allChCount, loreCount) {
  const cAll = document.getElementById('m-count-all');
  const cThis = document.getElementById('m-count-this-chapter');
  const cAllCh = document.getElementById('m-count-all-chapters');
  const cLore = document.getElementById('m-count-lore');

  if (cAll) cAll.textContent = allCount;
  if (cThis) cThis.textContent = thisChCount;
  if (cAllCh) cAllCh.textContent = allChCount;
  if (cLore) cLore.textContent = loreCount;
}

async function executeSearch(query, scope) {
  const emptyState = document.getElementById('m-search-empty-state');
  const loadingState = document.getElementById('m-search-loading-state');
  const resultsList = document.getElementById('m-search-results-list');

  if (emptyState) emptyState.style.display = 'none';
  if (loadingState) loadingState.style.display = 'block';
  if (resultsList) resultsList.style.display = 'none';

  try {
    const data = await api.search(state.activeBookId, query, 'all');
    searchState.data = data;

    const currentChNum = state.activeChapterNum;
    let thisChCount = 0;
    if (currentChNum && data.chapter_matches) {
      const match = data.chapter_matches.find(c => c.chapter_number === currentChNum);
      if (match) thisChCount = match.match_count || (match.snippets ? match.snippets.length : 0);
    }

    updateScopeCountBadges(
      data.total_matches || 0,
      thisChCount,
      data.total_chapter_matches || 0,
      data.total_lore_matches || 0
    );

    renderMobileSearchResults(data, query, scope);
  } catch (err) {
    console.error('Mobile search error:', err);
    if (loadingState) loadingState.style.display = 'none';
    if (resultsList) {
      resultsList.style.display = 'block';
      resultsList.innerHTML = `<div class="search-empty-state"><p>Error searching book: ${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function renderMobileSearchResults(data, query, scope) {
  const loadingState = document.getElementById('m-search-loading-state');
  const resultsList = document.getElementById('m-search-results-list');
  const emptyState = document.getElementById('m-search-empty-state');

  if (loadingState) loadingState.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
  if (!resultsList) return;

  resultsList.style.display = 'block';
  resultsList.innerHTML = '';

  const enableGlossary = state.currentBook ? (state.currentBook.enable_glossary !== false) : true;
  const loreMatches = enableGlossary ? (data.glossary_matches || []) : [];
  const chapterMatches = data.chapter_matches || [];
  const currentChNum = state.activeChapterNum;

  const displayLore = enableGlossary && (scope === 'all' || scope === 'lore');
  const displayChapters = (scope === 'all' || scope === 'all_chapters' || scope === 'this_chapter');

  let filteredChapters = chapterMatches;
  if (scope === 'this_chapter') {
    if (currentChNum !== null && currentChNum !== undefined) {
      filteredChapters = chapterMatches.filter(c => c.chapter_number === currentChNum);
    } else {
      filteredChapters = [];
    }
  }

  const hasLore = displayLore && loreMatches.length > 0;
  const hasChapters = displayChapters && filteredChapters.length > 0;

  if (!hasLore && !hasChapters) {
    let emptyMsg = '';
    if (scope === 'this_chapter') {
      if (currentChNum !== null && currentChNum !== undefined) {
        emptyMsg = `<p>No matches found for <strong>"${escapeHtml(query)}"</strong> in Chapter ${currentChNum}.</p>`;
      } else {
        emptyMsg = `<p>Open a chapter in reader mode to search within it, or select <strong>All Chapters</strong>.</p>`;
      }
    } else if (scope === 'lore') {
      emptyMsg = `<p>No lore glossary entries found for <strong>"${escapeHtml(query)}"</strong>.</p>`;
    } else {
      emptyMsg = `<p>No matches found for <strong>"${escapeHtml(query)}"</strong> in this novel.</p>`;
    }

    const emptyHtml = `
      <div class="search-empty-state">
        ${emptyMsg}
        ${(enableGlossary && query) ? `
          <div class="search-prompt-add-lore">
            <span>Add to Lore Glossary?</span>
            <button type="button" class="btn-search-edit-lore" id="btn-quick-add-search-lore" style="background-color: var(--primary); color:#ffffff; border:none; font-weight:600;">+ Add "${escapeHtml(query)}"</button>
          </div>
        ` : ''}
      </div>
    `;
    resultsList.innerHTML = emptyHtml;

    const btnQuickAdd = document.getElementById('btn-quick-add-search-lore');
    if (btnQuickAdd) {
      btnQuickAdd.addEventListener('click', () => {
        closeSearchOverlay();
        openEditLoreSheet({ name: query });
      });
    }
    return;
  }

  // 1. Render Lore Matches (Collapsible accordion)
  if (displayLore && loreMatches.length > 0) {
    const loreSection = document.createElement('div');
    loreSection.className = 'search-lore-section';
    loreSection.innerHTML = `
      <button type="button" class="search-lore-collapse-btn" id="m-toggle-lore-collapse" aria-expanded="false">
        <div class="search-lore-collapse-left">
          <svg class="search-lore-collapse-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="search-lore-collapse-title">Lore Glossary Entries</span>
          <span class="search-lore-collapse-badge">${loreMatches.length}</span>
        </div>
        <span class="search-lore-collapse-action">Click to expand</span>
      </button>
      <div class="search-lore-collapsible-content" id="m-lore-collapsible-content" style="display: none;"></div>
    `;

    const collapseBtn = loreSection.querySelector('#m-toggle-lore-collapse');
    const collapseContent = loreSection.querySelector('#m-lore-collapsible-content');
    const actionText = loreSection.querySelector('.search-lore-collapse-action');

    collapseBtn.addEventListener('click', () => {
      const isOpen = collapseBtn.classList.toggle('is-open');
      collapseContent.style.display = isOpen ? 'block' : 'none';
      collapseBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      actionText.textContent = isOpen ? 'Click to collapse' : 'Click to expand';
    });

    loreMatches.forEach(item => {
      const normCat = normalizeCategory(item.category);
      const catSlug = getCategorySlug(normCat);
      const badgeClass = getCategoryBadgeClass(normCat);
      const card = document.createElement('div');
      card.className = `search-lore-card cat-box-${catSlug}`;
      const aff = item.affiliation || item.sect_or_affiliation || '';
      let allAliases = Array.isArray(item.aliases) ? [...item.aliases] : [];
      if (isCurrentBookChinese() && item.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(item.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => a.toLowerCase() === item.pinyin_or_chinese.toLowerCase())) {
        allAliases.unshift(item.pinyin_or_chinese);
      }
      card.innerHTML = `
        <div class="search-lore-header">
          <span class="search-lore-name">${escapeHtml(item.name || '')}</span>
          <span class="search-lore-cat ${badgeClass}">${escapeHtml(normCat)}</span>
        </div>
        ${aff ? `<div class="search-lore-sect">${escapeHtml(aff)}</div>` : ''}
        ${allAliases.length > 0 ? `
          <div class="search-lore-aliases">
            <span class="lore-card-aliases-label">Aliases:</span>
            <div class="card-aliases-row" style="margin-top: 4px;">
              ${allAliases.map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`).join('')}
            </div>
            ${item.matched_alias ? `<div style="color: var(--bookmark-color); font-weight: 600; font-size: 0.76rem; margin-top: 4px;">(Matched: "${escapeHtml(item.matched_alias)}")</div>` : ''}
          </div>
        ` : ''}
        ${item.summary ? `<div class="search-lore-summary">${escapeHtml(item.summary)}</div>` : ''}
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button type="button" class="btn-search-edit-lore btn-m-edit-lore" data-char-name="${escapeHtml(item.name || '')}">Edit Entry</button>
        </div>
      `;

      const btnEdit = card.querySelector('.btn-m-edit-lore');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          closeSearchOverlay();
          openEditLoreSheet(item);
        });
      }

      collapseContent.appendChild(card);
    });

    resultsList.appendChild(loreSection);
  }

  // 2. Render Chapter Occurrences
  if (displayChapters && filteredChapters.length > 0) {
    const chaptersSection = document.createElement('div');
    chaptersSection.className = 'search-chapters-section';
    const totalSnippets = filteredChapters.reduce((acc, c) => acc + (c.match_count || 0), 0);

    chaptersSection.innerHTML = `
      <div class="search-section-header">
        <span>Chapter Occurrences (${totalSnippets} in ${filteredChapters.length} ${filteredChapters.length === 1 ? 'chapter' : 'chapters'})</span>
      </div>
    `;

    filteredChapters.forEach(chGroup => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'search-chapter-group';

      const isCurrent = currentChNum === chGroup.chapter_number;
      const rawTitle = (chGroup.title || '').trim();
      const prefixMatch = rawTitle.match(new RegExp(`^Chapter\\s+${chGroup.chapter_number}\\s*[:\\-–—]\\s*(.*)$`, 'i'));
      const displayTitle = prefixMatch ? prefixMatch[1].trim() : rawTitle;

      groupDiv.innerHTML = `
        <div class="search-chapter-header">
          <div class="search-chapter-header-left">
            <span class="ch-pill-badge">CH ${chGroup.chapter_number}</span>
            <span class="search-chapter-title">${escapeHtml(displayTitle || `Chapter ${chGroup.chapter_number}`)}</span>
            ${isCurrent ? '<span class="search-ch-current">(Current)</span>' : ''}
          </div>
          <span class="search-chapter-count">${chGroup.match_count} ${chGroup.match_count === 1 ? 'match' : 'matches'}</span>
        </div>
      `;

      chGroup.snippets.forEach(snippet => {
        const item = document.createElement('div');
        item.className = 'search-snippet-item';
        item.innerHTML = `<div class="search-snippet-text">${snippet.snippet_html}</div>`;
        item.title = `Jump to paragraph in Chapter ${chGroup.chapter_number}`;

        item.addEventListener('click', () => {
          jumpToSearchMatch(chGroup.chapter_number, snippet.paragraph_index);
        });

        groupDiv.appendChild(item);
      });

      chaptersSection.appendChild(groupDiv);
    });

    resultsList.appendChild(chaptersSection);
  }
}

async function jumpToSearchMatch(chapterNumber, paragraphIndex) {
  closeSearchOverlay();
  if (state.activeView !== 'reader' || state.activeChapterNum !== chapterNumber) {
    showToast(`Loading Chapter ${chapterNumber}...`);
    switchView('reader');
    await loadChapter(chapterNumber, paragraphIndex, true);
  } else {
    locateAndHighlightParagraph(paragraphIndex);
  }
}

function locateAndHighlightParagraph(paragraphIndex) {
  const readerBody = document.getElementById('reader-body-text');
  if (!readerBody) return;
  const targetP = readerBody.querySelector(`p[data-p-idx="${paragraphIndex}"]`) ||
                  readerBody.querySelectorAll('p')[paragraphIndex];
  if (targetP) {
    targetP.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetP.classList.remove('search-target-paragraph');
    void targetP.offsetWidth;
    targetP.classList.add('search-target-paragraph');
  }
}

// --- Service Worker Registration ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New mobile version available, auto refreshing cache.');
            }
          });
        });
      })
      .catch(err => console.log('SW registration error:', err));
  }
}

// --- Connection & Sync Status Modal ---
function setupConnectionStatusModal() {
  const btnWifi = document.getElementById('m-status-wifi-btn');
  const modal = document.getElementById('modal-sync-status');
  const btnClose = document.getElementById('btn-close-sync-status');
  const btnSyncNow = document.getElementById('btn-sync-now-action');

  const valCloud = document.getElementById('sync-val-cloud');
  const valGemini = document.getElementById('sync-val-gemini');
  const valTime = document.getElementById('sync-val-time');
  const valOffline = document.getElementById('sync-val-offline');

  const updateStatusDisplay = async () => {
    if (valCloud) valCloud.textContent = 'Checking...';
    const status = await api.checkConnectionStatus();
    if (btnWifi) {
      btnWifi.classList.toggle('status-offline', !status.online);
    }
    if (valCloud) valCloud.textContent = status.cloudStatus;
    if (valGemini) valGemini.textContent = status.geminiStatus;
    if (valTime) {
      const d = status.lastSync ? new Date(status.lastSync) : new Date();
      valTime.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (valOffline) {
      valOffline.textContent = 'IndexedDB Active';
    }
  };

  if (btnWifi) {
    btnWifi.addEventListener('click', () => {
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        updateStatusDisplay();
      }
    });
  }

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', async () => {
      btnSyncNow.textContent = 'Syncing...';
      btnSyncNow.disabled = true;
      try {
        await api.flushSyncQueue();
        const fresh = await api.getBooks();
        state.books = fresh;
        if (state.activeView === 'library') renderLibrary();
        await updateStatusDisplay();
        showToast('Cloud sync complete.');
      } catch (e) {
        showToast('Sync error: ' + (e.message || 'Failed'));
      } finally {
        btnSyncNow.textContent = 'Sync Now';
        btnSyncNow.disabled = false;
      }
    });
  }

  // Initial check
  updateStatusDisplay();
}

// --- App Initialization ---
async function initApp() {
  loadReaderSettings();
  registerServiceWorker();
  setupEdgeSwipeNavigation();
  setupBookViewControls();
  setupLibraryFilters();
  setupReaderInteractions();
  setupLoreSheet();
  setupNotesFeature();
  setupEditLoreSheet();
  setupSettingsSheet();
  setupSearch();
  setupConnectionStatusModal();

  try {
    const books = await api.getBooks();
    books.forEach((b, idx) => {
      if (b._orderIndex === undefined) b._orderIndex = idx;
    });
    state.books = books;
    renderLibrary();

    // Re-sync with Mac edits when returning to the phone screen
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        try {
          const freshBooks = await api.getBooks();
          freshBooks.forEach((b, idx) => {
            if (b._orderIndex === undefined) b._orderIndex = idx;
          });
          state.books = freshBooks;
          if (state.activeView === 'library') {
            renderLibrary();
          } else if (state.activeBookId) {
            const updated = state.books.find(b => b.id === state.activeBookId);
            if (updated) state.currentBook = updated;
            if (state.activeView === 'book') renderBookOverview();
            if (state.activeView === 'glossary') renderGlossaryShelves();
          }
        } catch (e) {}
      }
    });
  } catch (err) {
    console.error('Failed to initialize books:', err);
    showToast('Failed to load library data');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
