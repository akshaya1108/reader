/**
 * My Library - Xianxia & Fantasy Local Reader
 * Features: AI Character Extraction, Hover Tooltip Cards, Wiki Scraper, Reader Themes
 */

// Simple SVG Icons
const ICONS = {
  book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
  calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
  wifi: '<svg class="status-wifi-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>',
  wifiOff: '<svg class="status-wifi-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>'
};

// Application State
const state = {
  books: [],
  activeBookId: null,
  editingBookId: null,
  targetCoverBookId: null,
  currentView: 'home', // 'home' | 'book'
  chapters: [],
  glossary: [],
  activeChapter: null,
  viewMode: 'cards', // 'cards' | 'table'
  appMode: 'manage', // 'manage' | 'readonly'
  fontSize: 18,
  fontFamily: 'font-serif',
  theme: 'theme-sepia',
  geminiConfigured: false,
  managePage: 1,
  managePageSize: 10,
  seeAll: false,
  searchScope: 'all',
  searchQuery: '',
  searchDebounceTimer: null,
  lastSearchResults: null,
  homeSearchQuery: '',
  homeSortBy: 'last_read', // 'last_read' | 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc' | 'author_asc' | 'author_desc' | 'words_desc' | 'words_asc'
  glossaryCategoryFilter: 'all',
  glossarySortBy: 'relevance', // 'relevance' | 'time_newest' | 'time_oldest' | 'alpha'
  glossarySearchQuery: ''
};

// DOM Elements
const elements = {
  brandLink: document.getElementById('brand-link'),
  homeShelfView: document.getElementById('home-shelf-view'),
  homeBooksGrid: document.getElementById('home-books-grid'),
  homeBooksCountLabel: document.getElementById('home-books-count-label'),
  homeBooksSearchInput: document.getElementById('home-books-search-input'),
  btnClearHomeSearch: document.getElementById('btn-clear-home-search'),
  homeBooksSortSelect: document.getElementById('home-books-sort-select'),
  btnHomeStartBook: document.getElementById('btn-home-start-book'),
  homeCoverFileInput: document.getElementById('home-cover-file-input'),
  appLayout: document.getElementById('app-layout'),
  booksList: document.getElementById('books-list-container'),
  btnStartBook: document.getElementById('btn-open-new-book-modal'),
  btnOpenImportEpub: document.getElementById('btn-open-import-epub-modal'),
  btnSwitchToImport: document.getElementById('btn-switch-to-import'),
  modalImportEpub: document.getElementById('modal-import-epub'),
  btnCloseImportEpub: document.getElementById('btn-close-import-epub'),
  btnCancelImportEpub: document.getElementById('btn-cancel-import-epub'),
  btnSubmitImportEpub: document.getElementById('btn-submit-import-epub'),
  epubDropzone: document.getElementById('epub-dropzone'),
  epubFileInput: document.getElementById('epub-file-input'),
  dropzoneIdle: document.getElementById('dropzone-idle'),
  dropzoneSelected: document.getElementById('dropzone-selected'),
  selectedFileName: document.getElementById('selected-file-name'),
  selectedFileSize: document.getElementById('selected-file-size'),
  btnRemoveEpubFile: document.getElementById('btn-remove-epub-file'),
  importAiDetectToggle: document.getElementById('import-ai-detect-toggle'),
  importGlossaryToggle: document.getElementById('import-glossary-toggle'),
  importProgressArea: document.getElementById('import-progress-area'),
  importProgressStatus: document.getElementById('import-progress-status'),
  btnBackLibrary: document.getElementById('btn-back-library'),
  btnViewCards: document.getElementById('btn-view-cards'),
  btnViewTable: document.getElementById('btn-view-table'),
  btnOpenSearch: document.getElementById('btn-open-search'),
  btnOpenGlossary: document.getElementById('btn-open-glossary'),
  btnBookMoreOptions: document.getElementById('btn-book-more-options'),
  bookMoreDropdown: document.getElementById('book-more-dropdown'),
  
  displayBookTitle: document.getElementById('display-book-title'),
  displayBookAuthor: document.getElementById('display-book-author'),
  badgeGenre: document.getElementById('badge-genre'),
  badgeChapters: document.getElementById('badge-chapters'),
  badgeWords: document.getElementById('badge-words'),
  badgeSharedGlossary: document.getElementById('badge-shared-glossary'),
  badgeSharedGlossaryText: document.getElementById('badge-shared-glossary-text'),
  badgeSharedDivider: document.getElementById('badge-shared-divider'),
  btnContinueReading: document.getElementById('btn-continue-reading'),
  btnGoBookmark: document.getElementById('btn-go-bookmark'),
  btnMainGlossary: document.getElementById('btn-main-glossary'),
  btnEditBook: document.getElementById('btn-edit-book'),
  btnLinkGlossary: document.getElementById('btn-link-glossary'),
  btnAutoArrangeChapters: document.getElementById('btn-auto-arrange-chapters'),
  btnDeleteBook: document.getElementById('btn-delete-book'),

  modalLinkGlossary: document.getElementById('modal-link-glossary'),
  btnCloseLinkGlossaryX: document.getElementById('btn-close-link-glossary-x'),
  btnCancelLinkGlossary: document.getElementById('btn-cancel-link-glossary'),
  btnSaveLinkGlossary: document.getElementById('btn-save-link-glossary'),
  btnUnlinkGlossary: document.getElementById('btn-unlink-glossary'),
  linkCurrentStatusBox: document.getElementById('link-current-status-box'),
  linkBooksList: document.getElementById('link-books-list'),
  
  chaptersCardsContainer: document.getElementById('chapters-cards-container'),
  chaptersTableContainer: document.getElementById('chapters-table-container'),
  chaptersTableBody: document.getElementById('chapters-table-body'),
  
  topManagePaginationWrapper: document.getElementById('top-manage-pagination-wrapper'),
  bottomManagePaginationWrapper: document.getElementById('bottom-manage-pagination-wrapper'),
  managePaginationWrapper: document.getElementById('top-manage-pagination-wrapper') || document.getElementById('manage-pagination-wrapper'),
  topPaginationInfo: document.getElementById('top-pagination-info'),
  bottomPaginationInfo: document.getElementById('bottom-pagination-info'),
  paginationInfo: document.getElementById('top-pagination-info') || document.getElementById('pagination-info'),
  topPaginationControls: document.getElementById('top-pagination-controls'),
  bottomPaginationControls: document.getElementById('bottom-pagination-controls'),
  paginationControls: document.getElementById('top-pagination-controls') || document.getElementById('pagination-controls'),
  btnTopWriteModal: document.getElementById('btn-top-write-modal'),
  btnBottomWriteModal: document.getElementById('btn-bottom-write-modal'),
  btnOpenWriteModal: document.getElementById('btn-top-write-modal') || document.getElementById('btn-open-write-modal'),
  
  // Reader Overlay
  readerOverlay: document.getElementById('reader-overlay'),
  btnReaderClose: document.getElementById('btn-reader-close'),
  readerBookInfo: document.getElementById('reader-book-info'),
  readerChapterSelect: document.getElementById('reader-chapter-select'),
  btnPrevCh: document.getElementById('btn-prev-ch'),
  btnNextCh: document.getElementById('btn-next-ch'),
  readerFontFamily: document.getElementById('reader-font-family'),
  btnFontDec: document.getElementById('btn-font-dec'),
  btnFontReset: document.getElementById('btn-font-reset'),
  btnFontInc: document.getElementById('btn-font-inc'),
  btnReaderGlossary: document.getElementById('btn-reader-glossary'),
  btnReaderSearch: document.getElementById('btn-reader-search'),
  readerSearchDrawer: document.getElementById('reader-search-drawer'),
  btnCloseSearch: document.getElementById('btn-close-search'),
  readerSearchInput: document.getElementById('reader-search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  searchScopePills: document.getElementById('search-scope-pills'),
  countScopeAll: document.getElementById('count-scope-all'),
  countScopeThisChapter: document.getElementById('count-scope-this-chapter'),
  countScopeAllChapters: document.getElementById('count-scope-all-chapters'),
  countScopeLore: document.getElementById('count-scope-lore'),
  searchLoreActionsRow: document.getElementById('search-lore-actions-row'),
  btnSearchAddLore: document.getElementById('btn-search-add-lore'),
  searchAddLorePanel: document.getElementById('search-add-lore-panel'),
  searchLoreFormHeading: document.getElementById('search-lore-form-heading'),
  btnCancelSearchLore: document.getElementById('btn-cancel-search-lore'),
  btnCloseSearchLoreForm: document.getElementById('btn-close-search-lore-form'),
  btnSaveSearchLore: document.getElementById('btn-save-search-lore'),
  btnAiAutofillSearchLore: document.getElementById('btn-ai-autofill-search-lore'),
  searchLoreId: document.getElementById('search-lore-id'),
  searchLoreCategory: document.getElementById('search-lore-category'),
  searchLoreName: document.getElementById('search-lore-name'),
  searchLorePinyin: document.getElementById('search-lore-pinyin'),
  searchLoreAliasContainer: document.getElementById('search-lore-alias-container'),
  searchLoreAliasList: document.getElementById('search-lore-alias-list'),
  searchLoreAliases: document.getElementById('search-lore-aliases'),
  searchLoreSect: document.getElementById('search-lore-sect'),
  searchLoreSummary: document.getElementById('search-lore-summary'),
  searchResultsContainer: document.getElementById('search-results-container'),
  searchEmptyState: document.getElementById('search-empty-state'),
  searchLoadingState: document.getElementById('search-loading-state'),
  searchResultsList: document.getElementById('search-results-list'),
  readerChSubtitle: document.getElementById('reader-ch-subtitle'),
  readerChTitle: document.getElementById('reader-ch-title'),
  readerContentBody: document.getElementById('reader-content-body'),
  btnReaderBottomPrev: document.getElementById('btn-reader-bottom-prev'),
  btnReaderBottomNext: document.getElementById('btn-reader-bottom-next'),
  
  // Character Tooltip
  charHoverCard: document.getElementById('char-hover-card'),
  charHoverName: document.getElementById('char-hover-name'),
  charHoverChinese: document.getElementById('char-hover-chinese'),
  charHoverTrigger: document.getElementById('char-hover-trigger'),
  charHoverSect: document.getElementById('char-hover-sect'),
  charHoverSummary: document.getElementById('char-hover-summary'),
  charHoverAliases: document.getElementById('char-hover-aliases'),
  charHoverAliasesRow: document.getElementById('char-hover-aliases-row'),
  btnHoverEditChar: document.getElementById('btn-hover-edit-char'),
  cardArrow: document.getElementById('card-arrow'),
  
  // Text Selection Popup
  readerSelectionPopup: document.getElementById('reader-selection-popup'),
  btnSelectionAddGlossary: document.getElementById('btn-selection-add-glossary'),
  selectionBtnText: document.getElementById('selection-btn-text'),
  selectionArrow: document.getElementById('selection-arrow'),
  
  // Modals
  modalWrite: document.getElementById('modal-write-chapter'),
  writeChNum: document.getElementById('write-ch-num'),
  writeChTitle: document.getElementById('write-ch-title'),
  writeChContent: document.getElementById('write-ch-content'),
  writeAutoScan: document.getElementById('write-auto-scan-gemini'),
  btnCancelWrite: document.getElementById('btn-cancel-write'),
  btnSaveWrite: document.getElementById('btn-save-write'),
  saveWriteBtnText: document.getElementById('save-write-btn-text'),
  
  modalEditBook: document.getElementById('modal-edit-book'),
  editBookTitle: document.getElementById('edit-book-title'),
  editBookAuthor: document.getElementById('edit-book-author'),
  editBookGenre: document.getElementById('edit-book-genre'),
  btnCancelEditBook: document.getElementById('btn-cancel-edit-book'),
  btnSaveEditBook: document.getElementById('btn-save-edit-book'),
  editBookGlossaryToggle: document.getElementById('edit-book-glossary-toggle'),
  editBookGlossaryToggleGroup: document.getElementById('edit-book-glossary-toggle-group'),
  
  modalNewBook: document.getElementById('modal-new-book'),
  newBookTitle: document.getElementById('new-book-title'),
  newBookAuthor: document.getElementById('new-book-author'),
  newBookGenre: document.getElementById('new-book-genre'),
  btnCancelNewBook: document.getElementById('btn-cancel-new-book'),
  btnCreateNewBook: document.getElementById('btn-create-new-book'),
  newBookGlossaryToggle: document.getElementById('new-book-glossary-toggle'),
  
  // Glossary Modal (Big Pop Up Box)
  modalGlossary: document.getElementById('modal-glossary'),
  modalGlossaryDialog: document.getElementById('modal-glossary-dialog'),
  glossaryDrawer: document.getElementById('modal-glossary'),
  btnCloseGlossary: document.getElementById('btn-close-glossary'),
  glossaryTotalBadge: document.getElementById('glossary-total-badge'),
  glossarySearch: document.getElementById('glossary-search'),
  btnClearGlossarySearch: document.getElementById('btn-clear-glossary-search'),
  glossaryCategoryFilter: document.getElementById('glossary-category-filter'),
  glossarySortSelect: document.getElementById('glossary-sort-select'),
  glossaryCountLabel: document.getElementById('glossary-count-label'),
  glossaryListContainer: document.getElementById('glossary-list-container'),
  btnOpenAddCharForm: document.getElementById('btn-open-add-char-form'),
  btnOpenWikiScraper: document.getElementById('btn-open-wiki-scraper'),
  
  wikiScraperPanel: document.getElementById('wiki-scraper-panel'),
  wikiUrlInput: document.getElementById('wiki-url-input'),
  btnCancelWiki: document.getElementById('btn-cancel-wiki'),
  btnRunWikiScrape: document.getElementById('btn-run-wiki-scrape'),
  
  charEditPanel: document.getElementById('char-edit-panel'),
  charFormHeading: document.getElementById('char-form-heading'),
  charFormId: document.getElementById('char-form-id'),
  charFormCategory: document.getElementById('char-form-category'),
  charFormName: document.getElementById('char-form-name'),
  btnAiAutofillChar: document.getElementById('btn-ai-autofill-char'),
  charFormPinyin: document.getElementById('char-form-pinyin'),
  charAliasContainer: document.getElementById('char-alias-container'),
  charAliasList: document.getElementById('char-alias-list'),
  charFormAliases: document.getElementById('char-form-aliases'),
  charFormSect: document.getElementById('char-form-sect'),
  charFormSummary: document.getElementById('char-form-summary'),
  btnCancelCharForm: document.getElementById('btn-cancel-char-form'),
  btnSaveCharForm: document.getElementById('btn-save-char-form'),
  
  apiStatusBadge: document.getElementById('api-status-badge'),
  toast: document.getElementById('toast')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  checkApiStatus();
  setupEventListeners();
  setupDesktopSyncPopover();
  loadBooks();
});

function showToast(message, duration = 3200) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  setTimeout(() => elements.toast.classList.remove('show'), duration);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Interactive Alias Tag Manager ---
let charAliasManager = null;
let searchLoreAliasManager = null;

function createAliasTagManager({ container, list, input, onAliasesChanged }) {
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

// Load persisted settings
function initSettings() {
  const savedTheme = localStorage.getItem('xianxia_theme') || 'theme-sepia';
  const savedFont = localStorage.getItem('xianxia_font') || 'font-serif';
  const savedSize = parseInt(localStorage.getItem('xianxia_fontsize') || '18', 10);
  const savedMode = localStorage.getItem('xianxia_app_mode') || 'manage';
  
  setTheme(savedTheme);
  setFontFamily(savedFont);
  setFontSize(savedSize);
  setAppMode(savedMode);

  const explicitSort = localStorage.getItem('xianxia_home_sort_v2');
  const savedHomeSort = explicitSort || 'last_read';
  state.homeSortBy = savedHomeSort;
  localStorage.setItem('xianxia_home_sort', savedHomeSort);
  if (elements.homeBooksSortSelect) {
    elements.homeBooksSortSelect.value = savedHomeSort;
  }
}

function setAppMode(mode) {
  closeBookMoreMenu();
  state.appMode = mode;
  localStorage.setItem('xianxia_app_mode', mode);

  if (mode === 'readonly') {
    document.body.classList.add('mode-readonly');
    elements.btnViewTable.classList.add('active');
    elements.btnViewCards.classList.remove('active');
    elements.chaptersCardsContainer.style.display = 'none';
    elements.chaptersTableContainer.style.display = 'block';
    if (elements.badgeSharedGlossary) {
      elements.badgeSharedGlossary.setAttribute('aria-disabled', 'true');
    }
  } else {
    document.body.classList.remove('mode-readonly');
    elements.btnViewCards.classList.add('active');
    elements.btnViewTable.classList.remove('active');
    elements.chaptersCardsContainer.style.display = 'flex';
    elements.chaptersTableContainer.style.display = 'none';
    if (elements.badgeSharedGlossary) {
      elements.badgeSharedGlossary.removeAttribute('aria-disabled');
    }
  }

}

function setTheme(theme) {
  state.theme = theme;
  document.body.className = `${state.fontFamily} ${theme}${state.appMode === 'readonly' ? ' mode-readonly' : ''}`;
  elements.readerOverlay.className = `reader-overlay ${state.fontFamily} ${theme}`;
  
  document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  localStorage.setItem('xianxia_theme', theme);
}

function setFontFamily(font) {
  state.fontFamily = font;
  document.body.className = `${font} ${state.theme}${state.appMode === 'readonly' ? ' mode-readonly' : ''}`;
  elements.readerOverlay.className = `reader-overlay ${font} ${state.theme}`;
  elements.readerFontFamily.value = font;
  localStorage.setItem('xianxia_font', font);
}

function setFontSize(size) {
  state.fontSize = Math.min(Math.max(size, 14), 28);
  if (elements.readerContentBody) {
    elements.readerContentBody.style.fontSize = `${state.fontSize}px`;
    elements.readerContentBody.querySelectorAll('p').forEach(p => {
      p.style.fontSize = `${state.fontSize}px`;
    });
  }
  localStorage.setItem('xianxia_fontsize', state.fontSize);
}

async function checkApiStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.geminiConfigured = data.gemini_configured;
    
    if (state.geminiConfigured) {
      elements.apiStatusBadge.className = 'status-pill status-connected';
      elements.apiStatusBadge.innerHTML = `<span class="status-dot"></span>${ICONS.wifi}`;
      elements.apiStatusBadge.title = 'Cloud & Sync Status';
    } else {
      elements.apiStatusBadge.className = 'status-pill status-disconnected';
      elements.apiStatusBadge.innerHTML = `<span class="status-dot"></span>${ICONS.wifiOff}`;
      elements.apiStatusBadge.title = 'Cloud & Sync Status (Gemini not configured)';
    }
  } catch (err) {
    console.error('Error checking API status:', err);
  }
}

