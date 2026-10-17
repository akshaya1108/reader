-- ==============================================================================
-- Optimized Supabase Staging Schema for Xianxia Reader
-- Project: bhpajsjpimiifmfiqybj.supabase.co
-- ==============================================================================

-- 1. Books Table
CREATE TABLE IF NOT EXISTS public.books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown',
    genre TEXT DEFAULT '',
    total_chapters INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    cover_image TEXT DEFAULT '',
    last_read_chapter INTEGER DEFAULT 1,
    last_read_at TIMESTAMPTZ,
    bookmark JSONB DEFAULT '{}'::jsonb,
    bookmarks JSONB DEFAULT '[]'::jsonb,
    enable_glossary BOOLEAN DEFAULT TRUE,
    shared_glossary_id TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Chapters Table (with Composite Index and Cascade Deletion)
CREATE TABLE IF NOT EXISTS public.chapters (
    book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (book_id, chapter_number)
);

-- 3. Glossary Table
CREATE TABLE IF NOT EXISTS public.glossary (
    book_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Character',
    description TEXT DEFAULT '',
    pinyin TEXT DEFAULT '',
    pinyin_or_chinese TEXT DEFAULT '',
    aliases JSONB DEFAULT '[]'::jsonb,
    affiliation TEXT DEFAULT '',
    sect_or_affiliation TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    mentions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (book_id, id)
);

-- 4. High-Performance Indexes (Prevents Table Scans & Resolves Supabase Linter Warnings)
CREATE INDEX IF NOT EXISTS idx_chapters_book_num ON public.chapters (book_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_glossary_book_id ON public.glossary (book_id);
CREATE INDEX IF NOT EXISTS idx_glossary_name ON public.glossary (book_id, name);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted anonymous read/write access via publishable key
DROP POLICY IF EXISTS "Allow public all on books" ON public.books;
CREATE POLICY "Allow public all on books" ON public.books FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on chapters" ON public.chapters;
CREATE POLICY "Allow public all on chapters" ON public.chapters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on glossary" ON public.glossary;
CREATE POLICY "Allow public all on glossary" ON public.glossary FOR ALL USING (true) WITH CHECK (true);