function setupDesktopSyncPopover() {
  const badge = document.getElementById('api-status-badge');
  const popover = document.getElementById('desktop-sync-popover');
  const btnSync = document.getElementById('btn-desk-sync-now');
  const cloudVal = document.getElementById('desk-sync-cloud');
  const geminiVal = document.getElementById('desk-sync-gemini');
  const timeVal = document.getElementById('desk-sync-time');

  let lastSync = new Date();

  const updateDisplay = () => {
    if (geminiVal) geminiVal.textContent = state.geminiConfigured ? 'Ready' : 'Not Configured';
    if (cloudVal) cloudVal.textContent = 'Connected (Supabase)';
    if (timeVal) timeVal.textContent = lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (badge) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!popover) return;
      const isOpen = popover.style.display === 'block';
      popover.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) updateDisplay();
    });
  }

  document.addEventListener('click', (e) => {
    if (popover && popover.style.display === 'block' && !popover.contains(e.target) && e.target !== badge) {
      popover.style.display = 'none';
    }
  });

  // Automatic silent sync on launch
  setTimeout(async () => {
    try {
      const res = await fetch('/api/sync-supabase', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        lastSync = new Date();
        updateDisplay();
      }
    } catch (_) {}
  }, 1000);

  const performFullSync = async ({ silent = false } = {}) => {
    if (btnSync && !silent) {
      btnSync.textContent = 'Syncing...';
      btnSync.disabled = true;
    }
    try {
      const res = await fetch('/api/sync-supabase', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        lastSync = new Date();
        updateDisplay();
        if (!silent) showToast('Synced with Supabase successfully.');
        await loadBooks();
        if (state.activeBookId) {
          await loadChapters(state.activeBookId);
          await loadGlossary(state.activeBookId);
          const currentBook = state.books.find(b => b.id === state.activeBookId);
          if (currentBook) {
            const lastRead = currentBook.last_read_chapter || 1;
            if (elements.btnContinueReading) {
              elements.btnContinueReading.innerHTML = `${ICONS.book} <span>Continue (Ch ${lastRead})</span>`;
              elements.btnContinueReading.onclick = () => openReader(lastRead);
            }
            updateBookmarkButton();
          }
        }
      } else if (!silent) {
        showToast('Sync error: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      if (!silent) showToast('Sync network error');
    } finally {
      if (btnSync && !silent) {
        btnSync.textContent = 'Sync Now';
        btnSync.disabled = false;
      }
    }
  };

  if (btnSync) {
    btnSync.addEventListener('click', () => performFullSync({ silent: false }));
  }

  // Auto-sync when window gains focus or tab becomes active
  window.addEventListener('focus', () => {
    performFullSync({ silent: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      performFullSync({ silent: true });
    }
  });

  // Periodic heartbeat sync every 45s while active
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      performFullSync({ silent: true });
    }
  }, 45000);
}

// --- Data Fetching ---
async function loadBooks() {
  try {
    const res = await fetch('/api/books');
    state.books = await res.json();
    state.books.forEach((b, idx) => {
      if (b._orderIndex === undefined) {
        b._orderIndex = idx;
      }
    });
    renderBooksList();
    renderHomeBooksGrid();
    
    if (state.books.length > 0) {
      // Pick first book or persisted book
      const lastBookId = localStorage.getItem('xianxia_last_book') || state.books[0].id;
      const targetBook = state.books.find(b => b.id === lastBookId) || state.books[0];
      await selectBook(targetBook.id);
    }
    
    const wasReaderOpen = localStorage.getItem('xianxia_reader_open') === 'true';
    const savedView = localStorage.getItem('xianxia_current_view');
    if (wasReaderOpen || savedView === 'book') {
      showBookView();
    } else {
      showHomeView();
    }
  } catch (err) {
    console.error('Error loading books:', err);
  }
}

function renderBooksList() {
  elements.booksList.innerHTML = '';
  state.books.forEach(book => {
    const item = document.createElement('div');
    item.className = `book-nav-item ${book.id === state.activeBookId ? 'active' : ''}`;
    item.dataset.id = book.id;
    
    item.innerHTML = `
      <div class="book-nav-item-left">
        <span class="book-accent-bar" style="background-color: ${book.color || '#ba6d78'};"></span>
        <div class="book-info-col">
          <span class="book-nav-title" title="${book.title}">${book.title}</span>
          <span class="book-nav-author">${book.author}</span>
        </div>
      </div>
      <span class="book-nav-badge">${book.chapters_count || 0} ch</span>
    `;
    
    item.addEventListener('click', () => {
      selectBook(book.id);
      showBookView();
    });
    elements.booksList.appendChild(item);
  });
}

// --- HOME SHELF VIEW & BOOK VIEW NAVIGATION ---
function showHomeView() {
  state.currentView = 'home';
  localStorage.setItem('xianxia_current_view', 'home');
  closeBookMoreMenu();
  closeSearchDrawer();
  closeGlossary();
  closeAllHomeDropdowns();
  if (elements.homeShelfView) elements.homeShelfView.style.display = 'block';
  if (elements.appLayout) elements.appLayout.style.display = 'none';
  renderHomeBooksGrid();
}

function showBookView() {
  state.currentView = 'book';
  localStorage.setItem('xianxia_current_view', 'book');
  closeAllHomeDropdowns();
  if (elements.homeShelfView) elements.homeShelfView.style.display = 'none';
  if (elements.appLayout) elements.appLayout.style.display = 'grid';
}

function closeAllHomeDropdowns() {
  document.querySelectorAll('.card-dropdown.open').forEach(el => el.classList.remove('open'));
}

function openNewBookModal() {
  if (elements.modalNewBook) {
    elements.modalNewBook.style.display = 'flex';
    elements.newBookTitle?.focus();
  }
}

function parseTimestamp(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const direct = new Date(str).getTime();
  if (!isNaN(direct) && direct > 0 && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    return direct;
  }
  const parts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    const d = new Date(year, month, day).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  return !isNaN(direct) ? direct : 0;
}

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
    const d = parseTimestamp(book.last_read_at);
    if (d > 0) return d;
  }
  if (book.updated_at) {
    const d = parseTimestamp(book.updated_at);
    if (d > 0) return d;
  }
  if (book.created_at) {
    const d = parseTimestamp(book.created_at);
    if (d > 0) return d;
  }
  return (book._orderIndex !== undefined ? book._orderIndex : 0);
}

function isCurrentBookChinese() {
  const currentBook = state.books.find(b => b.id === state.activeBookId);
  const g = ((currentBook && currentBook.genre) || '').toLowerCase();
  const t = ((currentBook && currentBook.title) || '').toLowerCase();
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

function getFilteredAndSortedHomeBooks() {
  let list = [...state.books];

  // Search filter (novel title and author name)
  const query = (state.homeSearchQuery || '').trim().toLowerCase();
  if (query) {
    list = list.filter(b => {
      const titleMatch = (b.title || '').toLowerCase().includes(query);
      const authorMatch = (b.author || '').toLowerCase().includes(query);
      return titleMatch || authorMatch;
    });
  }

  // Sort options
  const sortBy = state.homeSortBy || 'last_read';
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

function renderHomeBooksGrid() {
  if (!elements.homeBooksGrid) return;
  elements.homeBooksGrid.innerHTML = '';
  
  const displayedBooks = getFilteredAndSortedHomeBooks();
  const query = (state.homeSearchQuery || '').trim();

  if (elements.homeBooksCountLabel) {
    const totalCount = state.books.length;
    if (query) {
      elements.homeBooksCountLabel.textContent = `${displayedBooks.length} of ${totalCount} ${totalCount === 1 ? 'book' : 'books'} found`;
    } else {
      elements.homeBooksCountLabel.textContent = `${totalCount} ${totalCount === 1 ? 'book' : 'books'} in your collection`;
    }
  }
  
  if (state.books.length === 0) {
    elements.homeBooksGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--border-light);">
        <p style="font-size: 1.15rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">Your library is empty</p>
        <p style="font-size: 0.92rem; color: var(--text-muted); margin-bottom: 22px;">Start a new book or import an EPUB to begin reading.</p>
        <button type="button" class="btn btn-rose" id="btn-empty-home-start" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 0.92rem; font-weight: 600; border-radius: 8px; cursor: pointer;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Start New Book</span>
        </button>
      </div>
    `;
    const emptyStartBtn = elements.homeBooksGrid.querySelector('#btn-empty-home-start');
    if (emptyStartBtn) {
      emptyStartBtn.addEventListener('click', openNewBookModal);
    }
    return;
  }

  if (displayedBooks.length === 0) {
    elements.homeBooksGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--border-light);">
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">No matching books found</p>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 18px;">No novels match "${escapeHtml(query)}".</p>
        <button type="button" class="btn btn-secondary" id="btn-reset-home-search" style="padding: 7px 16px; font-size: 0.85rem; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-light); background: #ffffff;">
          Clear Search
        </button>
      </div>
    `;
    const resetBtn = elements.homeBooksGrid.querySelector('#btn-reset-home-search');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (elements.homeBooksSearchInput) elements.homeBooksSearchInput.value = '';
        if (elements.btnClearHomeSearch) elements.btnClearHomeSearch.style.display = 'none';
        state.homeSearchQuery = '';
        renderHomeBooksGrid();
        elements.homeBooksSearchInput?.focus();
      });
    }
    return;
  }

  displayedBooks.forEach(book => {
    const total = book.chapters_count || 1;
    const current = book.last_read_chapter || 0;
    const percent = Math.min(100, Math.round((current / total) * 100));

    // SVG circle progress: circumference for r=16 is 2 * PI * 16 = 100.53
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    const progressColor = percent === 100 ? '#5c8672' : (book.color || '#ba6d78');

    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.id = book.id;
    card.style.cursor = 'pointer';

    let coverHtml = '';
    if (book.cover) {
      coverHtml = `
        <img src="${book.cover}" alt="${escapeHtml(book.title)} cover" class="book-cover-img">
      `;
    } else {
      coverHtml = `
        <div class="empty-cover-placeholder" data-action="upload-cover" title="Click to upload cover image">
          <div class="empty-cover-icon" style="background: ${book.color || '#ba6d78'}18; color: ${book.color || '#ba6d78'};">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <span class="btn-add-cover-pill" data-action="upload-cover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Cover
          </span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="book-cover-wrap">
        <span class="badge-category" style="color: ${book.color || '#ba6d78'};">${escapeHtml(book.genre || 'Novel')}</span>
        ${coverHtml}
        <div class="card-top-actions">
          <button type="button" class="btn-card-dots" data-action="toggle-menu" title="Book options">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
          </button>
          <div class="card-dropdown" id="dropdown-${book.id}">
            <button type="button" class="card-dropdown-item" data-action="edit-details">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
              <span>Edit details</span>
            </button>
            <button type="button" class="card-dropdown-item" data-action="upload-cover">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>${book.cover ? 'Change cover' : 'Add cover'}</span>
            </button>
            ${book.cover ? `
              <button type="button" class="card-dropdown-item item-danger" data-action="remove-cover">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span>Remove cover</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="book-card-body">
        <h3 class="home-book-title book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
        <p class="home-book-author book-author">${escapeHtml(book.author ? `by ${book.author}` : 'Unknown Author')}</p>

        <div class="home-card-footer card-footer">
          <div class="book-stats">
            <span class="stat-ch-count">${book.chapters_count || 0} CHAPTERS</span>
            <span class="stat-words">${Number(book.total_words || 0).toLocaleString()} WORDS</span>
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
    `;

    card.addEventListener('click', async (e) => {
      const target = e.target;
      const actionEl = target.closest('[data-action]');
      
      if (actionEl) {
        const action = actionEl.dataset.action;
        e.stopPropagation();
        
        if (action === 'toggle-menu') {
          const dropdown = card.querySelector('.card-dropdown');
          const isOpen = dropdown.classList.contains('open');
          closeAllHomeDropdowns();
          if (!isOpen) {
            dropdown.classList.add('open');
          }
          return;
        }
        
        if (action === 'edit-details') {
          closeAllHomeDropdowns();
          openEditBookModal(book.id, { fromHome: true });
          return;
        }
        
        if (action === 'upload-cover') {
          closeAllHomeDropdowns();
          triggerHomeCoverUpload(book.id);
          return;
        }
        
        if (action === 'remove-cover') {
          closeAllHomeDropdowns();
          removeHomeCover(book.id);
          return;
        }
      }
      
      if (target.closest('.card-dropdown')) {
        return;
      }
      
      closeAllHomeDropdowns();
      await selectBook(book.id, { recordLastRead: true });
      showBookView();
    });

    elements.homeBooksGrid.appendChild(card);
  });
}

function triggerHomeCoverUpload(bookId) {
  state.targetCoverBookId = bookId;
  if (elements.homeCoverFileInput) {
    elements.homeCoverFileInput.value = '';
    elements.homeCoverFileInput.click();
  }
}

async function removeHomeCover(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  try {
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover: '' })
    });
    if (res.ok) {
      book.cover = '';
      renderHomeBooksGrid();
      showToast('Cover removed.');
    } else {
      showToast('Failed to remove cover.');
    }
  } catch (err) {
    console.error('Error removing cover:', err);
    showToast('Error removing cover.');
  }
}

function handleHomeCoverFile(file) {
  if (!file || !state.targetCoverBookId) return;
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (JPEG, PNG, WebP).');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 600;
      const maxH = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      const book = state.books.find(b => b.id === state.targetCoverBookId);
      if (!book) return;
      
      fetch(`/api/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover: compressedDataUrl })
      })
      .then(res => {
        if (res.ok) {
          book.cover = compressedDataUrl;
          renderHomeBooksGrid();
          showToast('Cover updated.');
        } else {
          showToast('Failed to save cover.');
        }
      })
      .catch(err => {
        console.error('Error uploading cover:', err);
        showToast('Error saving cover.');
      });
    };
    img.onerror = () => {
      alert('Failed to read image file.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function getBookBookmark(bookId) {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`xianxia_bookmark_${bookId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const book = state.books.find(b => b.id === bookId);
  return (book && book.bookmark) ? book.bookmark : null;
}

function saveBookBookmark(bookId, bookmarkData) {
  if (!bookId) return;
  if (bookmarkData) {
    localStorage.setItem(`xianxia_bookmark_${bookId}`, JSON.stringify(bookmarkData));
  } else {
    localStorage.removeItem(`xianxia_bookmark_${bookId}`);
  }
  const book = state.books.find(b => b.id === bookId);
  if (book) {
    book.bookmark = bookmarkData;
    fetch(`/api/books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmark: bookmarkData })
    }).catch(err => console.error('Error saving bookmark:', err));
  }
  updateBookmarkButton();
  renderChapters();
}

function updateBookmarkButton() {
  if (!elements.btnGoBookmark) return;
  const bookmark = getBookBookmark(state.activeBookId);
  if (bookmark && bookmark.chapter_number) {
    elements.btnGoBookmark.style.display = 'inline-flex';
    elements.btnGoBookmark.title = `Go to bookmark (Ch ${bookmark.chapter_number})`;
    elements.btnGoBookmark.onclick = () => {
      openReader(bookmark.chapter_number, true);
    };
  } else {
    elements.btnGoBookmark.style.display = 'none';
  }
}

function applyBookGlossaryState(book) {
  const enabled = book ? (book.enable_glossary !== false) : true;
  
  // Top nav open search button
  if (elements.btnOpenSearch) {
    elements.btnOpenSearch.title = 'Search';
  }
  if (elements.btnOpenGlossary && elements.btnOpenGlossary !== elements.btnOpenSearch) {
    elements.btnOpenGlossary.style.display = enabled ? '' : 'none';
  }
  if (elements.btnMainGlossary) {
    elements.btnMainGlossary.style.display = enabled ? '' : 'none';
  }
  
  // Search drawer: hide/show Lore scope pill
  const lorePill = document.querySelector('.search-scope-pill[data-scope="lore"]');
  if (lorePill) {
    lorePill.style.display = enabled ? '' : 'none';
  }
  
  // Search drawer: hide/show Quick Add Lore button row
  if (elements.searchLoreActionsRow) {
    elements.searchLoreActionsRow.style.display = enabled ? '' : 'none';
  }

  // If lore was selected but is now disabled, fallback to 'all'
  if (!enabled && state.searchScope === 'lore') {
    state.searchScope = 'all';
    document.querySelectorAll('.search-scope-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.scope === 'all');
    });
  }

  // Close quick add lore form in search drawer if disabled
  if (!enabled) {
    closeSearchLoreForm();
  }

  // Update search input placeholder
  if (elements.readerSearchInput) {
    elements.readerSearchInput.placeholder = enabled
      ? 'Search chapters, dialogue, lore...'
      : 'Search chapters, dialogue, scenes...';
  }

  // Reader top bar glossary button
  if (elements.btnReaderGlossary) {
    elements.btnReaderGlossary.style.display = enabled ? '' : 'none';
  }

  // If drawer is open and glossary is disabled, close it
  if (!enabled && elements.glossaryDrawer) {
    elements.glossaryDrawer.classList.remove('open');
    hideCharacterTooltip();
  }

  // Hide selection popup if open
  if (!enabled) {
    hideSelectionPopup();
  }
}

async function selectBook(bookId, { recordLastRead = false } = {}) {
  closeBookMoreMenu();
  state.activeBookId = bookId;
  state.managePage = 1;
  state.seeAll = false;
  localStorage.setItem('xianxia_last_book', bookId);
  
  const book = state.books.find(b => b.id === bookId);
  if (recordLastRead && book) {
    const nowMs = Date.now();
    try {
      localStorage.setItem(`xianxia_book_last_read_${bookId}`, String(nowMs));
    } catch (e) {}
    book.last_read_at = new Date(nowMs).toISOString();
    fetch(`/api/books/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_read_at: book.last_read_at })
    }).catch(() => {});
  }
  renderBooksList();
  
  if (!book) return;
  
  applyBookGlossaryState(book);

  elements.displayBookTitle.textContent = book.title;
  elements.displayBookAuthor.textContent = `by ${book.author}`;
  elements.badgeGenre.textContent = (book.genre || 'Web Novel').toUpperCase();
  elements.badgeChapters.textContent = `${book.chapters_count || 0} CHAPTERS`;
  elements.badgeWords.textContent = `${Number(book.total_words || 0).toLocaleString()} WORDS`;
  
  if (elements.badgeSharedGlossary && elements.badgeSharedDivider) {
    if (book.shared_glossary_id) {
      const sharedBooks = state.books.filter(b => b.shared_glossary_id === book.shared_glossary_id);
      const otherTitles = sharedBooks.filter(b => b.id !== book.id).map(b => b.title);
      elements.badgeSharedGlossaryText.textContent = `SHARED LORE (${sharedBooks.length} BOOKS)`;
      elements.badgeSharedGlossary.title = otherTitles.length ? `Shared series lore with: ${otherTitles.join(', ')}` : 'Shared Series Lore';
      elements.badgeSharedGlossary.style.display = 'inline-flex';
      elements.badgeSharedDivider.style.display = 'inline-block';
    } else {
      elements.badgeSharedGlossary.style.display = 'none';
      elements.badgeSharedDivider.style.display = 'none';
    }
  }
  
  const savedLastRead = parseInt(localStorage.getItem(`xianxia_last_read_${book.id}`), 10);
  const lastRead = savedLastRead || book.last_read_chapter || 1;
  book.last_read_chapter = lastRead;

  updateBookmarkButton();
  
  // Load chapters first so mention counts are immediately available for the glossary
  await loadChapters(bookId);
  await loadGlossary(bookId);

  if (state.chapters.length === 0) {
    if (elements.btnContinueReading) elements.btnContinueReading.style.display = 'none';
  } else {
    if (elements.btnContinueReading) {
      elements.btnContinueReading.style.display = 'inline-flex';
      elements.btnContinueReading.innerHTML = `${ICONS.book} <span>Continue (Ch ${lastRead})</span>`;
      elements.btnContinueReading.onclick = () => openReader(lastRead);
    }
  }


  // If reader was open when refreshed, automatically re-open reader to last opened chapter
  const wasReaderOpen = localStorage.getItem('xianxia_reader_open') === 'true';
  const savedReaderCh = parseInt(localStorage.getItem('xianxia_reader_ch'), 10) || lastRead;
  if (wasReaderOpen && savedReaderCh) {
    openReader(savedReaderCh);
  }
}

async function loadChapters(bookId) {
  try {
    const res = await fetch(`/api/books/${bookId}/chapters`);
    state.chapters = await res.json();
    state._cachedNovelText = null;
    if (Array.isArray(state.glossary)) {
      state.glossary.forEach(c => {
        delete c._mentionCount;
        delete c._mentionBookId;
      });
    }
    renderChapters();
    if (elements.modalGlossary && elements.modalGlossary.style.display === 'flex') {
      renderGlossary();
    }
  } catch (err) {
    console.error('Error loading chapters:', err);
  }
}

async function loadGlossary(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (book && book.enable_glossary === false) {
    state.glossary = [];
    renderGlossary();
    if (elements.readerOverlay.style.display !== 'none' && state.activeChapter) {
      renderReaderContent(state.activeChapter.content);
    }
    return;
  }

  try {
    const res = await fetch(`/api/books/${bookId}/glossary`);
    state.glossary = await res.json();
    state._cachedNovelText = null;
    renderGlossary();
    // If reader is open, re-render text with updated character tags
    if (elements.readerOverlay.style.display !== 'none' && state.activeChapter) {
      renderReaderContent(state.activeChapter.content);
    }
  } catch (err) {
    console.error('Error loading glossary:', err);
  }
}

// --- Render Chapters (Card View & Table View) ---
function renderChapters() {
  const book = state.books.find(b => b.id === state.activeBookId);
  const currentLastRead = book ? (book.last_read_chapter || 1) : 1;
  const totalChapters = state.chapters.length;

  // Cards View (Manage Mode)
  elements.chaptersCardsContainer.innerHTML = '';
  if (totalChapters === 0) {
    if (elements.btnContinueReading) elements.btnContinueReading.style.display = 'none';
    elements.chaptersCardsContainer.innerHTML = `
      <div class="empty-chapters-card" style="text-align: center; padding: 48px 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--border-light); margin: 16px 0; width: 100%; box-sizing: border-box;">
        <p style="font-size: 1.15rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">No chapters added yet</p>
        <p style="font-size: 0.92rem; margin-bottom: 22px; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.5;">Click below to write or paste your first chapter for this novel.</p>
        <button type="button" class="btn btn-green btn-bottom-write" id="btn-empty-write-chapter" style="display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; font-size: 0.95rem; font-weight: 600; cursor: pointer; border-radius: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          <span>Write chapter</span>
        </button>
      </div>
    `;
    const emptyBtn = elements.chaptersCardsContainer.querySelector('#btn-empty-write-chapter');
    if (emptyBtn) {
      emptyBtn.onclick = openWriteChapterModal;
    }

    if (elements.topPaginationInfo) elements.topPaginationInfo.textContent = '0 chapters';
    if (elements.topPaginationControls) elements.topPaginationControls.innerHTML = '';
    if (elements.topManagePaginationWrapper) elements.topManagePaginationWrapper.style.display = 'none';
    if (elements.bottomManagePaginationWrapper) elements.bottomManagePaginationWrapper.style.display = 'none';
  } else {
    if (elements.btnContinueReading) elements.btnContinueReading.style.display = 'inline-flex';

    // Pagination calculation
    const totalPages = Math.ceil(totalChapters / state.managePageSize) || 1;
    if (state.managePage > totalPages) state.managePage = totalPages;
    if (state.managePage < 1) state.managePage = 1;

    let displayedChapters = state.chapters;
    let startIdx = 0;
    let endIdx = totalChapters;

    if (!state.seeAll) {
      startIdx = (state.managePage - 1) * state.managePageSize;
      endIdx = Math.min(startIdx + state.managePageSize, totalChapters);
      displayedChapters = state.chapters.slice(startIdx, endIdx);
    }

    displayedChapters.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'chapter-card';
      const isLastRead = ch.chapter_number === currentLastRead;
      const lastReadBadge = isLastRead ? '<span class="badge-last-read">LAST READ</span>' : '';

      card.innerHTML = `
        <div class="ch-card-header">
          <span class="ch-pill-badge">CHAPTER ${ch.chapter_number}</span>
          ${lastReadBadge}
          <h3 class="ch-card-title">${ch.title}</h3>
        </div>
        <div class="ch-card-meta">
          <span>${ICONS.pencil} ${(ch.word_count || 0).toLocaleString()} words</span>
          <span>${ICONS.calendar} Added ${ch.created_at || 'Recent'}</span>
        </div>
        <div class="ch-card-snippet">${ch.snippet || ''}</div>
        <div class="ch-card-actions">
          <button class="btn-card-read" data-ch="${ch.chapter_number}">Read</button>
          <button class="btn-card-edit" data-ch="${ch.chapter_number}">Edit</button>
          <button class="btn-card-del" data-ch="${ch.chapter_number}" title="Delete chapter">${ICONS.trash}</button>
        </div>
      `;
      
      card.querySelector('.btn-card-read').onclick = () => openReader(ch.chapter_number);
      card.querySelector('.btn-card-edit').onclick = () => openEditChapterModal(ch.chapter_number);
      card.querySelector('.btn-card-del').onclick = () => deleteChapter(ch.chapter_number);
      elements.chaptersCardsContainer.appendChild(card);
    });

    // Update Manage Mode Pagination UI (Top & Bottom)
    const paginationText = (state.seeAll || totalChapters <= state.managePageSize)
      ? `Showing all ${totalChapters} chapters`
      : `Showing ${startIdx + 1}–${endIdx} of ${totalChapters} chapters`;

    [elements.topPaginationInfo, elements.bottomPaginationInfo].forEach(el => {
      if (el) el.textContent = paginationText;
    });

    [elements.topManagePaginationWrapper, elements.bottomManagePaginationWrapper].forEach(el => {
      if (el) el.style.display = 'flex';
    });

    renderPaginationControls(totalPages);
  }

  // Table View (Read Only Mode)
  elements.chaptersTableBody.innerHTML = '';
  if (totalChapters === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="5" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <p style="margin-bottom: 12px; font-size: 1rem;">No chapters added yet.</p>
        <button type="button" class="btn btn-green btn-sm" id="btn-table-empty-write" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; border-radius: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          <span>Write chapter</span>
        </button>
      </td>
    `;
    const tableWriteBtn = tr.querySelector('#btn-table-empty-write');
    if (tableWriteBtn) tableWriteBtn.onclick = openWriteChapterModal;
    elements.chaptersTableBody.appendChild(tr);
  } else {
    state.chapters.forEach(ch => {
      const tr = document.createElement('tr');
      if (ch.chapter_number === currentLastRead) {
        tr.className = 'row-last-read';
      }
      const bookmark = getBookBookmark(state.activeBookId);
      const isBookmarkedChapter = bookmark && bookmark.chapter_number === ch.chapter_number;
      const bookmarkBadge = isBookmarkedChapter 
        ? `<span class="table-bookmark-icon" title="Bookmarked in this chapter"><svg width="15" height="15" viewBox="0 0 24 24" fill="#e67e22" stroke="#d35400" stroke-width="1"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></span>` 
        : '';
      tr.innerHTML = `
        <td><span class="ch-pill-badge">CH ${ch.chapter_number}</span>${bookmarkBadge}</td>
        <td style="font-family: var(--font-serif); font-weight: 600;">${ch.title}</td>
        <td style="color: var(--text-muted);">${(ch.word_count || 0).toLocaleString()} words</td>
        <td style="color: var(--text-muted);">${ch.created_at || 'Recent'}</td>
        <td>
          <button class="btn-card-read" data-ch="${ch.chapter_number}">Read</button>
        </td>
      `;
      tr.querySelector('.btn-card-read').onclick = () => openReader(ch.chapter_number);
      elements.chaptersTableBody.appendChild(tr);
    });
  }
}


function renderPaginationControls(totalPages) {
  const containers = [elements.topPaginationControls, elements.bottomPaginationControls].filter(Boolean);
  if (containers.length === 0) return;

  containers.forEach(container => {
    container.innerHTML = '';

    // See All Button
    const seeAllBtn = document.createElement('button');
    seeAllBtn.className = `btn-see-all ${state.seeAll ? 'active' : ''}`;
    seeAllBtn.textContent = 'See All';
    seeAllBtn.onclick = () => {
      state.seeAll = !state.seeAll;
      renderChapters();
    };
    container.appendChild(seeAllBtn);

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = state.seeAll || state.managePage <= 1;
    prevBtn.onclick = () => {
      if (state.managePage > 1) {
        state.managePage--;
        renderChapters();
      }
    };
    container.appendChild(prevBtn);

    // Dynamic pages list matching screenshot
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (state.managePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (state.managePage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', state.managePage - 1, state.managePage, state.managePage + 1, '...', totalPages);
      }
    }

    pages.forEach(p => {
      if (p === '...') {
        const ell = document.createElement('span');
        ell.className = 'page-ellipsis';
        ell.textContent = '...';
        container.appendChild(ell);
      } else {
        const pBtn = document.createElement('button');
        pBtn.className = `page-btn ${!state.seeAll && p === state.managePage ? 'active' : ''}`;
        pBtn.textContent = p;
        pBtn.onclick = () => {
          state.seeAll = false;
          state.managePage = p;
          renderChapters();
        };
        container.appendChild(pBtn);
      }
    });

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = state.seeAll || state.managePage >= totalPages;
    nextBtn.onclick = () => {
      if (state.managePage < totalPages) {
        state.managePage++;
        renderChapters();
      }
    };
    container.appendChild(nextBtn);
  });
}

// --- READER OVERLAY & CHARACTER TAGGING ENGINE ---
function renderReaderBookInfo(book) {
  if (!elements.readerBookInfo || !book) return;
  const title = book.title || '';
  const author = book.author || '';
  elements.readerBookInfo.innerHTML = `
    <span class="reader-book-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
    <span class="reader-book-sep">&bull;</span>
    <span class="reader-book-author" title="${escapeHtml(author)}">${escapeHtml(author)}</span>
  `;
}

async function openReader(chapterNumber) {
  closeSearchDrawer();
  if (elements.glossaryDrawer) {
    elements.glossaryDrawer.classList.remove('open');
  }
  const book = state.books.find(b => b.id === state.activeBookId);
  if (!book) return;

  // Track and persist last read chapter (Item 6 & Issue 1)
  book.last_read_chapter = chapterNumber;
  localStorage.setItem(`xianxia_last_read_${book.id}`, chapterNumber);
  localStorage.setItem('xianxia_reader_open', 'true');
  localStorage.setItem('xianxia_reader_ch', chapterNumber);

  fetch(`/api/books/${book.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ last_read_chapter: chapterNumber })
  }).catch(err => console.error('Error updating last read chapter:', err));

  state.activeChapterNum = chapterNumber;
  
  elements.btnContinueReading.innerHTML = `${ICONS.book} <span>Continue (Ch ${chapterNumber})</span>`;
  elements.btnContinueReading.onclick = () => openReader(chapterNumber);
  renderChapters();

  // Show reader overlay immediately with current theme & font
  elements.readerOverlay.className = `reader-overlay ${state.fontFamily} ${state.theme}`;
  elements.readerOverlay.style.display = 'flex';
  elements.readerOverlay.scrollTop = 0;
  renderReaderBookInfo(book);
  elements.readerChSubtitle.textContent = `CHAPTER ${chapterNumber}`;
  elements.readerChTitle.textContent = `Chapter ${chapterNumber}`;
  elements.readerContentBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 60px;">Loading chapter...</p>';

  try {
    const res = await fetch(`/api/books/${book.id}/chapters/${chapterNumber}`);
    if (!res.ok) {
      showToast('Chapter not found.');
      elements.readerOverlay.style.display = 'none';
      return;
    }
    const chData = await res.json();
    state.activeChapter = chData;
    
    const nowMs = Date.now();
    try {
      localStorage.setItem(`xianxia_book_last_read_${book.id}`, String(nowMs));
    } catch (e) {}
    book.last_read_at = new Date(nowMs).toISOString();
    book.last_read_chapter = chData.chapter_number;
    fetch(`/api/books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        last_read_chapter: chData.chapter_number,
        last_read_at: book.last_read_at
      })
    }).catch(() => {});

    // Set Header info
    renderReaderBookInfo(book);
    elements.readerChSubtitle.textContent = `CHAPTER ${chData.chapter_number}`;
    elements.readerChTitle.textContent = chData.title;

    // Populate Chapter Stepper
    elements.readerChapterSelect.innerHTML = '';
    state.chapters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.chapter_number;
      opt.textContent = `Chapter ${c.chapter_number}: ${c.title}`;
      if (c.chapter_number === chData.chapter_number) {
        opt.selected = true;
        elements.readerChapterSelect.title = `Chapter ${c.chapter_number}: ${c.title}`;
      }
      elements.readerChapterSelect.appendChild(opt);
    });

    // Update navigation buttons (hide previous if first chapter, hide next if last chapter)
    const currentIndex = state.chapters.findIndex(c => c.chapter_number === chData.chapter_number);
    const isFirst = currentIndex <= 0;
    const isLast = currentIndex >= state.chapters.length - 1;

    // Top stepper buttons
    elements.btnPrevCh.style.display = isFirst ? 'none' : 'inline-flex';
    elements.btnNextCh.style.display = isLast ? 'none' : 'inline-flex';
    elements.btnPrevCh.disabled = isFirst;
    elements.btnNextCh.disabled = isLast;

    // Bottom navigation buttons
    elements.btnReaderBottomPrev.style.display = isFirst ? 'none' : 'inline-flex';
    elements.btnReaderBottomNext.style.display = isLast ? 'none' : 'inline-flex';
    elements.btnReaderBottomPrev.disabled = isFirst;
    elements.btnReaderBottomNext.disabled = isLast;

    // Render Tagged Content safely
    renderReaderContent(chData.content);
    setFontSize(state.fontSize);

    // If this chapter has a bookmark, highlight line and center it in the viewport
    const bookmark = getBookBookmark(book.id);
    if (bookmark && bookmark.chapter_number === chData.chapter_number) {
      const blocks = elements.readerContentBody.querySelectorAll('.reader-line-block, p');
      const targetP = blocks[bookmark.paragraph_index];
      if (targetP) {
        targetP.classList.add('bookmarked-line');
        setTimeout(() => {
          targetP.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 220);
      }
    }

  } catch (err) {
    console.error('Error opening reader:', err);
    showToast('Error loading chapter: ' + err.message);
  }
}

function sanitizeChapterHtml(rawHtml) {
  if (!rawHtml) return '';
  return rawHtml
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/\s*style\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
    .replace(/\s*class\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, (match) => {
      if (match.includes('reader-image')) return match;
      return '';
    })
    .replace(/\s*(color|bgcolor|face|text)\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');
}

/**
 * CORE FEATURE: Character Name & Alias Tagging Engine
 * Replaces character names/courtesy names/titles in text nodes with <mark class="char-tag">.
 * Uses Longest-Match-First regex to prevent substring collisions.
 */
function renderReaderContent(rawHtml) {
  if (!rawHtml) {
    elements.readerContentBody.innerHTML = '<p>No content in this chapter.</p>';
    return;
  }

  // Sanitize out any pasted inline font/color/style attributes so themes and fonts apply 100%
  rawHtml = sanitizeChapterHtml(rawHtml);

  const currentBook = state.books.find(b => b.id === state.activeBookId);
  const isGlossaryEnabled = currentBook ? (currentBook.enable_glossary !== false) : true;

  if (!isGlossaryEnabled) {
    elements.readerContentBody.innerHTML = rawHtml;
  } else {
    try {
      // Build sorted list of triggers from glossary
    const triggers = [];
    state.glossary.forEach(char => {
      // Primary Name
      if (char.name && char.name.trim()) {
        triggers.push({
          text: char.name.trim(),
          charId: char.id,
          type: 'Name',
          charData: char
        });
      }
      // Chinese / Pinyin
      if (isCurrentBookChinese() && char.pinyin_or_chinese && char.pinyin_or_chinese.trim() && !['n/a', 'none', 'null'].includes(char.pinyin_or_chinese.toLowerCase().trim())) {
        triggers.push({
          text: char.pinyin_or_chinese.trim(),
          charId: char.id,
          type: 'Name',
          charData: char
        });
      }
      // Aliases & Titles
      if (Array.isArray(char.aliases)) {
        char.aliases.forEach(alias => {
          if (alias && alias.trim()) {
            triggers.push({
              text: alias.trim(),
              charId: char.id,
              type: 'Alias/Title',
              charData: char
            });
          }
        });
      }
    });

    // Deduplicate and sort by length descending (longest match first)
    triggers.sort((a, b) => b.text.length - a.text.length);

    if (triggers.length === 0) {
      elements.readerContentBody.innerHTML = rawHtml;
    } else {
      // Escape regex syntax characters safely without illegal escapes in /u mode
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = triggers.map(t => escapeRegex(t.text)).join('|');

      let regex;
      try {
        regex = new RegExp(`(?<=^|[^\\p{L}\\p{N}_])(${pattern})(?=[^\\p{L}\\p{N}_]|$)`, 'giu');
      } catch (e) {
        // Fallback for environments where lookbehind is unsupported
        regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
      }

      // Split HTML by tags so we ONLY replace inside text content, never inside tags or attributes
      const parts = rawHtml.split(/(<[^>]+>)/g);
      const taggedHtml = parts.map(part => {
        if (part.startsWith('<') && part.endsWith('>')) {
          return part;
        }
        return part.replace(regex, (match, p1) => {
          const matchedTrigger = triggers.find(t => t.text.toLowerCase() === p1.toLowerCase());
          const charId = matchedTrigger ? matchedTrigger.charId : '';
          const type = matchedTrigger ? matchedTrigger.type : 'Name';
          const normCat = matchedTrigger && matchedTrigger.charData ? normalizeCategory(matchedTrigger.charData.category) : 'Character';
          const catSlug = getCategorySlug(normCat);
          return `<mark class="char-tag char-tag-${catSlug}" data-char-id="${charId}" data-trigger="${type}" data-category="${escapeHtml(normCat)}">${p1}</mark>`;
        });
      }).join('');

      elements.readerContentBody.innerHTML = taggedHtml;
    }
  } catch (err) {
    console.warn('Fallback: could not tag characters, rendering raw text:', err);
    elements.readerContentBody.innerHTML = rawHtml;
  }
}

  // Normalize paragraphs: convert leaf divs (from pasted/imported HTML) into clean <p> tags
  const divs = Array.from(elements.readerContentBody.querySelectorAll('div'));
  divs.forEach(d => {
    if (!d.querySelector('div') && d.textContent.trim()) {
      const p = document.createElement('p');
      p.innerHTML = d.innerHTML;
      d.replaceWith(p);
    }
  });

  // Remove redundant br tags between paragraphs
  elements.readerContentBody.querySelectorAll('p + br').forEach(br => br.remove());

  // Tag paragraph indices for exact search-to-paragraph jumping
  const pTags = elements.readerContentBody.querySelectorAll('p');
  pTags.forEach((p, idx) => {
    p.dataset.pIdx = idx;
  });

  // Label all paragraph blocks with .reader-line-block and index data-p-index
  const blocks = Array.from(elements.readerContentBody.querySelectorAll('p, .reader-content > div'));
  blocks.forEach((el, idx) => {
    el.classList.add('reader-line-block');
    el.dataset.pIndex = idx;
  });

  // Attach Click Events to all .char-tag elements if glossary is enabled
  if (isGlossaryEnabled) {
    setupCharacterClickListeners();
  }
}

// --- FLOATING LORE TOOLTIP CLICK ENGINE ---
let currentActiveTag = null;

function hideCharacterTooltip() {
  if (elements.charHoverCard) {
    elements.charHoverCard.style.display = 'none';
  }
  if (currentActiveTag) {
    currentActiveTag.classList.remove('active-tag');
    currentActiveTag = null;
  }
}

function setupCharacterClickListeners() {
  const tags = elements.readerContentBody.querySelectorAll('.char-tag');
  
  tags.forEach(tag => {
    // Click on lore word to open info card
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = tag.dataset.charId;
      const char = state.glossary.find(c => c.id === charId);
      if (!char) return;

      // Toggle off if already open for this same tag
      if (elements.charHoverCard.style.display !== 'none' && currentActiveTag === tag) {
        hideCharacterTooltip();
        return;
      }

      // Remove active class from previous tag
      if (currentActiveTag) {
        currentActiveTag.classList.remove('active-tag');
      }

      currentActiveTag = tag;
      tag.classList.add('active-tag');
      showCharacterTooltip(tag, char, tag.dataset.trigger || 'Name');
    });
  });

  // Click on reader image to view full-resolution in a new tab
  elements.readerContentBody.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (img.src) {
        window.open(img.src, '_blank');
      }
    });
  });

  // Stop clicks inside the card from closing it
  elements.charHoverCard.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function showCharacterTooltip(targetElement, char, triggerType) {
  elements.charHoverName.textContent = char.name;
  if (elements.charHoverChinese) {
    elements.charHoverChinese.textContent = '';
  }

  const normCat = normalizeCategory(char.category || triggerType);
  elements.charHoverTrigger.textContent = normCat;

  // Clean previous category classes from popup box and trigger pill
  const allCategorySlugs = ['character', 'weapon-item', 'clan-sect', 'location-realm', 'concept-lore'];
  allCategorySlugs.forEach(slug => {
    elements.charHoverCard.classList.remove(`cat-box-${slug}`);
    elements.charHoverTrigger.classList.remove(`cat-badge-${slug}`);
  });

  // Apply category-specific classes
  elements.charHoverCard.classList.add(getCategoryBoxClass(normCat));
  elements.charHoverTrigger.classList.add(getCategoryBadgeClass(normCat));
  
  const aff = char.affiliation || char.sect_or_affiliation || '';
  if (aff) {
    elements.charHoverSect.textContent = aff;
    elements.charHoverSect.style.display = 'block';
  } else {
    elements.charHoverSect.style.display = 'none';
  }

  let allAliases = Array.isArray(char.aliases) ? [...char.aliases] : [];
  if (isCurrentBookChinese() && char.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(char.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => a.toLowerCase() === char.pinyin_or_chinese.toLowerCase())) {
    allAliases.push(char.pinyin_or_chinese);
  }

  if (allAliases.length > 0) {
    elements.charHoverAliases.textContent = allAliases.join(', ');
    elements.charHoverAliasesRow.style.display = 'block';
  } else {
    elements.charHoverAliasesRow.style.display = 'none';
  }

  elements.charHoverSummary.textContent = char.summary || 'No description available yet.';

  // Quick edit button inside tooltip: open search sidebar with entry pulled up ready to edit
  elements.btnHoverEditChar.onclick = (e) => {
    if (e) e.stopPropagation();
    hideCharacterTooltip();
    openSearchDrawer();
    openSearchLoreForm('', char);
  };

  // Position tooltip relative to viewport and scroll
  elements.charHoverCard.style.display = 'block';
  const rect = targetElement.getBoundingClientRect();
  const cardRect = elements.charHoverCard.getBoundingClientRect();
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const navBarHeight = 72; // Height of sticky reader header with margin

  // Calculate left position (centered over target)
  let left = rect.left + (rect.width / 2) - (cardRect.width / 2);
  if (left < 16) left = 16;
  if (left + cardRect.width > viewportWidth - 16) left = viewportWidth - cardRect.width - 16;

  // Space available above and below target
  const spaceAbove = rect.top - navBarHeight;
  const spaceBelow = viewportHeight - rect.bottom;

  let top;
  // Place ABOVE only if it comfortably fits without colliding with the top nav bar
  if (spaceAbove >= cardRect.height + 14) {
    top = rect.top - cardRect.height - 10;
    elements.cardArrow.className = 'card-arrow arrow-bottom';
    elements.cardArrow.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - left - 5, 16), cardRect.width - 24)}px`;
  } else if (spaceBelow >= cardRect.height + 14) {
    // Fits comfortably below
    top = rect.bottom + 10;
    elements.cardArrow.className = 'card-arrow arrow-top';
    elements.cardArrow.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - left - 5, 16), cardRect.width - 24)}px`;
  } else {
    // Tight space: pick whichever has more room and clamp within visible bounds
    if (spaceBelow >= spaceAbove) {
      top = Math.min(rect.bottom + 10, viewportHeight - cardRect.height - 12);
      elements.cardArrow.className = 'card-arrow arrow-top';
      elements.cardArrow.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - left - 5, 16), cardRect.width - 24)}px`;
    } else {
      top = Math.max(navBarHeight + 6, rect.top - cardRect.height - 10);
      elements.cardArrow.className = 'card-arrow arrow-bottom';
      elements.cardArrow.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - left - 5, 16), cardRect.width - 24)}px`;
    }
  }

  elements.charHoverCard.style.left = `${Math.round(left)}px`;
  elements.charHoverCard.style.top = `${Math.round(top)}px`;
}

// --- FLOATING TEXT SELECTION "ADD TO GLOSSARY" ENGINE ---
let activeSelectedText = '';

function handleTextSelection() {
  if (!elements.readerOverlay || elements.readerOverlay.style.display === 'none') {
    hideSelectionPopup();
    return;
  }

  const currentBook = state.books.find(b => b.id === state.activeBookId);
  if (currentBook && currentBook.enable_glossary === false) {
    hideSelectionPopup();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hideSelectionPopup();
    return;
  }

  const text = selection.toString().trim();
  // Filter out single characters or large multi-sentence selections
  if (text.length < 2 || text.length > 50 || text.includes('\n')) {
    hideSelectionPopup();
    return;
  }

  try {
    const range = selection.getRangeAt(0);
    const container = elements.readerContentBody;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      hideSelectionPopup();
      return;
    }

    activeSelectedText = text;
    showSelectionPopup(range);
  } catch (err) {
    hideSelectionPopup();
  }
}

function showSelectionPopup(range) {
  if (!elements.readerSelectionPopup) return;

  // Reset button state
  elements.btnSelectionAddGlossary.className = 'btn-selection-glossary';
  elements.btnSelectionAddGlossary.disabled = false;
  elements.selectionBtnText.textContent = 'Add to glossary';

  elements.readerSelectionPopup.style.display = 'flex';
  const rect = range.getBoundingClientRect();
  const popupRect = elements.readerSelectionPopup.getBoundingClientRect();

  // Center horizontally over selected text
  let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
  left = Math.max(12, Math.min(left, window.innerWidth - popupRect.width - 12));

  // Position above the selection
  let top = rect.top - popupRect.height - 10;
  if (top < 70) {
    // If too close to sticky topbar, display right below the selected text
    top = rect.bottom + 8;
  }

  elements.readerSelectionPopup.style.left = `${Math.round(left)}px`;
  elements.readerSelectionPopup.style.top = `${Math.round(top)}px`;
}

function hideSelectionPopup() {
  if (elements.readerSelectionPopup) {
    elements.readerSelectionPopup.style.display = 'none';
  }
}

// --- GLOSSARY MENTION COUNT ENGINE & FILTERS ---
function getNovelPlainText() {
  if (state._cachedNovelText && state._cachedNovelTextBookId === state.activeBookId && state._cachedNovelTextChCount === (state.chapters ? state.chapters.length : 0)) {
    return state._cachedNovelText;
  }
  let combined = '';
  if (Array.isArray(state.chapters) && state.chapters.length > 0) {
    for (const ch of state.chapters) {
      if (ch && ch.content) {
        combined += ' ' + ch.content.replace(/<[^>]+>/g, ' ');
      }
    }
  }
  state._cachedNovelText = combined.toLowerCase();
  state._cachedNovelTextBookId = state.activeBookId;
  state._cachedNovelTextChCount = state.chapters ? state.chapters.length : 0;
  return state._cachedNovelText;
}

function getGlossaryMentionCount(char) {
  if (!char) return 0;
  if (char._mentionCount !== undefined && char._mentionBookId === state.activeBookId) {
    return char._mentionCount;
  }
  
  if (!state.chapters || state.chapters.length === 0) {
    // Chapters haven't loaded yet — DO NOT cache zero
    return 0;
  }

  const fullText = getNovelPlainText();
  if (!fullText.trim()) {
    return 0;
  }

  const searchTerms = [char.name, ...(char.aliases || []), char.pinyin_or_chinese]
    .filter(Boolean)
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s.length > 1);

  const uniqueTerms = Array.from(new Set(searchTerms));
  let count = 0;
  for (const term of uniqueTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isAsciiWord = /^[a-z0-9\s]+$/i.test(term);
    const regex = isAsciiWord ? new RegExp('\\b' + escaped + '\\b', 'gi') : new RegExp(escaped, 'gi');
    const matches = fullText.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  char._mentionCount = count;
  char._mentionBookId = state.activeBookId;
  return count;
}

const CANONICAL_CATEGORIES = [
  'Character',
  'Race / Creature',
  'Weapon / Item',
  'Clan / Sect',
  'Location / Realm',
  'Concept / Lore'
];

const CATEGORY_DISPLAY_CONFIG = [
  { key: 'Character', label: 'Characters', dotClass: 'cat-dot-character', badgeClass: 'cat-badge-character' },
  { key: 'Race / Creature', label: 'Races / Creatures', dotClass: 'cat-dot-race-creature', badgeClass: 'cat-badge-race-creature' },
  { key: 'Weapon / Item', label: 'Weapons / Items', dotClass: 'cat-dot-weapon-item', badgeClass: 'cat-badge-weapon-item' },
  { key: 'Clan / Sect', label: 'Clans / Sects', dotClass: 'cat-dot-clan-sect', badgeClass: 'cat-badge-clan-sect' },
  { key: 'Location / Realm', label: 'Locations / Realms', dotClass: 'cat-dot-location-realm', badgeClass: 'cat-badge-location-realm' },
  { key: 'Concept / Lore', label: 'Concepts / Lore', dotClass: 'cat-dot-concept-lore', badgeClass: 'cat-badge-concept-lore' }
];

const CATEGORY_NORMALIZATION_MAP = {
  'character': 'Character',
  'race / creature': 'Race / Creature',
  'race/creature': 'Race / Creature',
  'race': 'Race / Creature',
  'creature': 'Race / Creature',
  'species': 'Race / Creature',
  'animal': 'Race / Creature',
  'beast': 'Race / Creature',
  'monster': 'Race / Creature',
  'spiritual beast': 'Race / Creature',
  'demonic beast': 'Race / Creature',
  'spirit beast': 'Race / Creature',
  'demon': 'Race / Creature',
  'beasts': 'Race / Creature',
  'creatures': 'Race / Creature',
  'monsters': 'Race / Creature',
  'races': 'Race / Creature',
  'weapon / item': 'Weapon / Item',
  'weapon / artifact': 'Weapon / Item',
  'weapon/artifact': 'Weapon / Item',
  'weapon': 'Weapon / Item',
  'artifact': 'Weapon / Item',
  'item': 'Weapon / Item',
  'tool': 'Weapon / Item',
  'clan / sect': 'Clan / Sect',
  'cultivation sect / faction': 'Clan / Sect',
  'sect': 'Clan / Sect',
  'clan': 'Clan / Sect',
  'faction': 'Clan / Sect',
  'organization': 'Clan / Sect',
  'location / realm': 'Location / Realm',
  'location': 'Location / Realm',
  'canonical location': 'Location / Realm',
  'location / lore': 'Location / Realm',
  'canonical location/lore': 'Location / Realm',
  'realm': 'Location / Realm',
  'place': 'Location / Realm',
  'concept / lore': 'Concept / Lore',
  'lore': 'Concept / Lore',
  'lore / technique': 'Concept / Lore',
  'lore / cultivation': 'Concept / Lore',
  'technique': 'Concept / Lore',
  'concept': 'Concept / Lore'
};

function normalizeCategory(cat) {
  if (!cat) return 'Character';
  const key = String(cat).trim().toLowerCase();
  return CATEGORY_NORMALIZATION_MAP[key] || 'Character';
}

function getCategorySlug(category) {
  const cat = normalizeCategory(category);
  switch (cat) {
    case 'Character': return 'character';
    case 'Race / Creature': return 'race-creature';
    case 'Weapon / Item': return 'weapon-item';
    case 'Clan / Sect': return 'clan-sect';
    case 'Location / Realm': return 'location-realm';
    case 'Concept / Lore': return 'concept-lore';
    default: return 'character';
  }
}

function getCategoryBadgeClass(category) {
  return `cat-badge-${getCategorySlug(category)}`;
}

function getCategoryBoxClass(category) {
  return `cat-box-${getCategorySlug(category)}`;
}

// Remove count next to each category in dropdown (Item 3)
function updateGlossaryCategoryDropdown() {
  if (!elements.glossaryCategoryFilter) return;

  const currentSelected = state.glossaryCategoryFilter || 'all';

  elements.glossaryCategoryFilter.innerHTML = `
    <option value="all">All Categories</option>
    ${CANONICAL_CATEGORIES.map(cat => `
      <option value="${cat}">${cat}</option>
    `).join('')}
  `;

  elements.glossaryCategoryFilter.value = currentSelected;
}

function closeGlossary() {
  const modal = elements.modalGlossary || elements.glossaryDrawer;
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  if (elements.charEditPanel) elements.charEditPanel.style.display = 'none';
  if (elements.wikiScraperPanel) elements.wikiScraperPanel.style.display = 'none';
}

async function openGlossary() {
  const modal = elements.modalGlossary || elements.glossaryDrawer;
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
    if (elements.readerSearchDrawer) {
      elements.readerSearchDrawer.classList.remove('open');
    }
    // If chapters haven't loaded into memory yet, fetch them first so mention counts work
    if (!state.chapters || state.chapters.length === 0) {
      await loadChapters(state.activeBookId);
    }
    renderGlossary();
    setTimeout(() => {
      if (elements.glossarySearch) elements.glossarySearch.focus();
    }, 150);
  }
}

function toggleGlossary() {
  const modal = elements.modalGlossary || elements.glossaryDrawer;
  if (modal) {
    if (modal.style.display === 'flex' || modal.classList.contains('open')) {
      closeGlossary();
    } else {
      openGlossary();
    }
  }
}

// --- GLOSSARY MODAL & WIKI SCRAPER ---
function renderGlossary(filterText = null) {
  if (!elements.glossaryListContainer) return;
  if (filterText !== null) {
    state.glossarySearchQuery = filterText;
  }
  const q = (state.glossarySearchQuery || '').toLowerCase().trim();

  // Show or hide clear button
  if (elements.btnClearGlossarySearch) {
    elements.btnClearGlossarySearch.style.display = q ? 'block' : 'none';
  }

  // Update total badge in header
  if (elements.glossaryTotalBadge) {
    elements.glossaryTotalBadge.textContent = state.glossary.length;
  }

  // Update category filter dropdown (Item 3: no counts next to categories)
  updateGlossaryCategoryDropdown();

  // Categories to render (Item 4: when filtered according to category, only those rows remain)
  const activeCatFilter = state.glossaryCategoryFilter || 'all';
  const categoriesToRender = CATEGORY_DISPLAY_CONFIG.filter(cfg => {
    if (activeCatFilter === 'all') return true;
    return cfg.key === activeCatFilter;
  });

  // Filter and sort entries by category
  const sortBy = state.glossarySortBy || 'relevance';
  let totalMatchingCount = 0;
  const categorizedMatches = {};

  categoriesToRender.forEach(cfg => {
    let items = state.glossary.filter((c, originalIndex) => {
      if (c._originalIndex === undefined) {
        c._originalIndex = originalIndex;
      }

      const cat = normalizeCategory(c.category);
      if (cat !== cfg.key) return false;

      if (q) {
        const inName = (c.name || '').toLowerCase().includes(q);
        const inCategory = cat.toLowerCase().includes(q);
        const inPinyin = (c.pinyin_or_chinese || '').toLowerCase().includes(q);
        const inAffiliation = ((c.affiliation || c.sect_or_affiliation) || '').toLowerCase().includes(q);
        const inSummary = (c.summary || '').toLowerCase().includes(q);
        const inAliases = (c.aliases || []).some(a => (a || '').toLowerCase().includes(q));
        if (!inName && !inCategory && !inPinyin && !inAffiliation && !inSummary && !inAliases) {
          return false;
        }
      }
      return true;
    });

    // Sort items within this category row
    items.sort((a, b) => {
      if (sortBy === 'relevance') {
        const countA = getGlossaryMentionCount(a);
        const countB = getGlossaryMentionCount(b);
        if (countB !== countA) {
          return countB - countA;
        }
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'time_newest') {
        return (b._originalIndex !== undefined ? b._originalIndex : 0) - (a._originalIndex !== undefined ? a._originalIndex : 0);
      } else if (sortBy === 'time_oldest') {
        return (a._originalIndex !== undefined ? a._originalIndex : 0) - (b._originalIndex !== undefined ? b._originalIndex : 0);
      } else if (sortBy === 'alpha') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    categorizedMatches[cfg.key] = items;
    totalMatchingCount += items.length;
  });

  // Update summary count label
  if (elements.glossaryCountLabel) {
    const catLabel = activeCatFilter !== 'all' ? ` in ${activeCatFilter}` : '';
    if (q) {
      elements.glossaryCountLabel.textContent = `Showing ${totalMatchingCount} matching entries${catLabel}`;
    } else if (activeCatFilter !== 'all') {
      elements.glossaryCountLabel.textContent = `Showing ${totalMatchingCount} of ${state.glossary.length} entries in ${activeCatFilter}`;
    } else {
      elements.glossaryCountLabel.textContent = `Showing all ${totalMatchingCount} entries across ${categoriesToRender.length} categories`;
    }
  }

  // Render container
  elements.glossaryListContainer.innerHTML = '';

  if (totalMatchingCount === 0) {
    elements.glossaryListContainer.innerHTML = `
      <div class="glossary-empty-state">
        <p style="margin-bottom: 6px;">No glossary entries found matching your filter.</p>
        ${(q || activeCatFilter !== 'all') ? `
          <button class="btn btn-secondary btn-sm" id="btn-reset-glossary-filter" style="margin-top: 8px;">
            Reset Filters
          </button>
        ` : `
          <button class="btn btn-green btn-sm" id="btn-empty-add-lore" style="margin-top: 8px;">
            + Add Lore Entry
          </button>
        `}
      </div>
    `;

    const resetBtn = elements.glossaryListContainer.querySelector('#btn-reset-glossary-filter');
    if (resetBtn) {
      resetBtn.onclick = () => {
        state.glossaryCategoryFilter = 'all';
        state.glossarySearchQuery = '';
        if (elements.glossaryCategoryFilter) elements.glossaryCategoryFilter.value = 'all';
        if (elements.glossarySearch) elements.glossarySearch.value = '';
        renderGlossary();
      };
    }
    const emptyAddBtn = elements.glossaryListContainer.querySelector('#btn-empty-add-lore');
    if (emptyAddBtn) {
      emptyAddBtn.onclick = () => openEditCharacterModal();
    }
    return;
  }

  // Render each category row with horizontal sideways scrolling (Item 4)
  categoriesToRender.forEach(cfg => {
    const items = categorizedMatches[cfg.key] || [];
    if (items.length === 0) return; // Hide empty category rows when searching or filtering

    const rowSection = document.createElement('div');
    rowSection.className = 'glossary-category-row';

    const rowHeader = document.createElement('div');
    rowHeader.className = 'glossary-category-row-header';
    rowHeader.innerHTML = `
      <div class="glossary-cat-title-wrap">
        <span class="glossary-cat-dot ${cfg.dotClass}"></span>
        <h3 class="glossary-cat-row-title">${escapeHtml(cfg.label)}</h3>
        <span class="glossary-cat-row-badge">${items.length}</span>
      </div>
      <div class="glossary-row-nav">
        <button type="button" class="glossary-row-scroll-btn btn-scroll-prev" title="Scroll left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button type="button" class="glossary-row-scroll-btn btn-scroll-next" title="Scroll right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;

    const track = document.createElement('div');
    track.className = 'glossary-row-track';

    // Hook up scroll buttons
    const prevBtn = rowHeader.querySelector('.btn-scroll-prev');
    const nextBtn = rowHeader.querySelector('.btn-scroll-next');
    prevBtn.onclick = () => track.scrollBy({ left: -340, behavior: 'smooth' });
    nextBtn.onclick = () => track.scrollBy({ left: 340, behavior: 'smooth' });

    // Render cards inside horizontal track
    items.forEach(char => {
      const normCat = normalizeCategory(char.category);
      const badgeClass = getCategoryBadgeClass(normCat);
      const boxClass = getCategoryBoxClass(normCat);
      const card = document.createElement('div');
      card.className = `glossary-card ${boxClass}`;

      let allAliases = Array.isArray(char.aliases) ? [...char.aliases] : [];
      if (isCurrentBookChinese() && char.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(char.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => (a || '').toLowerCase() === char.pinyin_or_chinese.toLowerCase())) {
        allAliases.push(char.pinyin_or_chinese);
      }

      const aliasesHtml = allAliases
        .map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`)
        .join('');

      const categoryBadge = `<span class="glossary-category-pill ${badgeClass}">${escapeHtml(normCat)}</span>`;

      const aff = char.affiliation || char.sect_or_affiliation || '';
      const mentions = getGlossaryMentionCount(char);

      card.innerHTML = `
        <div>
          <div class="glossary-card-top">
            <div class="glossary-card-title-group">
              <span class="glossary-char-name">${escapeHtml(char.name)}</span>
              <span class="glossary-mention-badge ${mentions > 0 ? 'has-mentions' : 'zero-mentions'}" title="${mentions} occurrences across chapters">
                ${mentions.toLocaleString()} ${mentions === 1 ? 'mention' : 'mentions'}
              </span>
            </div>
            ${categoryBadge}
          </div>
          ${aff ? `<div class="glossary-char-sect">${escapeHtml(aff)}</div>` : ''}
          ${aliasesHtml ? `<div class="glossary-char-aliases">${aliasesHtml}</div>` : ''}
          <div class="glossary-char-summary">${escapeHtml(char.summary || 'No summary')}</div>
        </div>
        <div class="glossary-card-btns">
          <button class="btn btn-secondary btn-sm btn-edit-char">Edit</button>
          <button class="btn btn-danger btn-sm btn-del-char" title="Delete entry">${ICONS.trash}</button>
        </div>
      `;

      card.querySelector('.btn-edit-char').onclick = () => openEditCharacterModal(char);
      card.querySelector('.btn-del-char').onclick = () => deleteCharacter(char.id || char.name);
      track.appendChild(card);
    });

    rowSection.appendChild(rowHeader);
    rowSection.appendChild(track);
    elements.glossaryListContainer.appendChild(rowSection);
  });
}

function openEditCharacterModal(char) {
  const modal = elements.modalGlossary || elements.glossaryDrawer;
  if (!modal || modal.style.display === 'none') {
    openGlossary();
  }
  
  elements.charEditPanel.style.display = 'block';
  elements.wikiScraperPanel.style.display = 'none';

  if (char) {
    elements.charFormHeading.textContent = 'Edit Entry';
    elements.charFormId.value = char.id || '';
    if (elements.charFormCategory) elements.charFormCategory.value = normalizeCategory(char.category);
    elements.charFormName.value = char.name || '';
    if (elements.charFormPinyin) elements.charFormPinyin.value = char.pinyin_or_chinese || '';
    let allAliases = Array.isArray(char.aliases) ? [...char.aliases] : (char.aliases ? [char.aliases] : []);
    if (isCurrentBookChinese() && char.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(char.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => a.toLowerCase() === char.pinyin_or_chinese.toLowerCase())) {
      allAliases.push(char.pinyin_or_chinese);
    }
    if (charAliasManager) {
      charAliasManager.setAliases(allAliases);
    } else if (elements.charFormAliases) {
      elements.charFormAliases.value = allAliases.join(', ');
    }
    elements.charFormSect.value = char.affiliation || char.sect_or_affiliation || '';
    elements.charFormSummary.value = char.summary || '';
  } else {
    elements.charFormHeading.textContent = 'Add Entry';
    elements.charFormId.value = '';
    if (elements.charFormCategory) elements.charFormCategory.value = 'Character';
    elements.charFormName.value = '';
    if (elements.charFormPinyin) elements.charFormPinyin.value = '';
    if (charAliasManager) {
      charAliasManager.setAliases([]);
    } else if (elements.charFormAliases) {
      elements.charFormAliases.value = '';
    }
    elements.charFormSect.value = '';
    elements.charFormSummary.value = '';
  }

  // Auto-scroll up to the edit form in the modal scroll area
  const scrollArea = elements.charEditPanel ? elements.charEditPanel.closest('.modal-glossary-scroll-area') : null;
  if (scrollArea) {
    scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (elements.charEditPanel) {
    elements.charEditPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Focus primary name field smoothly without jumping
  setTimeout(() => {
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (elements.charFormName) {
      elements.charFormName.focus({ preventScroll: true });
    }
  }, 60);
}

async function saveCharacterForm() {
  const name = elements.charFormName.value.trim();
  if (!name) {
    alert('Please enter a name.');
    return;
  }

  const sectVal = elements.charFormSect ? elements.charFormSect.value.trim() : '';
  const pinyinVal = elements.charFormPinyin ? elements.charFormPinyin.value.trim() : '';
  const aliases = charAliasManager ? charAliasManager.getAliases() : (elements.charFormAliases ? elements.charFormAliases.value.split(',').map(s => s.trim()).filter(Boolean) : []);

  const payload = {
    id: elements.charFormId.value || undefined,
    name: name,
    category: elements.charFormCategory ? elements.charFormCategory.value : 'Character',
    pinyin_or_chinese: pinyinVal,
    aliases: aliases,
    affiliation: sectVal,
    sect_or_affiliation: sectVal,
    summary: elements.charFormSummary.value.trim()
  };

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.glossary) {
        state.glossary = data.glossary;
        state._cachedNovelText = null;
        renderGlossary();
        if (elements.readerOverlay.style.display !== 'none' && state.activeChapter) {
          renderReaderContent(state.activeChapter.content);
        }
      } else {
        await loadGlossary(state.activeBookId);
      }
      showToast(`Saved "${name}"!`);
      elements.charEditPanel.style.display = 'none';
    }
  } catch (err) {
    console.error('Error saving entry:', err);
  }
}

async function deleteCharacter(charId) {
  if (!confirm('Are you sure you want to remove this entry from the glossary?')) return;
  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary/${encodeURIComponent(charId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('Entry removed from glossary.');
      await loadGlossary(state.activeBookId);
    }
  } catch (err) {
    console.error('Error deleting entry:', err);
  }
}

// --- INSTANT SINGLE-CHARACTER / ITEM AI AUTO-FILL ---
async function autoFillCharacterWithAI() {
  const name = elements.charFormName.value.trim();
  if (!name) {
    alert('Please enter a name (e.g. "Zidian" or "Madam Jin") first.');
    elements.charFormName.focus();
    return;
  }

  if (!elements.btnAiAutofillChar) return;
  const origHtml = elements.btnAiAutofillChar.innerHTML;
  elements.btnAiAutofillChar.disabled = true;
  elements.btnAiAutofillChar.textContent = 'Looking up...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/lookup-character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (res.ok && data.character) {
      const c = data.character;
      if (c.name) elements.charFormName.value = c.name;
      if (c.category && elements.charFormCategory) elements.charFormCategory.value = normalizeCategory(c.category);
      if (isCurrentBookChinese() && c.pinyin_or_chinese && elements.charFormPinyin && !elements.charFormPinyin.value.trim() && !['n/a', 'none', 'null'].includes(c.pinyin_or_chinese.toLowerCase().trim())) {
        elements.charFormPinyin.value = c.pinyin_or_chinese;
      }
      
      // Preserve and UNION existing form aliases so user manual additions are NEVER erased
      const currentAliases = charAliasManager
        ? charAliasManager.getAliases()
        : (elements.charFormAliases.value || '').split(',').map(s => s.trim()).filter(Boolean);
      const seenAliases = new Set(currentAliases.map(a => a.toLowerCase()));
      const primaryLower = (c.name || name).toLowerCase();

      let incomingAliases = Array.isArray(c.aliases) ? [...c.aliases] : [];
      if (isCurrentBookChinese() && c.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(c.pinyin_or_chinese.toLowerCase().trim())) {
        incomingAliases.push(c.pinyin_or_chinese);
      }

      for (const a of incomingAliases) {
        if (a && typeof a === 'string') {
          const aTrim = a.trim();
          const aLow = aTrim.toLowerCase();
          if (aLow !== primaryLower && !seenAliases.has(aLow)) {
            seenAliases.add(aLow);
            currentAliases.push(aTrim);
          }
        }
      }
      if (charAliasManager) {
        charAliasManager.setAliases(currentAliases);
      } else if (currentAliases.length > 0) {
        elements.charFormAliases.value = currentAliases.join(', ');
      }

      if (c.affiliation || c.sect_or_affiliation) {
        if (elements.charFormSect && !elements.charFormSect.value.trim()) {
          elements.charFormSect.value = c.affiliation || c.sect_or_affiliation;
        }
      }
      if (c.summary) {
        // If the user already wrote a summary, keep it; otherwise fill from AI
        if (elements.charFormSummary && !elements.charFormSummary.value.trim()) {
          elements.charFormSummary.value = c.summary;
        }
      }

      showToast(`Loaded details for "${c.name || name}"!`);
    } else {
      alert(data.error || 'Could not find details.');
    }
  } catch (err) {
    alert('Error fetching details: ' + err.message);
  } finally {
    elements.btnAiAutofillChar.disabled = false;
    elements.btnAiAutofillChar.innerHTML = origHtml;
  }
}

// --- WIKI / WEB IMPORT TRIGGER ---
async function runWikiScraper() {
  const input = elements.wikiUrlInput.value.trim();
  const book = state.books.find(b => b.id === state.activeBookId);
  const target = input || (book ? book.title : '');

  elements.btnRunWikiScrape.disabled = true;
  elements.btnRunWikiScrape.textContent = 'Importing...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/scrape-wiki`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wiki_url_or_title: target })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.characters && data.characters.length === 1) {
        const cName = data.characters[0].name || input;
        showToast(`Successfully added "${cName}" to your glossary!`);
      } else {
        showToast(`Successfully imported ${data.added_count} entries into your glossary!`);
      }
      elements.wikiScraperPanel.style.display = 'none';
      elements.wikiUrlInput.value = '';
      await loadGlossary(state.activeBookId);
    } else {
      alert(data.error || 'Failed to import lore guide.');
    }
  } catch (err) {
    alert('Error importing lore guide: ' + err.message);
  } finally {
    elements.btnRunWikiScrape.disabled = false;
    elements.btnRunWikiScrape.textContent = 'Import Entry';
  }
}

// --- UNIFIED IN-READER SEARCH & LORE ENGINE ---

function openSearchDrawer() {
  if (!elements.readerSearchDrawer) return;
  
  // Close the library glossary drawer if open
  if (elements.glossaryDrawer) {
    elements.glossaryDrawer.classList.remove('open');
  }

  // Update visibility of "This Chapter" pill based on whether reader overlay is open
  const isReaderOpen = elements.readerOverlay && elements.readerOverlay.style.display !== 'none';
  const thisChPill = document.querySelector('.search-scope-pill[data-scope="this_chapter"]');
  if (thisChPill) {
    thisChPill.style.display = isReaderOpen ? '' : 'none';
  }
  if (!isReaderOpen && state.searchScope === 'this_chapter') {
    state.searchScope = 'all';
    document.querySelectorAll('.search-scope-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.scope === 'all');
    });
  }

  const book = state.books.find(b => b.id === state.activeBookId);
  applyBookGlossaryState(book);
  
  elements.readerSearchDrawer.classList.add('open');
  if (elements.readerSearchInput) {
    elements.readerSearchInput.focus();
    elements.readerSearchInput.select();
  }

  const query = elements.readerSearchInput ? elements.readerSearchInput.value.trim() : '';
  if (query.length >= 2 || (state.searchScope === 'lore' && query.length === 0)) {
    triggerSearch(query, state.searchScope);
  }
}

function closeSearchDrawer() {
  if (!elements.readerSearchDrawer) return;
  elements.readerSearchDrawer.classList.remove('open');
  closeSearchLoreForm();
}

function toggleSearchDrawer() {
  if (!elements.readerSearchDrawer) return;
  if (elements.readerSearchDrawer.classList.contains('open')) {
    closeSearchDrawer();
  } else {
    openSearchDrawer();
  }
}

function triggerSearch(query, scope = 'all') {
  if (state.searchDebounceTimer) {
    clearTimeout(state.searchDebounceTimer);
  }

  state.searchQuery = query;
  state.searchScope = scope;

  // Toggle clear button
  if (elements.btnClearSearch) {
    elements.btnClearSearch.style.display = query ? 'block' : 'none';
  }

  if (query.length < 2 && scope !== 'lore') {
    if (elements.searchEmptyState) elements.searchEmptyState.style.display = 'block';
    if (elements.searchLoadingState) elements.searchLoadingState.style.display = 'none';
    if (elements.searchResultsList) {
      elements.searchResultsList.style.display = 'none';
      elements.searchResultsList.innerHTML = '';
    }
    state.lastSearchResults = null;
    updateScopeCountBadges(0, 0, 0, 0);
    return;
  }

  // Debounce API call
  state.searchDebounceTimer = setTimeout(() => {
    executeSearch(query, scope);
  }, 220);
}

async function executeSearch(query, scope) {
  if (!state.activeBookId) return;

  if (elements.searchEmptyState) elements.searchEmptyState.style.display = 'none';
  if (elements.searchLoadingState) elements.searchLoadingState.style.display = 'block';
  if (elements.searchResultsList) elements.searchResultsList.style.display = 'none';

  // Always fetch full results across the novel so badge counts stay stable and scope switching is instantaneous
  const url = `/api/books/${state.activeBookId}/search?q=${encodeURIComponent(query)}&scope=all`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const book = state.books.find(b => b.id === state.activeBookId);
    const enableGlossary = book ? (book.enable_glossary !== false) : true;

    if (!enableGlossary) {
      data.glossary_matches = [];
      data.total_lore_matches = 0;
      data.total_matches = data.total_chapter_matches || 0;
    }

    // Calculate this-chapter matches vs all
    const isReaderOpen = elements.readerOverlay && elements.readerOverlay.style.display !== 'none';
    const currentChNum = (isReaderOpen && state.activeChapter) ? state.activeChapter.chapter_number : null;

    let thisChCount = 0;
    if (currentChNum !== null && Array.isArray(data.chapter_matches)) {
      const match = data.chapter_matches.find(c => c.chapter_number === currentChNum);
      if (match) thisChCount = match.match_count || 0;
    }

    // Cache the full search results in state
    state.lastSearchResults = data;

    // Update all 4 badges stably without losing counts
    updateScopeCountBadges(
      data.total_matches || 0,
      thisChCount,
      data.total_chapter_matches || 0,
      data.total_lore_matches || 0
    );

    renderSearchResults(data, query, state.searchScope || scope);
  } catch (err) {
    console.error('Search error:', err);
    if (elements.searchLoadingState) elements.searchLoadingState.style.display = 'none';
    if (elements.searchResultsList) {
      elements.searchResultsList.style.display = 'block';
      elements.searchResultsList.innerHTML = `<div class="search-empty-state"><p>Error searching book: ${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function updateScopeCountBadges(allCount, thisChCount, allChCount, loreCount) {
  if (elements.countScopeAll) elements.countScopeAll.textContent = allCount;
  if (elements.countScopeThisChapter) elements.countScopeThisChapter.textContent = thisChCount;
  if (elements.countScopeAllChapters) elements.countScopeAllChapters.textContent = allChCount;
  if (elements.countScopeLore) elements.countScopeLore.textContent = loreCount;
}

function renderSearchResults(data, query, scope) {
  if (elements.searchLoadingState) elements.searchLoadingState.style.display = 'none';
  if (!elements.searchResultsList) return;

  elements.searchResultsList.style.display = 'block';
  elements.searchResultsList.innerHTML = '';

  const book = state.books.find(b => b.id === state.activeBookId);
  const enableGlossary = book ? (book.enable_glossary !== false) : true;

  const loreMatches = enableGlossary ? (data.glossary_matches || []) : [];
  const chapterMatches = data.chapter_matches || [];
  const isReaderOpen = elements.readerOverlay && elements.readerOverlay.style.display !== 'none';
  const currentChNum = (isReaderOpen && state.activeChapter) ? state.activeChapter.chapter_number : null;

  // Filter based on selected scope
  let displayLore = enableGlossary && (scope === 'all' || scope === 'lore');
  let displayChapters = (scope === 'all' || scope === 'all_chapters' || scope === 'this_chapter');

  let filteredChapters = chapterMatches;
  if (scope === 'this_chapter') {
    if (currentChNum !== null) {
      filteredChapters = chapterMatches.filter(c => c.chapter_number === currentChNum);
    } else {
      filteredChapters = [];
    }
  }

  const hasLore = displayLore && loreMatches.length > 0;
  const hasChapters = displayChapters && filteredChapters.length > 0;

  if (!hasLore && !hasChapters) {
    // Empty state
    let emptyMsg = '';
    if (scope === 'this_chapter') {
      if (currentChNum !== null) {
        emptyMsg = `<p>No matches found for <strong>"${escapeHtml(query)}"</strong> in Chapter ${currentChNum}.</p>`;
        if (data.total_chapter_matches > 0) {
          emptyMsg += `<button type="button" class="btn btn-secondary btn-sm" id="btn-switch-all-ch" style="margin-top: 10px;">View ${data.total_chapter_matches} matches across all chapters</button>`;
        }
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
          <div class="search-prompt-add-lore" style="margin-top: 14px;">
            <span>Add to Lore Glossary?</span>
            <button class="btn btn-green btn-sm" id="btn-quick-add-searched-lore">+ Add "${escapeHtml(query)}"</button>
          </div>
        ` : ''}
      </div>
    `;
    elements.searchResultsList.innerHTML = emptyHtml;

    const btnSwitchAll = document.getElementById('btn-switch-all-ch');
    if (btnSwitchAll) {
      btnSwitchAll.addEventListener('click', () => {
        const allChPill = document.querySelector('.search-scope-pill[data-scope="all_chapters"]');
        if (allChPill) allChPill.click();
      });
    }

    const btnQuickAdd = document.getElementById('btn-quick-add-searched-lore');
    if (btnQuickAdd) {
      btnQuickAdd.addEventListener('click', () => {
        openSearchLoreForm(query);
      });
    }
    return;
  }

  // 1. Render Lore Matches (Collapsible accordion: collapsed by default, reveals cards on click)
  if (displayLore && loreMatches.length > 0) {
    const loreSection = document.createElement('div');
    loreSection.className = 'search-lore-section';
    loreSection.innerHTML = `
      <button type="button" class="search-lore-collapse-btn" id="btn-toggle-lore-collapse" aria-expanded="false">
        <div class="search-lore-collapse-left">
          <svg class="search-lore-collapse-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span class="search-lore-collapse-title">Lore Glossary Entries</span>
          <span class="search-lore-collapse-badge">${loreMatches.length}</span>
        </div>
        <span class="search-lore-collapse-action">Click to expand</span>
      </button>
      <div class="search-lore-collapsible-content" id="search-lore-collapsible-content" style="display: none;"></div>
    `;

    const collapseBtn = loreSection.querySelector('#btn-toggle-lore-collapse');
    const collapseContent = loreSection.querySelector('#search-lore-collapsible-content');
    const actionText = loreSection.querySelector('.search-lore-collapse-action');

    collapseBtn.addEventListener('click', () => {
      const isOpen = collapseBtn.classList.toggle('is-open');
      collapseContent.style.display = isOpen ? 'block' : 'none';
      collapseBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      actionText.textContent = isOpen ? 'Click to collapse' : 'Click to expand';
    });

    loreMatches.forEach(item => {
      const normCat = normalizeCategory(item.category);
      const badgeClass = getCategoryBadgeClass(normCat);
      const boxClass = getCategoryBoxClass(normCat);
      const card = document.createElement('div');
      card.className = `search-lore-card ${boxClass}`;
      const aff = item.affiliation || item.sect_or_affiliation || '';
      let allAliases = Array.isArray(item.aliases) ? [...item.aliases] : [];
      if (isCurrentBookChinese() && item.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(item.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => a.toLowerCase() === item.pinyin_or_chinese.toLowerCase())) {
        allAliases.push(item.pinyin_or_chinese);
      }
      card.innerHTML = `
        <div class="search-lore-header">
          <div>
            <span class="search-lore-name">${escapeHtml(item.name || '')}</span>
          </div>
          <span class="search-lore-cat ${badgeClass}">${escapeHtml(normCat)}</span>
        </div>
        ${aff ? `<div class="search-lore-sect">${escapeHtml(aff)}</div>` : ''}
        ${allAliases.length > 0 ? `
          <div class="search-lore-aliases">
            <span style="opacity: 0.8;">Aliases:</span> ${escapeHtml(allAliases.join(', '))}
            ${item.matched_alias ? `<span style="color: var(--color-gold); font-weight: 600;"> (Matched: "${escapeHtml(item.matched_alias)}")</span>` : ''}
          </div>
        ` : ''}
        ${item.summary ? `<div class="search-lore-summary">${escapeHtml(item.summary)}</div>` : ''}
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button class="btn btn-secondary btn-sm btn-edit-lore-item" data-char-id="${item.id}" style="font-size: 0.76rem; padding: 2px 8px;">Edit Entry</button>
        </div>
      `;

      const btnEdit = card.querySelector('.btn-edit-lore-item');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          openSearchLoreForm('', item);
        });
      }

      collapseContent.appendChild(card);
    });

    elements.searchResultsList.appendChild(loreSection);
  }

  // 2. Render Chapter Occurrences
  if (displayChapters && filteredChapters.length > 0) {
    const chaptersSection = document.createElement('div');
    chaptersSection.className = 'search-chapters-section';
    const totalSnippets = filteredChapters.reduce((acc, c) => acc + (c.match_count || 0), 0);
    
    chaptersSection.innerHTML = `
      <div class="search-section-header" style="margin-top: ${hasLore ? '14px' : '0'};">
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

    elements.searchResultsList.appendChild(chaptersSection);
  }
}

async function jumpToSearchMatch(chapterNumber, paragraphIndex) {
  const isReaderOpen = elements.readerOverlay && elements.readerOverlay.style.display !== 'none';
  if (!isReaderOpen || !state.activeChapter || state.activeChapter.chapter_number !== chapterNumber) {
    showToast(`Loading Chapter ${chapterNumber}...`);
    await openReader(chapterNumber);
    setTimeout(() => {
      locateAndHighlightParagraph(paragraphIndex);
    }, 320);
  } else {
    locateAndHighlightParagraph(paragraphIndex);
  }
}

function locateAndHighlightParagraph(paragraphIndex) {
  if (!elements.readerContentBody) return;

  const targetP = elements.readerContentBody.querySelector(`p[data-p-idx="${paragraphIndex}"]`) ||
                  elements.readerContentBody.querySelectorAll('p')[paragraphIndex];

  if (targetP) {
    targetP.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetP.classList.remove('search-target-paragraph');
    void targetP.offsetWidth; // force DOM reflow
    targetP.classList.add('search-target-paragraph');
  }
}

// Quick Add / Edit Lore Form inside Search Drawer
function openSearchLoreForm(initialName = '', editCharData = null) {
  if (!elements.searchAddLorePanel) return;

  elements.searchAddLorePanel.style.display = 'block';

  if (editCharData) {
    if (elements.searchLoreFormHeading) elements.searchLoreFormHeading.textContent = 'Edit Lore Entry';
    if (elements.searchLoreId) elements.searchLoreId.value = editCharData.id || '';
    if (elements.searchLoreCategory) elements.searchLoreCategory.value = normalizeCategory(editCharData.category);
    if (elements.searchLoreName) elements.searchLoreName.value = editCharData.name || '';
    if (elements.searchLorePinyin) elements.searchLorePinyin.value = editCharData.pinyin_or_chinese || '';
    let allAliases = Array.isArray(editCharData.aliases) ? [...editCharData.aliases] : (editCharData.aliases ? [editCharData.aliases] : []);
    if (isCurrentBookChinese() && editCharData.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(editCharData.pinyin_or_chinese.toLowerCase().trim()) && !allAliases.some(a => a.toLowerCase() === editCharData.pinyin_or_chinese.toLowerCase())) {
      allAliases.push(editCharData.pinyin_or_chinese);
    }
    if (searchLoreAliasManager) {
      searchLoreAliasManager.setAliases(allAliases);
    } else if (elements.searchLoreAliases) {
      elements.searchLoreAliases.value = allAliases.join(', ');
    }
    if (elements.searchLoreSect) elements.searchLoreSect.value = editCharData.affiliation || editCharData.sect_or_affiliation || '';
    if (elements.searchLoreSummary) elements.searchLoreSummary.value = editCharData.summary || '';
  } else {
    if (elements.searchLoreFormHeading) elements.searchLoreFormHeading.textContent = 'Add Lore Entry';
    if (elements.searchLoreId) elements.searchLoreId.value = '';
    if (elements.searchLoreCategory) elements.searchLoreCategory.value = 'Character';
    if (elements.searchLoreName) elements.searchLoreName.value = initialName || '';
    if (elements.searchLorePinyin) elements.searchLorePinyin.value = '';
    if (searchLoreAliasManager) {
      searchLoreAliasManager.setAliases([]);
    } else if (elements.searchLoreAliases) {
      elements.searchLoreAliases.value = '';
    }
    if (elements.searchLoreSect) elements.searchLoreSect.value = '';
    if (elements.searchLoreSummary) elements.searchLoreSummary.value = '';
  }

  if (elements.searchAddLorePanel) {
    elements.searchAddLorePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setTimeout(() => {
    if (elements.searchLoreName) elements.searchLoreName.focus();
  }, 100);
}

function closeSearchLoreForm() {
  if (elements.searchAddLorePanel) {
    elements.searchAddLorePanel.style.display = 'none';
  }
}

async function saveSearchLoreForm() {
  const name = elements.searchLoreName ? elements.searchLoreName.value.trim() : '';
  if (!name) {
    alert('Please enter a name for the entry.');
    if (elements.searchLoreName) elements.searchLoreName.focus();
    return;
  }

  const charId = elements.searchLoreId ? elements.searchLoreId.value.trim() : '';
  const category = elements.searchLoreCategory ? elements.searchLoreCategory.value : 'Character';
  const pinyin = elements.searchLorePinyin ? elements.searchLorePinyin.value.trim() : '';
  const aliases = searchLoreAliasManager
    ? searchLoreAliasManager.getAliases()
    : ((elements.searchLoreAliases ? elements.searchLoreAliases.value.trim() : '')
        .split(',').map(s => s.trim()).filter(Boolean));
  const sect = elements.searchLoreSect ? elements.searchLoreSect.value.trim() : '';
  const summary = elements.searchLoreSummary ? elements.searchLoreSummary.value.trim() : '';

  const payload = {
    id: charId || undefined,
    name: name,
    category: category,
    pinyin_or_chinese: pinyin,
    aliases: aliases,
    affiliation: sect,
    sect_or_affiliation: sect,
    summary: summary
  };

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.glossary) {
        state.glossary = data.glossary;
        state._cachedNovelText = null;
        renderGlossary();
      } else {
        await loadGlossary(state.activeBookId);
      }
      showToast(`Saved "${name}" to glossary!`);
      closeSearchLoreForm();
      if (state.activeChapter) {
        renderReaderContent(state.activeChapter.content);
      }
      // Re-trigger search to update lore results
      const q = elements.readerSearchInput ? elements.readerSearchInput.value.trim() : '';
      executeSearch(q, state.searchScope);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save lore entry.');
    }
  } catch (err) {
    console.error('Error saving lore entry:', err);
    alert('Error saving lore entry: ' + err.message);
  }
}

async function autoFillSearchLoreWithAI() {
  const name = elements.searchLoreName ? elements.searchLoreName.value.trim() : '';
  if (!name) {
    alert('Please enter a name first.');
    if (elements.searchLoreName) elements.searchLoreName.focus();
    return;
  }

  if (!elements.btnAiAutofillSearchLore) return;
  const origHtml = elements.btnAiAutofillSearchLore.innerHTML;
  elements.btnAiAutofillSearchLore.disabled = true;
  elements.btnAiAutofillSearchLore.textContent = 'Looking up...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/lookup-character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (res.ok && data.character) {
      const c = data.character;
      if (c.name && elements.searchLoreName) elements.searchLoreName.value = c.name;
      if (c.category && elements.searchLoreCategory) elements.searchLoreCategory.value = normalizeCategory(c.category);
      if (isCurrentBookChinese() && c.pinyin_or_chinese && elements.searchLorePinyin && !elements.searchLorePinyin.value.trim() && !['n/a', 'none', 'null'].includes(c.pinyin_or_chinese.toLowerCase().trim())) {
        elements.searchLorePinyin.value = c.pinyin_or_chinese;
      }
      
      // Preserve and UNION existing form aliases so user manual additions are NEVER erased
      const currentAliases = searchLoreAliasManager
        ? searchLoreAliasManager.getAliases()
        : (elements.searchLoreAliases ? elements.searchLoreAliases.value : '').split(',').map(s => s.trim()).filter(Boolean);
      const seenAliases = new Set(currentAliases.map(a => a.toLowerCase()));
      const primaryLower = (c.name || name).toLowerCase();

      let incomingAliases = Array.isArray(c.aliases) ? [...c.aliases] : [];
      if (isCurrentBookChinese() && c.pinyin_or_chinese && !['n/a', 'none', 'null'].includes(c.pinyin_or_chinese.toLowerCase().trim())) {
        incomingAliases.push(c.pinyin_or_chinese);
      }

      for (const a of incomingAliases) {
        if (a && typeof a === 'string') {
          const aTrim = a.trim();
          const aLow = aTrim.toLowerCase();
          if (aLow !== primaryLower && !seenAliases.has(aLow)) {
            seenAliases.add(aLow);
            currentAliases.push(aTrim);
          }
        }
      }
      if (searchLoreAliasManager) {
        searchLoreAliasManager.setAliases(currentAliases);
      } else if (elements.searchLoreAliases && currentAliases.length > 0) {
        elements.searchLoreAliases.value = currentAliases.join(', ');
      }

      if ((c.affiliation || c.sect_or_affiliation) && elements.searchLoreSect) {
        if (!elements.searchLoreSect.value.trim()) {
          elements.searchLoreSect.value = c.affiliation || c.sect_or_affiliation;
        }
      }
      if (c.summary && elements.searchLoreSummary) {
        if (!elements.searchLoreSummary.value.trim()) {
          elements.searchLoreSummary.value = c.summary;
        }
      }

      showToast(`Loaded details for "${c.name || name}"!`);
    } else {
      alert(data.error || 'Could not find details.');
    }
  } catch (err) {
    alert('Error fetching details: ' + err.message);
  } finally {
    elements.btnAiAutofillSearchLore.disabled = false;
    elements.btnAiAutofillSearchLore.innerHTML = origHtml;
  }
}

// --- CHAPTER WRITE LOGIC ---
function openWriteChapterModal() {
  const nextNum = (state.chapters.length > 0) 
    ? Math.max(...state.chapters.map(c => c.chapter_number)) + 1 
    : 1;
    
  elements.writeChNum.value = nextNum;
  elements.writeChTitle.value = '';
  elements.writeChContent.innerHTML = '';
  elements.writeAutoScan.checked = true;
  elements.modalWrite.style.display = 'flex';
  elements.writeChContent.focus();
}

async function openEditChapterModal(chNum) {
  try {
    const res = await fetch(`/api/books/${state.activeBookId}/chapters/${chNum}`);
    if (!res.ok) return;
    const ch = await res.json();
    
    elements.writeChNum.value = ch.chapter_number;
    elements.writeChTitle.value = ch.title;
    elements.writeChContent.innerHTML = ch.content;
    elements.writeAutoScan.checked = false; // Unticked by default when editing existing chapters
    elements.modalWrite.style.display = 'flex';
  } catch (err) {
    console.error('Error opening edit modal:', err);
  }
}

async function updateBookCounters() {
  try {
    const res = await fetch('/api/books');
    state.books = await res.json();
    renderBooksList();
    const currBook = state.books.find(b => b.id === state.activeBookId);
    if (currBook) {
      if (elements.badgeGenre) elements.badgeGenre.textContent = (currBook.genre || 'Web Novel').toUpperCase();
      if (elements.badgeChapters) elements.badgeChapters.textContent = `${currBook.chapters_count || 0} CHAPTERS`;
      if (elements.badgeWords) elements.badgeWords.textContent = `${Number(currBook.total_words || 0).toLocaleString()} WORDS`;
    }
  } catch (err) {
    console.error('Error updating book counters:', err);
  }
}

async function saveWrittenChapter() {
  const chNum = parseInt(elements.writeChNum.value, 10);
  const title = elements.writeChTitle.value.trim() || `Chapter ${chNum}`;
  const content = sanitizeChapterHtml(elements.writeChContent.innerHTML.trim());
  const autoScan = elements.writeAutoScan.checked;

  if (!content) {
    alert('Please write or paste some chapter content.');
    return;
  }

  elements.btnSaveWrite.disabled = true;
  elements.saveWriteBtnText.textContent = autoScan ? 'Saving & Scanning with Gemini...' : 'Saving Chapter...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter_number: chNum,
        title: title,
        content: content,
        auto_scan: autoScan
      })
    });
    const data = await res.json();
    if (res.ok) {
      elements.modalWrite.style.display = 'none';
      if (data.new_characters && data.new_characters.length > 0) {
        showToast(`Chapter saved! Detected ${data.new_characters.length} new characters: ${data.new_characters.join(', ')}`);
      } else {
        showToast(`Chapter ${chNum} saved successfully!`);
      }
      await Promise.all([loadChapters(state.activeBookId), loadGlossary(state.activeBookId)]);
      
      // Preserve pagination position: keep user on the page containing chNum
      const chIndex = state.chapters.findIndex(c => c.chapter_number === chNum);
      if (chIndex !== -1 && !state.seeAll) {
        state.managePage = Math.floor(chIndex / state.managePageSize) + 1;
        renderChapters();
      }

      // Update book chapter counters without resetting active book or page
      await updateBookCounters();
    } else {
      alert(data.error || 'Failed to save chapter.');
    }
  } catch (err) {
    alert('Error saving chapter: ' + err.message);
  } finally {
    elements.btnSaveWrite.disabled = false;
    elements.saveWriteBtnText.textContent = 'Save Chapter';
  }
}

// --- BOOK MORE OPTIONS MENU (3-Dot Menu) ---
function toggleBookMoreMenu(e) {
  if (e) e.stopPropagation();
  if (!elements.bookMoreDropdown) return;
  const isHidden = elements.bookMoreDropdown.style.display === 'none' || !elements.bookMoreDropdown.style.display;
  if (isHidden) {
    elements.bookMoreDropdown.style.display = 'flex';
    elements.btnBookMoreOptions?.setAttribute('aria-expanded', 'true');
  } else {
    closeBookMoreMenu();
  }
}

function closeBookMoreMenu() {
  if (elements.bookMoreDropdown) {
    elements.bookMoreDropdown.style.display = 'none';
    elements.btnBookMoreOptions?.setAttribute('aria-expanded', 'false');
  }
}

// --- BOOK EDIT DETAILS (Item 1) ---
function openEditBookModal(targetBookId, options = {}) {
  const isFromHome = options.fromHome || state.currentView === 'home';
  const bookId = targetBookId || state.activeBookId;
  state.editingBookId = bookId;
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  elements.editBookTitle.value = book.title;
  elements.editBookAuthor.value = book.author;
  elements.editBookGenre.value = book.genre || '';
  
  const radio = document.querySelector(`input[name="edit-book-color"][value="${book.color}"]`);
  if (radio) radio.checked = true;

  if (elements.editBookGlossaryToggle) {
    elements.editBookGlossaryToggle.checked = (book.enable_glossary !== false);
  }
  
  if (elements.editBookGlossaryToggleGroup) {
    elements.editBookGlossaryToggleGroup.style.display = isFromHome ? 'none' : 'block';
  }
  
  elements.modalEditBook.style.display = 'flex';
  elements.editBookTitle.focus();
}

async function saveEditBook() {
  const targetId = state.editingBookId || state.activeBookId;
  const book = state.books.find(b => b.id === targetId);
  if (!book) return;
  
  const title = elements.editBookTitle.value.trim();
  if (!title) {
    alert('Please provide a book title.');
    return;
  }
  const author = elements.editBookAuthor.value.trim() || 'Unknown Author';
  const genre = elements.editBookGenre.value.trim() || 'Web Novel';
  const selectedColor = document.querySelector('input[name="edit-book-color"]:checked')?.value || book.color || '#ba6d78';
  const isToggleVisible = elements.editBookGlossaryToggleGroup && elements.editBookGlossaryToggleGroup.style.display !== 'none';
  const enableGlossary = isToggleVisible
    ? (elements.editBookGlossaryToggle ? elements.editBookGlossaryToggle.checked : true)
    : (book.enable_glossary !== false);
  
  try {
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        author,
        genre,
        color: selectedColor,
        enable_glossary: enableGlossary
      })
    });
    if (res.ok) {
      const updated = await res.json();
      Object.assign(book, updated);
      elements.modalEditBook.style.display = 'none';
      renderBooksList();
      renderHomeBooksGrid();
      if (state.activeBookId === book.id) {
        applyBookGlossaryState(book);
        await loadGlossary(book.id);
        elements.displayBookTitle.textContent = book.title;
        elements.displayBookAuthor.textContent = `by ${book.author}`;
        elements.badgeGenre.textContent = (book.genre || 'Web Novel').toUpperCase();
      }
      showToast('Book details updated.');
    } else {
      alert('Failed to update book details.');
    }
  } catch (err) {
    alert('Error updating book: ' + err.message);
  }
}

// --- LINK LORE GLOSSARY (SHARED SERIES GLOSSARY) ---
async function openLinkGlossaryModal() {
  if (!state.activeBookId) return;
  elements.modalLinkGlossary.style.display = 'flex';
  elements.linkCurrentStatusBox.innerHTML = '<div style="color: var(--text-muted);">Loading link details...</div>';
  elements.linkBooksList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Loading books...</div>';
  elements.btnUnlinkGlossary.style.display = 'none';
  elements.btnSaveLinkGlossary.disabled = true;

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary-link`);
    if (!res.ok) throw new Error('Failed to load glossary link info');
    const data = await res.json();

    const curr = data.current_book;
    const linkedTitles = (data.linked_books || []).filter(b => b.id !== curr.id).map(b => b.title);

    if (data.is_shared && linkedTitles.length > 0) {
      elements.linkCurrentStatusBox.innerHTML = `
        <div><strong>Status:</strong> Currently sharing lore with <strong>${escapeHtml(linkedTitles.join(', '))}</strong>.</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Total shared lore: ${curr.glossary_count} entries. Any changes will stay synchronized across all these books.</div>
      `;
      elements.btnUnlinkGlossary.style.display = 'block';
    } else {
      elements.linkCurrentStatusBox.innerHTML = `
        <div><strong>Status:</strong> Independent lore glossary (${curr.glossary_count} entries).</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Select one or more series books below to combine and synchronize their lore.</div>
      `;
      elements.btnUnlinkGlossary.style.display = 'none';
    }

    if (!data.all_other_books || data.all_other_books.length === 0) {
      elements.linkBooksList.innerHTML = `
        <div class="link-books-empty">No other books in your library yet. Import or add another book to link lore glossaries.</div>
      `;
      elements.btnSaveLinkGlossary.disabled = true;
      return;
    }

    function updateLinkGlossarySelectionState() {
      const checkedBoxes = Array.from(elements.linkBooksList.querySelectorAll('.link-book-checkbox:checked'));
      const checkedClusters = new Set(checkedBoxes.map(cb => cb.dataset.cluster));

      const allItems = elements.linkBooksList.querySelectorAll('.link-book-item');
      allItems.forEach(itemEl => {
        const cb = itemEl.querySelector('.link-book-checkbox');
        const subEl = itemEl.querySelector('.link-book-sub');
        const isPermDisabled = itemEl.dataset.permDisabled === 'true';

        if (isPermDisabled) {
          cb.disabled = true;
          itemEl.classList.add('item-disabled');
          if (subEl) subEl.innerHTML = itemEl.dataset.defaultSub;
          itemEl.title = itemEl.dataset.defaultTitle || '';
          return;
        }

        if (checkedClusters.size === 0) {
          cb.disabled = false;
          itemEl.classList.remove('item-disabled');
          if (subEl) subEl.innerHTML = itemEl.dataset.defaultSub;
          itemEl.title = itemEl.dataset.defaultTitle || '';
        } else {
          const itemCluster = itemEl.dataset.cluster;
          if (checkedClusters.has(itemCluster)) {
            cb.disabled = false;
            itemEl.classList.remove('item-disabled');
            if (subEl) subEl.innerHTML = itemEl.dataset.defaultSub;
            itemEl.title = itemEl.dataset.defaultTitle || '';
          } else {
            cb.disabled = true;
            cb.checked = false;
            itemEl.classList.remove('selected');
            itemEl.classList.add('item-disabled');
            if (subEl) {
              subEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">Only one glossary can be linked at a time</span>`;
            }
            itemEl.title = 'Only one glossary can be linked at a time. Deselect the currently selected glossary first to link with this book.';
          }
        }
      });
    }

    elements.btnSaveLinkGlossary.disabled = false;
    elements.linkBooksList.innerHTML = '';
    data.all_other_books.forEach(b => {
      const item = document.createElement('label');
      const isPermDisabled = (!b.is_linked && b.can_link === false);
      const clusterId = b.shared_glossary_id ? ('shared:' + b.shared_glossary_id) : ('book:' + b.id);
      const entryCount = b.glossary_count || 0;
      const countPill = `<span class="link-book-badge">${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}</span>`;
      
      let defaultSubNotice = `${escapeHtml(b.author || 'Unknown')} • ${escapeHtml(b.genre || 'Novel')}`;
      let defaultTitle = '';
      if (isPermDisabled) {
        defaultSubNotice = `<span style="color: #a85850; font-weight: 500;">Cannot link: already has ${entryCount} lore entries</span>`;
        defaultTitle = 'Cannot link: books with existing lore entries cannot join an existing glossary. Only books with 0 entries can join.';
      }

      item.className = `link-book-item ${b.is_linked ? 'selected' : ''} ${isPermDisabled ? 'item-disabled' : ''}`;
      item.dataset.cluster = clusterId;
      item.dataset.permDisabled = isPermDisabled ? 'true' : 'false';
      item.dataset.defaultSub = defaultSubNotice;
      item.dataset.defaultTitle = defaultTitle;
      if (defaultTitle) item.title = defaultTitle;

      const isChecked = b.is_linked ? 'checked' : '';
      const disabledAttr = isPermDisabled ? 'disabled' : '';

      item.innerHTML = `
        <input type="checkbox" value="${b.id}" data-shared-id="${escapeHtml(b.shared_glossary_id || '')}" data-cluster="${clusterId}" class="link-book-checkbox" ${isChecked} ${disabledAttr}>
        <span class="color-dot" style="background:${b.color || '#ba6d78'}; width: 14px; height: 14px; flex-shrink: 0;"></span>
        <div class="link-book-info">
          <span class="link-book-title">${escapeHtml(b.title)}</span>
          <span class="link-book-sub">${defaultSubNotice}</span>
        </div>
        ${countPill}
      `;

      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        const isChecked = checkbox.checked;
        item.classList.toggle('selected', isChecked);

        // Requirement: When clicking a book that is part of a shared series, auto-tick/untick its sibling books
        const sharedId = checkbox.dataset.sharedId;
        if (sharedId) {
          const siblings = elements.linkBooksList.querySelectorAll(`.link-book-checkbox[data-shared-id="${sharedId}"]`);
          siblings.forEach(s => {
            if (s !== checkbox) {
              s.checked = isChecked;
              s.closest('.link-book-item')?.classList.toggle('selected', isChecked);
            }
          });
        }

        // Grey out books belonging to other glossaries
        updateLinkGlossarySelectionState();
      });

      elements.linkBooksList.appendChild(item);
    });

    // Apply selection state initially
    updateLinkGlossarySelectionState();


  } catch (err) {
    console.error('Error opening link glossary modal:', err);
    elements.linkCurrentStatusBox.innerHTML = `<div style="color: #c0392b;">Error loading link info: ${escapeHtml(err.message)}</div>`;
  }
}

async function saveGlossaryLinks() {
  if (!state.activeBookId) return;
  const checkboxes = elements.linkBooksList.querySelectorAll('.link-book-checkbox:checked');
  const selectedBookIds = Array.from(checkboxes).map(cb => cb.value);

  elements.btnSaveLinkGlossary.disabled = true;
  elements.btnSaveLinkGlossary.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_book_ids: selectedBookIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update lore links');

    elements.modalLinkGlossary.style.display = 'none';
    await loadBooks();
    await loadGlossary(state.activeBookId);
    renderGlossary();
    selectBook(state.activeBookId);
    showToast(selectedBookIds.length > 0
      ? `Linked lore glossary across ${data.linked_count || (selectedBookIds.length + 1)} books (${data.glossary_count} total entries)`
      : 'Glossary is now independent.'
    );
  } catch (err) {
    console.error('Error saving glossary links:', err);
    showToast(`Error linking glossaries: ${err.message}`);
  } finally {
    elements.btnSaveLinkGlossary.disabled = false;
    elements.btnSaveLinkGlossary.textContent = 'Save Links';
  }
}

async function unlinkCurrentGlossary() {
  if (!state.activeBookId) return;
  // Requirement 3: Confirmatory message showing changes after this will not be synched
  const confirmed = confirm('Are you sure you want to unlink this book from the series glossary?\n\nThis book will keep a standalone copy of all current lore entries, but any changes made after this will no longer be synchronized across the series.');
  if (!confirmed) {
    return;
  }

  elements.btnUnlinkGlossary.disabled = true;
  elements.btnUnlinkGlossary.textContent = 'Unlinking...';

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/glossary-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlink: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to unlink');

    elements.modalLinkGlossary.style.display = 'none';
    await loadBooks();
    await loadGlossary(state.activeBookId);
    renderGlossary();
    selectBook(state.activeBookId);
    showToast('This book now has its own independent lore glossary.');
  } catch (err) {
    console.error('Error unlinking glossary:', err);
    showToast(`Error: ${err.message}`);
  } finally {
    elements.btnUnlinkGlossary.disabled = false;
    elements.btnUnlinkGlossary.textContent = 'Unlink This Book';
  }
}


async function deleteChapter(chNum) {
  if (!confirm(`Are you sure you want to delete Chapter ${chNum}?`)) return;
  try {
    const res = await fetch(`/api/books/${state.activeBookId}/chapters/${chNum}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`Chapter ${chNum} deleted.`);
      await loadChapters(state.activeBookId);
      await updateBookCounters();
    }
  } catch (err) {
    console.error('Error deleting chapter:', err);
  }
}

async function autoArrangeChapters() {
  if (!state.activeBookId) return;
  const book = state.books.find(b => b.id === state.activeBookId);
  const bookTitle = book ? book.title : 'this book';

  const confirmed = confirm(
    `Auto-arrange chapters for "${bookTitle}"?\n\nAny gaps between chapter numbers will be closed sequentially (for example, chapters 1, 4, 6 will be renumbered to 1, 2, 3).`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/books/${state.activeBookId}/auto-arrange-chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to auto-arrange chapters');

    if (!data.changed) {
      showToast(data.message || 'Chapters are already sequentially numbered with no gaps.');
      return;
    }

    if (state.activeChapterNum && data.mapping && data.mapping[state.activeChapterNum]) {
      state.activeChapterNum = data.mapping[state.activeChapterNum];
    }

    await loadChapters(state.activeBookId);
    await loadBooks();
    selectBook(state.activeBookId);
    showToast(data.message || `Chapters arranged sequentially (1 to ${data.chapters_count}).`);
  } catch (err) {
    console.error('Error auto-arranging chapters:', err);
    showToast(`Error: ${err.message}`);
  }
}

// --- BOOK CREATION & DELETION ---

async function createNewBook() {
  const title = elements.newBookTitle.value.trim();
  if (!title) {
    alert('Please enter a book title.');
    return;
  }
  const author = elements.newBookAuthor.value.trim() || 'Unknown Author';
  const genre = elements.newBookGenre.value.trim() || 'Xianxia Danmei';
  const color = document.querySelector('input[name="book-color"]:checked')?.value || '#ba6d78';
  const enableGlossary = elements.newBookGlossaryToggle ? elements.newBookGlossaryToggle.checked : true;

  try {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, genre, color, enable_glossary: enableGlossary })
    });
    if (res.ok) {
      const book = await res.json();
      elements.modalNewBook.style.display = 'none';
      elements.newBookTitle.value = '';
      if (elements.newBookAuthor) elements.newBookAuthor.value = '';
      if (elements.newBookGenre) elements.newBookGenre.value = '';
      if (elements.newBookGlossaryToggle) elements.newBookGlossaryToggle.checked = true;
      showToast(`Book "${book.title}" created!`);
      localStorage.setItem('xianxia_last_book', book.id);
      localStorage.setItem('xianxia_current_view', 'book');
      await loadBooks();
      await selectBook(book.id);
      showBookView();
    }
  } catch (err) {
    console.error('Error creating book:', err);
  }
}

async function deleteCurrentBook() {
  const book = state.books.find(b => b.id === state.activeBookId);
  if (!book) return;
  if (!confirm(`Are you sure you want to delete "${book.title}" and all its chapters?`)) return;

  try {
    const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Book "${book.title}" deleted.`);
      showHomeView();
      await loadBooks();
    }
  } catch (err) {
    console.error('Error deleting book:', err);
  }
}

// --- EPUB IMPORT ENGINE ---
let selectedEpubFile = null;

function openImportEpubModal() {
  if (elements.modalNewBook) elements.modalNewBook.style.display = 'none';
  if (elements.modalImportEpub) {
    resetImportEpubModal();
    elements.modalImportEpub.style.display = 'flex';
  }
}

function closeImportEpubModal() {
  if (elements.modalImportEpub) {
    elements.modalImportEpub.style.display = 'none';
    resetImportEpubModal();
  }
}

function resetImportEpubModal() {
  selectedEpubFile = null;
  if (elements.epubFileInput) elements.epubFileInput.value = '';
  if (elements.dropzoneIdle) elements.dropzoneIdle.style.display = 'flex';
  if (elements.dropzoneSelected) elements.dropzoneSelected.style.display = 'none';
  if (elements.btnSubmitImportEpub) {
    elements.btnSubmitImportEpub.disabled = true;
    elements.btnSubmitImportEpub.style.opacity = '0.5';
    elements.btnSubmitImportEpub.innerHTML = '<span>Import Novel</span>';
  }
  if (elements.importProgressArea) elements.importProgressArea.style.display = 'none';
  if (elements.epubDropzone) elements.epubDropzone.classList.remove('dragover');
}

function handleEpubFileSelection(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.epub')) {
    alert('Please select a valid .epub file.');
    return;
  }
  selectedEpubFile = file;
  if (elements.selectedFileName) elements.selectedFileName.textContent = file.name;
  if (elements.selectedFileSize) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    elements.selectedFileSize.textContent = `${sizeMb} MB`;
  }
  if (elements.dropzoneIdle) elements.dropzoneIdle.style.display = 'none';
  if (elements.dropzoneSelected) elements.dropzoneSelected.style.display = 'flex';
  if (elements.btnSubmitImportEpub) {
    elements.btnSubmitImportEpub.disabled = false;
    elements.btnSubmitImportEpub.style.opacity = '1';
  }
}

async function submitImportEpub() {
  if (!selectedEpubFile) return;

  const formData = new FormData();
  formData.append('file', selectedEpubFile);
  formData.append('auto_detect_ai', elements.importAiDetectToggle ? elements.importAiDetectToggle.checked : true);
  formData.append('enable_glossary', elements.importGlossaryToggle ? elements.importGlossaryToggle.checked : true);

  if (elements.btnSubmitImportEpub) {
    elements.btnSubmitImportEpub.disabled = true;
    elements.btnSubmitImportEpub.style.opacity = '0.5';
    elements.btnSubmitImportEpub.innerHTML = '<span>Importing...</span>';
  }

  if (elements.importProgressArea) {
    elements.importProgressArea.style.display = 'flex';
    if (elements.importProgressStatus) {
      elements.importProgressStatus.textContent = 'Unpacking EPUB structure & analyzing chapters...';
    }
  }

  try {
    const res = await fetch('/api/books/import-epub', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to import EPUB');
    }

    showToast(`Successfully imported "${data.book.title}" (${data.chapters_count} chapters)!`);
    closeImportEpubModal();

    localStorage.setItem('xianxia_last_book', data.book.id);
    localStorage.setItem('xianxia_current_view', 'book');
    await loadBooks();
    await selectBook(data.book.id);
    showBookView();
  } catch (err) {
    alert('Import failed: ' + err.message);
    if (elements.btnSubmitImportEpub) {
      elements.btnSubmitImportEpub.disabled = false;
      elements.btnSubmitImportEpub.style.opacity = '1';
      elements.btnSubmitImportEpub.innerHTML = '<span>Import Novel</span>';
    }
    if (elements.importProgressArea) {
      elements.importProgressArea.style.display = 'none';
    }
  }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Rich Text Editor Toolbar (Screenshot 1)
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      document.execCommand(cmd, false, null);
      elements.writeChContent.focus();
    });
  });

  // Clean Paste handler for Content Editor
  elements.writeChContent.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      const clean = sanitizeChapterHtml(html);
      document.execCommand('insertHTML', false, clean);
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
  });

  // Mode Toggles (Manage / Edit Mode vs Read Only Mode)
  elements.btnViewCards.addEventListener('click', () => setAppMode('manage'));
  elements.btnViewTable.addEventListener('click', () => setAppMode('readonly'));

  // Modals Open/Close
  elements.btnStartBook.addEventListener('click', () => {
    elements.modalNewBook.style.display = 'flex';
    elements.newBookTitle.focus();
  });
  elements.btnCancelNewBook.addEventListener('click', () => elements.modalNewBook.style.display = 'none');
  elements.btnCreateNewBook.addEventListener('click', createNewBook);

  // EPUB Import Modal Listeners
  if (elements.btnOpenImportEpub) {
    elements.btnOpenImportEpub.addEventListener('click', openImportEpubModal);
  }
  if (elements.btnSwitchToImport) {
    elements.btnSwitchToImport.addEventListener('click', openImportEpubModal);
  }
  if (elements.btnCloseImportEpub) {
    elements.btnCloseImportEpub.addEventListener('click', closeImportEpubModal);
  }
  if (elements.btnCancelImportEpub) {
    elements.btnCancelImportEpub.addEventListener('click', closeImportEpubModal);
  }
  if (elements.btnSubmitImportEpub) {
    elements.btnSubmitImportEpub.addEventListener('click', submitImportEpub);
  }
  if (elements.btnRemoveEpubFile) {
    elements.btnRemoveEpubFile.addEventListener('click', (e) => {
      e.stopPropagation();
      resetImportEpubModal();
    });
  }
  if (elements.epubDropzone) {
    elements.epubDropzone.addEventListener('click', (e) => {
      if (e.target !== elements.btnRemoveEpubFile && !elements.btnRemoveEpubFile?.contains(e.target)) {
        elements.epubFileInput?.click();
      }
    });
    elements.epubDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.epubDropzone.classList.add('dragover');
    });
    elements.epubDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.epubDropzone.classList.remove('dragover');
    });
    elements.epubDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.epubDropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleEpubFileSelection(e.dataTransfer.files[0]);
      }
    });
  }
  if (elements.epubFileInput) {
    elements.epubFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleEpubFileSelection(e.target.files[0]);
      }
    });
  }

  // 3-Dot More Options Dropdown in Top Bar
  if (elements.btnBookMoreOptions) {
    elements.btnBookMoreOptions.addEventListener('click', toggleBookMoreMenu);
  }

  // Write Chapter Modals (Top & Bottom buttons)
  if (elements.btnTopWriteModal) {
    elements.btnTopWriteModal.addEventListener('click', openWriteChapterModal);
  }
  if (elements.btnBottomWriteModal) {
    elements.btnBottomWriteModal.addEventListener('click', openWriteChapterModal);
  }
  if (elements.btnOpenWriteModal && elements.btnOpenWriteModal !== elements.btnTopWriteModal && elements.btnOpenWriteModal !== elements.btnBottomWriteModal) {
    elements.btnOpenWriteModal.addEventListener('click', openWriteChapterModal);
  }
  elements.btnCancelWrite.addEventListener('click', () => elements.modalWrite.style.display = 'none');
  elements.btnSaveWrite.addEventListener('click', saveWrittenChapter);

  // Edit Book Modal Listeners (Inside 3-dot dropdown)
  if (elements.btnEditBook) {
    elements.btnEditBook.addEventListener('click', () => {
      closeBookMoreMenu();
      openEditBookModal();
    });
  }
  elements.btnCancelEditBook.addEventListener('click', () => elements.modalEditBook.style.display = 'none');
  elements.btnSaveEditBook.addEventListener('click', saveEditBook);

  if (elements.btnDeleteBook) {
    elements.btnDeleteBook.addEventListener('click', () => {
      closeBookMoreMenu();
      deleteCurrentBook();
    });
  }

  // Auto-Arrange Chapters (Inside 3-dot dropdown)
  if (elements.btnAutoArrangeChapters) {
    elements.btnAutoArrangeChapters.addEventListener('click', () => {
      closeBookMoreMenu();
      autoArrangeChapters();
    });
  }

  // Link Lore Glossary Modal Listeners (Inside 3-dot dropdown & header badge)

  if (elements.btnLinkGlossary) {
    elements.btnLinkGlossary.addEventListener('click', () => {
      closeBookMoreMenu();
      openLinkGlossaryModal();
    });
  }
  if (elements.badgeSharedGlossary) {
    elements.badgeSharedGlossary.addEventListener('click', () => {
      if (state.appMode === 'readonly') return;
      openLinkGlossaryModal();
    });
  }

  if (elements.btnCloseLinkGlossaryX) {
    elements.btnCloseLinkGlossaryX.addEventListener('click', () => {
      elements.modalLinkGlossary.style.display = 'none';
    });
  }
  if (elements.btnCancelLinkGlossary) {
    elements.btnCancelLinkGlossary.addEventListener('click', () => {
      elements.modalLinkGlossary.style.display = 'none';
    });
  }
  if (elements.btnSaveLinkGlossary) {
    elements.btnSaveLinkGlossary.addEventListener('click', saveGlossaryLinks);
  }
  if (elements.btnUnlinkGlossary) {
    elements.btnUnlinkGlossary.addEventListener('click', unlinkCurrentGlossary);
  }

  // Reader Controls (Screenshot 4)
  elements.btnReaderClose.addEventListener('click', () => {
    elements.readerOverlay.style.display = 'none';
    hideCharacterTooltip();
    hideSelectionPopup();
    closeSearchDrawer();
    if (elements.glossaryDrawer) elements.glossaryDrawer.classList.remove('open');
    localStorage.setItem('xianxia_reader_open', 'false');
  });

  // Hide lore card on scroll so it never floats detached
  elements.readerOverlay.addEventListener('scroll', () => {
    hideCharacterTooltip();
  }, { passive: true });

  elements.readerChapterSelect.addEventListener('change', (e) => {
    const selectedOpt = e.target.options[e.target.selectedIndex];
    if (selectedOpt) e.target.title = selectedOpt.textContent;
    openReader(parseInt(e.target.value, 10));
  });

  elements.btnPrevCh.addEventListener('click', () => {
    if (!state.activeChapter) return;
    const currentIndex = state.chapters.findIndex(c => c.chapter_number === state.activeChapter.chapter_number);
    if (currentIndex > 0) openReader(state.chapters[currentIndex - 1].chapter_number);
  });

  elements.btnNextCh.addEventListener('click', () => {
    if (!state.activeChapter) return;
    const currentIndex = state.chapters.findIndex(c => c.chapter_number === state.activeChapter.chapter_number);
    if (currentIndex < state.chapters.length - 1) openReader(state.chapters[currentIndex + 1].chapter_number);
  });

  elements.btnReaderBottomPrev.addEventListener('click', () => elements.btnPrevCh.click());
  elements.btnReaderBottomNext.addEventListener('click', () => elements.btnNextCh.click());

  // Bookmark double-click handler (single bookmark per book, works on text and in empty margins)
  function handleReaderDoubleClick(e) {
    if (!state.activeChapter || !state.activeBookId) return;
    if (e.target.closest('.reader-fidget-canvas') || e.target.closest('.reader-nav-bar') || e.target.closest('button') || e.target.closest('select')) return;

    const blocks = Array.from(elements.readerContentBody.querySelectorAll('.reader-line-block, p'));
    if (blocks.length === 0) return;

    let targetBlock = e.target.closest('.reader-line-block, p');

    // If user double-clicked in the empty space/margin to the right of the line
    if (!targetBlock) {
      const clientY = e.clientY;
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        if (clientY >= rect.top - 6 && clientY <= rect.bottom + 6) {
          targetBlock = block;
          break;
        }
      }
    }

    if (!targetBlock) return;

    // Clear browser text selection caused by double clicking
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    hideSelectionPopup();

    const pIndex = targetBlock.dataset.pIndex !== undefined 
      ? parseInt(targetBlock.dataset.pIndex, 10) 
      : blocks.indexOf(targetBlock);
    if (isNaN(pIndex) || pIndex < 0) return;

    const currentBookmark = getBookBookmark(state.activeBookId);
    const isAlreadyThis = currentBookmark && 
      currentBookmark.chapter_number === state.activeChapter.chapter_number && 
      currentBookmark.paragraph_index === pIndex;

    // Clear .bookmarked-line on all paragraphs
    blocks.forEach(el => el.classList.remove('bookmarked-line'));

    if (isAlreadyThis) {
      saveBookBookmark(state.activeBookId, null);
      showToast('Bookmark removed.');
    } else {
      targetBlock.classList.add('bookmarked-line');
      const newBookmark = {
        chapter_number: state.activeChapter.chapter_number,
        paragraph_index: pIndex
      };
      saveBookBookmark(state.activeBookId, newBookmark);
      showToast(`Bookmarked line in Chapter ${state.activeChapter.chapter_number}!`);
    }
  }

  elements.readerOverlay.addEventListener('dblclick', handleReaderDoubleClick);

  // Handle text selection in reader
  elements.readerOverlay.addEventListener('mouseup', (e) => {
    if (e.target.closest('#reader-selection-popup')) return;
    setTimeout(handleTextSelection, 10);
  });

  elements.readerOverlay.addEventListener('keyup', (e) => {
    if (e.target.closest('#reader-selection-popup')) return;
    setTimeout(handleTextSelection, 10);
  });

  elements.readerOverlay.addEventListener('scroll', () => {
    elements.charHoverCard.style.display = 'none';
    hideSelectionPopup();
  }, { passive: true });

  // Floating selection "Add to glossary" click handler
  if (elements.btnSelectionAddGlossary) {
    elements.btnSelectionAddGlossary.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!activeSelectedText || !state.activeBookId) return;

      elements.btnSelectionAddGlossary.className = 'btn-selection-glossary loading';
      elements.btnSelectionAddGlossary.disabled = true;
      elements.selectionBtnText.textContent = 'Checking...';

      try {
        const res = await fetch(`/api/books/${state.activeBookId}/lookup-character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: activeSelectedText, add: true })
        });
        const data = await res.json();

        if (res.ok && data.found && data.character) {
          elements.btnSelectionAddGlossary.className = 'btn-selection-glossary success';
          elements.selectionBtnText.textContent = 'Added!';

          if (data.already_existed) {
            showToast(`"${activeSelectedText}" is already in glossary under ${data.character.name}!`);
          } else if (data.merged_into && data.merged_into.toLowerCase() !== activeSelectedText.toLowerCase()) {
            showToast(`Added "${activeSelectedText}" to ${data.merged_into}'s aliases in glossary!`);
          } else {
            showToast(`Added "${data.character.name}" (${data.character.category || 'Entry'}) to glossary!`);
          }

          await loadGlossary(state.activeBookId);
          if (state.activeChapter) {
            renderReaderContent(state.activeChapter.content);
          }

          setTimeout(() => {
            hideSelectionPopup();
            if (window.getSelection) window.getSelection().removeAllRanges();
          }, 800);
        } else {
          elements.btnSelectionAddGlossary.className = 'btn-selection-glossary unavailable';
          elements.selectionBtnText.textContent = 'Unavailable';
          setTimeout(() => {
            hideSelectionPopup();
          }, 1400);
        }
      } catch (err) {
        elements.btnSelectionAddGlossary.className = 'btn-selection-glossary unavailable';
        elements.selectionBtnText.textContent = 'Unavailable';
        setTimeout(() => {
          hideSelectionPopup();
        }, 1400);
      }
    });
  }

  // Font & Theme
  elements.readerFontFamily.addEventListener('change', (e) => setFontFamily(e.target.value));
  elements.btnFontDec.addEventListener('click', () => setFontSize(state.fontSize - 1));
  elements.btnFontReset.addEventListener('click', () => setFontSize(18));
  elements.btnFontInc.addEventListener('click', () => setFontSize(state.fontSize + 1));

  document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // Glossary Modal Listeners
  if (elements.btnMainGlossary) {
    elements.btnMainGlossary.addEventListener('click', toggleGlossary);
  }
  if (elements.btnOpenGlossary && elements.btnOpenGlossary !== elements.btnOpenSearch) {
    elements.btnOpenGlossary.addEventListener('click', toggleGlossary);
  }
  if (elements.btnReaderGlossary) {
    elements.btnReaderGlossary.addEventListener('click', toggleGlossary);
  }
  if (elements.btnCloseGlossary) {
    elements.btnCloseGlossary.addEventListener('click', closeGlossary);
  }

  // Category Filter Dropdown Listener
  if (elements.glossaryCategoryFilter) {
    elements.glossaryCategoryFilter.addEventListener('change', (e) => {
      state.glossaryCategoryFilter = e.target.value;
      renderGlossary();
    });
  }

  // Glossary Search & Sort Listeners
  if (elements.glossarySearch) {
    elements.glossarySearch.addEventListener('input', (e) => {
      renderGlossary(e.target.value);
    });
  }
  if (elements.btnClearGlossarySearch) {
    elements.btnClearGlossarySearch.addEventListener('click', () => {
      if (elements.glossarySearch) elements.glossarySearch.value = '';
      renderGlossary('');
      if (elements.glossarySearch) elements.glossarySearch.focus();
    });
  }
  if (elements.glossarySortSelect) {
    elements.glossarySortSelect.addEventListener('change', (e) => {
      state.glossarySortBy = e.target.value;
      renderGlossary();
    });
  }

  // Search & Lore Drawer Listeners
  if (elements.btnOpenSearch) {
    elements.btnOpenSearch.addEventListener('click', toggleSearchDrawer);
  }
  if (elements.btnReaderSearch) {
    elements.btnReaderSearch.addEventListener('click', toggleSearchDrawer);
  }
  if (elements.btnCloseSearch) {
    elements.btnCloseSearch.addEventListener('click', closeSearchDrawer);
  }
  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      if (elements.readerSearchInput) elements.readerSearchInput.value = '';
      triggerSearch('', state.searchScope);
      if (elements.readerSearchInput) elements.readerSearchInput.focus();
    });
  }
  if (elements.readerSearchInput) {
    elements.readerSearchInput.addEventListener('input', (e) => {
      triggerSearch(e.target.value.trim(), state.searchScope);
    });
  }

  // Scope Filter Pills
  if (elements.searchScopePills) {
    elements.searchScopePills.addEventListener('click', (e) => {
      const pill = e.target.closest('.search-scope-pill');
      if (!pill) return;
      document.querySelectorAll('.search-scope-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const scope = pill.dataset.scope;
      state.searchScope = scope;
      const q = elements.readerSearchInput ? elements.readerSearchInput.value.trim() : '';

      // Instant client-side filter using cached results: preserves badge counts & zero-latency tab switch
      if (state.lastSearchResults) {
        renderSearchResults(state.lastSearchResults, q, scope);
      } else if (q.length >= 2 || (scope === 'lore' && q.length === 0)) {
        triggerSearch(q, scope);
      }
    });
  }

  // Quick Add Lore inside Search Drawer
  if (elements.btnSearchAddLore) {
    elements.btnSearchAddLore.addEventListener('click', () => {
      const currentQuery = elements.readerSearchInput ? elements.readerSearchInput.value.trim() : '';
      openSearchLoreForm(currentQuery);
    });
  }
  if (elements.btnCancelSearchLore) {
    elements.btnCancelSearchLore.addEventListener('click', closeSearchLoreForm);
  }
  if (elements.btnCloseSearchLoreForm) {
    elements.btnCloseSearchLoreForm.addEventListener('click', closeSearchLoreForm);
  }
  if (elements.btnSaveSearchLore) {
    elements.btnSaveSearchLore.addEventListener('click', saveSearchLoreForm);
  }
  if (elements.btnAiAutofillSearchLore) {
    elements.btnAiAutofillSearchLore.addEventListener('click', autoFillSearchLoreWithAI);
  }

  // Initialize interactive alias tag managers
  if (elements.charAliasContainer && elements.charAliasList && elements.charFormAliases) {
    charAliasManager = createAliasTagManager({
      container: elements.charAliasContainer,
      list: elements.charAliasList,
      input: elements.charFormAliases
    });
  }
  if (elements.searchLoreAliasContainer && elements.searchLoreAliasList && elements.searchLoreAliases) {
    searchLoreAliasManager = createAliasTagManager({
      container: elements.searchLoreAliasContainer,
      list: elements.searchLoreAliasList,
      input: elements.searchLoreAliases
    });
  }

  elements.btnOpenAddCharForm.addEventListener('click', () => openEditCharacterModal(null));
  elements.btnCancelCharForm.addEventListener('click', () => elements.charEditPanel.style.display = 'none');
  elements.btnSaveCharForm.addEventListener('click', saveCharacterForm);
  if (elements.btnAiAutofillChar) {
    elements.btnAiAutofillChar.addEventListener('click', autoFillCharacterWithAI);
  }

  elements.btnOpenWikiScraper.addEventListener('click', () => {
    const isClosed = elements.wikiScraperPanel.style.display === 'none';
    elements.wikiScraperPanel.style.display = isClosed ? 'block' : 'none';
    if (isClosed) {
      elements.charEditPanel.style.display = 'none';
      const scrollArea = elements.wikiScraperPanel.closest('.modal-glossary-scroll-area');
      if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  elements.btnCancelWiki.addEventListener('click', () => elements.wikiScraperPanel.style.display = 'none');
  elements.btnRunWikiScrape.addEventListener('click', runWikiScraper);

  // Close modals on clicking backdrop
  window.addEventListener('click', (e) => {
    closeAllHomeDropdowns();
    if (e.target === elements.modalWrite) elements.modalWrite.style.display = 'none';
    if (e.target === elements.modalUpload) elements.modalUpload.style.display = 'none';
    if (e.target === elements.modalEditBook) elements.modalEditBook.style.display = 'none';
    if (e.target === elements.modalNewBook) elements.modalNewBook.style.display = 'none';
    if (elements.modalGlossary && e.target === elements.modalGlossary) {
      closeGlossary();
    }

    // Dismiss book options dropdown on outside click
    if (elements.bookMoreDropdown && elements.bookMoreDropdown.style.display !== 'none') {
      if (!e.target.closest('#book-menu-wrapper')) {
        closeBookMoreMenu();
      }
    }

    // Dismiss floating lore card on outside click
    if (elements.charHoverCard && elements.charHoverCard.style.display !== 'none') {
      if (!e.target.closest('.char-tag') && !e.target.closest('#char-hover-card')) {
        hideCharacterTooltip();
      }
    }

    // Dismiss reader search drawer on outside click
    if (elements.readerSearchDrawer && elements.readerSearchDrawer.classList.contains('open')) {
      const isInsideDrawer = e.target.closest('#reader-search-drawer');
      const isTriggerBtn = e.target.closest('#btn-reader-search') || e.target.closest('#btn-open-search') || e.target.closest('#btn-open-glossary') || e.target.closest('#btn-hover-edit-char') || e.target.closest('#char-hover-card');
      if (!isInsideDrawer && !isTriggerBtn) {
        closeSearchDrawer();
      }
    }
  });

  // Home Shelf & Navigation Listeners
  if (elements.brandLink) {
    elements.brandLink.addEventListener('click', () => {
      showHomeView();
    });
  }

  if (elements.btnBackLibrary) {
    elements.btnBackLibrary.addEventListener('click', () => {
      closeBookMoreMenu();
      closeSearchDrawer();
      closeGlossary();
      showHomeView();
    });
  }

  if (elements.btnHomeStartBook) {
    elements.btnHomeStartBook.addEventListener('click', () => {
      openNewBookModal();
    });
  }

  if (elements.homeCoverFileInput) {
    elements.homeCoverFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleHomeCoverFile(e.target.files[0]);
      }
    });
  }

  // Home Shelf Search & Sort Listeners
  if (elements.homeBooksSearchInput) {
    elements.homeBooksSearchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      state.homeSearchQuery = q;
      if (elements.btnClearHomeSearch) {
        elements.btnClearHomeSearch.style.display = q.trim().length > 0 ? 'flex' : 'none';
      }
      renderHomeBooksGrid();
    });
  }

  if (elements.btnClearHomeSearch) {
    elements.btnClearHomeSearch.addEventListener('click', () => {
      if (elements.homeBooksSearchInput) {
        elements.homeBooksSearchInput.value = '';
        elements.homeBooksSearchInput.focus();
      }
      elements.btnClearHomeSearch.style.display = 'none';
      state.homeSearchQuery = '';
      renderHomeBooksGrid();
    });
  }

  if (elements.homeBooksSortSelect) {
    elements.homeBooksSortSelect.addEventListener('change', (e) => {
      state.homeSortBy = e.target.value;
      localStorage.setItem('xianxia_home_sort', state.homeSortBy);
      localStorage.setItem('xianxia_home_sort_v2', state.homeSortBy);
      renderHomeBooksGrid();
    });
  }

  window.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K: Toggle Search & Lore Drawer
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleSearchDrawer();
      return;
    }

    // '/' shortcut when reading (if not focused on an input/textarea)
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      if (elements.readerOverlay && elements.readerOverlay.style.display !== 'none') {
        e.preventDefault();
        openSearchDrawer();
      }
      return;
    }

    if (e.key === 'Escape') {
      closeAllHomeDropdowns();
      closeBookMoreMenu();
      hideCharacterTooltip();
      hideSelectionPopup();
      if (elements.readerSearchDrawer && elements.readerSearchDrawer.classList.contains('open')) {
        closeSearchDrawer();
      }
      closeGlossary();
    }
  });
}
