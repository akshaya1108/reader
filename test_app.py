import unittest
import json
import os
import re
from app import app, DATA_DIR, CHAPTERS_DIR, GLOSSARY_DIR, BOOKS_FILE

class TestXianxiaReader(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_status(self):
        res = self.client.get('/api/status')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('gemini_configured', data)
        self.assertEqual(data.get('model'), 'gemini-3.6-flash')

    def test_books_list(self):
        res = self.client.get('/api/books')
        self.assertEqual(res.status_code, 200)
        books = res.get_json()
        self.assertIsInstance(books, list)
        self.assertTrue(len(books) >= 1)
        # Check first book structure
        b = books[0]
        self.assertIn('id', b)
        self.assertIn('title', b)
        self.assertIn('author', b)
        self.assertIn('chapters_count', b)

    def test_chapters(self):
        res = self.client.get('/api/books/mo-dao-zu-shi/chapters')
        self.assertEqual(res.status_code, 200)
        chapters = res.get_json()
        self.assertIsInstance(chapters, list)
        self.assertTrue(len(chapters) >= 1)
        ch = chapters[0]
        self.assertEqual(ch['chapter_number'], 1)
        self.assertIn('Wei Wuxian', ch['content'])

    def test_glossary(self):
        res = self.client.get('/api/books/mo-dao-zu-shi/glossary')
        self.assertEqual(res.status_code, 200)
        glossary = res.get_json()
        names = [c['name'] for c in glossary]
        self.assertIn('Wei Wuxian', names)
        self.assertIn('Lan Wangji', names)
        
        # Check Wei Wuxian aliases
        wwx = next(c for c in glossary if c['name'] == 'Wei Wuxian')
        self.assertIn('Yiling Patriarch', wwx['aliases'])
        self.assertIn('Wei Ying', wwx['aliases'])

    def test_save_chapter(self):
        payload = {
            "chapter_number": 99,
            "title": "Test Chapter 99",
            "content": "<p>Lan Zhan looked at Wei Ying silently under the moonlight.</p>",
            "auto_scan": False
        }
        res = self.client.post('/api/books/mo-dao-zu-shi/chapters', 
                               data=json.dumps(payload), 
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data['chapter']['word_count'], 10)

        # Cleanup test chapter
        del_res = self.client.delete('/api/books/mo-dao-zu-shi/chapters/99')
        self.assertEqual(del_res.status_code, 200)

    def test_update_book(self):
        res = self.client.put('/api/books/mo-dao-zu-shi',
                              data=json.dumps({
                                  "last_read_chapter": 2,
                                  "genre": "Xianxia Danmei"
                              }),
                              content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['last_read_chapter'], 2)
        self.assertEqual(data['genre'], 'Xianxia Danmei')

        # Restore
        self.client.put('/api/books/mo-dao-zu-shi',
                        data=json.dumps({"last_read_chapter": 1}),
                        content_type='application/json')

    def test_glossary_alias_merge_and_summary_preservation(self):
        from app import find_matching_glossary_entry, merge_glossary_entry

        mock_glossary = [
            {
                "id": "wei-wuxian",
                "name": "Wei Wuxian",
                "aliases": ["Wei Ying", "A-Ying", "Wei-xiong"],
                "summary": "Original ancient summary that must never be erased.",
                "category": "Character",
                "sect_or_affiliation": "Yunmeng Jiang Sect"
            }
        ]

        # 1. Test finding by known alias
        matched = find_matching_glossary_entry(mock_glossary, "A-Ying")
        self.assertIsNotNone(matched)
        self.assertEqual(matched["id"], "wei-wuxian")

        # 2. Test merging a new title "Yiling Laozu" into Wei Wuxian
        incoming_ai_data = {
            "name": "Wei Wuxian",
            "aliases": ["Yiling Laozu", "Yiling Patriarch"],
            "summary": "Brand new AI generated summary that should be ignored.",
            "category": "Character"
        }
        merged = merge_glossary_entry(mock_glossary[0], incoming_ai_data, query_name="Yiling Laozu")

        # Summary must NOT be replaced
        self.assertEqual(merged["summary"], "Original ancient summary that must never be erased.")
        # Older aliases must be preserved
        self.assertIn("A-Ying", merged["aliases"])
        self.assertIn("Wei-xiong", merged["aliases"])
        self.assertIn("Wei Ying", merged["aliases"])
        # New aliases must be added
        self.assertIn("Yiling Laozu", merged["aliases"])
        self.assertIn("Yiling Patriarch", merged["aliases"])

        # 3. Test lookup-character endpoint with existing alias (e.g. Yiling Laozu)
        res = self.client.post('/api/books/mo-dao-zu-shi/lookup-character',
                               data=json.dumps({"name": "Yiling Laozu", "add": True}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("found"))
        self.assertEqual(data["character"]["name"], "Wei Wuxian")
        self.assertIn("A-Ying", data["character"]["aliases"])

    def test_search_endpoint(self):
        # 1. Empty query test
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total_matches"], 0)

        # 2. Search for Wei Wuxian (both lore and chapter content)
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei+Wuxian')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["total_matches"] > 0)
        self.assertTrue(data["total_lore_matches"] >= 1)
        self.assertEqual(data["glossary_matches"][0]["name"], "Wei Wuxian")
        self.assertTrue(data["total_chapter_matches"] >= 1)
        self.assertIn('<mark class="search-match">Wei Wuxian</mark>', data["chapter_matches"][0]["snippets"][0]["snippet_html"])

        # 3. Chapter-filtered search
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei&ch=1')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        for ch in data["chapter_matches"]:
            self.assertEqual(ch["chapter_number"], 1)

        # 4. Scope: all_chapters
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei&scope=all_chapters')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total_lore_matches"], 0)
        self.assertTrue(data["total_chapter_matches"] >= 1)

        # 5. Scope: this_chapter with ch=1
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei&scope=this_chapter&ch=1')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total_lore_matches"], 0)
        for ch in data["chapter_matches"]:
            self.assertEqual(ch["chapter_number"], 1)

        # 6. Scope: lore
        res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei&scope=lore')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["total_lore_matches"] >= 1)
        self.assertEqual(data["total_chapter_matches"], 0)

    def test_search_with_disabled_glossary(self):
        # Update book to disable glossary
        self.client.put('/api/books/mo-dao-zu-shi',
                        data=json.dumps({"enable_glossary": False}),
                        content_type='application/json')
        try:
            res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Wei+Wuxian&scope=all')
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            # When enable_glossary is False, lore matches must be empty
            self.assertEqual(data["total_lore_matches"], 0)
            self.assertEqual(len(data["glossary_matches"]), 0)
            self.assertTrue(data["total_chapter_matches"] >= 1)
        finally:
            # Restore enable_glossary to True
            self.client.put('/api/books/mo-dao-zu-shi',
                            data=json.dumps({"enable_glossary": True}),
                            content_type='application/json')

    def test_glossary_affiliation_and_aliases(self):
        # 1. Fetch glossary and verify affiliation field and aliases
        res = self.client.get('/api/books/mo-dao-zu-shi/glossary')
        self.assertEqual(res.status_code, 200)
        glossary = res.get_json()
        wwx = next(c for c in glossary if c['name'] == 'Wei Wuxian')
        self.assertEqual(wwx.get('affiliation'), 'Yunmeng Jiang Sect')
        # Check that pinyin or chinese was merged into aliases
        self.assertTrue(any('魏无羡' in a for a in wwx.get('aliases', [])))

        # 2. Add or update character with affiliation
        test_payload = {
            "name": "Aragorn",
            "category": "Character",
            "affiliation": "Fellowship of the Ring",
            "aliases": ["Strider", "Elessar"],
            "pinyin_or_chinese": "",
            "summary": "Heir of Isildur and King of Gondor."
        }
        res = self.client.post('/api/books/mo-dao-zu-shi/glossary',
                               data=json.dumps(test_payload),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)

        # Verify entry was saved with affiliation and can be searched
        search_res = self.client.get('/api/books/mo-dao-zu-shi/search?q=Aragorn&scope=lore')
        self.assertEqual(search_res.status_code, 200)
        search_data = search_res.get_json()
        self.assertTrue(search_data["total_lore_matches"] >= 1)
        aragorn_match = search_data["glossary_matches"][0]
        self.assertEqual(aragorn_match["affiliation"], "Fellowship of the Ring")
        self.assertIn("Strider", aragorn_match["aliases"])

        # Delete the test character
        char_id = aragorn_match["id"]
        del_res = self.client.delete(f'/api/books/mo-dao-zu-shi/glossary/{char_id}')
        self.assertEqual(del_res.status_code, 200)

    def test_canonical_categories_and_normalization(self):
        from app import CANONICAL_CATEGORIES, normalize_category

        # 1. Verify CANONICAL_CATEGORIES exactly matches the 5 standard categories
        expected_categories = [
            "Character",
            "Weapon / Item",
            "Clan / Sect",
            "Location / Realm",
            "Concept / Lore"
        ]
        self.assertEqual(CANONICAL_CATEGORIES, expected_categories)

        # 2. Test normalization helper
        self.assertEqual(normalize_category("weapon / artifact"), "Weapon / Item")
        self.assertEqual(normalize_category("Item"), "Weapon / Item")
        self.assertEqual(normalize_category("location"), "Location / Realm")
        self.assertEqual(normalize_category("cultivation sect / faction"), "Clan / Sect")
        self.assertEqual(normalize_category("lore / technique"), "Concept / Lore")
        self.assertEqual(normalize_category("animal"), "Character")
        self.assertEqual(normalize_category(""), "Character")

        # 3. Verify all entries in mo-dao-zu-shi glossary belong to the 5 canonical categories
        res = self.client.get('/api/books/mo-dao-zu-shi/glossary')
        self.assertEqual(res.status_code, 200)
        glossary = res.get_json()
        for item in glossary:
            self.assertIn(item.get("category"), CANONICAL_CATEGORIES, f"Item {item.get('name')} has non-canonical category {item.get('category')}")

        # 4. Adding an item with a legacy category name gets normalized automatically
        test_item = {
            "name": "Glamdring",
            "category": "Weapon / Artifact",
            "affiliation": "Gandalf",
            "aliases": ["Foe-hammer"],
            "summary": "Ancient elven sword forged in Gondolin."
        }
        post_res = self.client.post('/api/books/mo-dao-zu-shi/glossary',
                                   data=json.dumps(test_item),
                                   content_type='application/json')
        self.assertEqual(post_res.status_code, 200)

        # Fetch and check normalized category
        res2 = self.client.get('/api/books/mo-dao-zu-shi/glossary')
        saved_item = next(c for c in res2.get_json() if c['name'] == 'Glamdring')
        self.assertEqual(saved_item['category'], 'Weapon / Item')

        # Clean up
        self.client.delete(f"/api/books/mo-dao-zu-shi/glossary/{saved_item['id']}")

    def test_glossary_rolling_backup_and_non_destructive_merge(self):
        from app import save_glossary, load_glossary, GLOSSARY_DIR, merge_glossary_entry
        from scraper import detect_category_from_text

        # 1. Test category detection
        self.assertEqual(detect_category_from_text("https://modao-zushi.fandom.com/wiki/Category:Locations"), "Location / Realm")
        self.assertEqual(detect_category_from_text("Category:Weapons"), "Weapon / Item")
        self.assertEqual(detect_category_from_text("Category:Clans"), "Clan / Sect")
        self.assertEqual(detect_category_from_text("Category:Characters"), "Character")

        # 2. Test rolling backup creation
        backup_dir = os.path.join(GLOSSARY_DIR, "backups")
        initial_backups = len(os.listdir(backup_dir)) if os.path.exists(backup_dir) else 0

        # Perform save
        current_glossary = load_glossary('mo-dao-zu-shi')
        save_glossary('mo-dao-zu-shi', current_glossary)

        # Verify backup was created
        self.assertTrue(os.path.exists(backup_dir))
        new_backups = len(os.listdir(backup_dir))
        self.assertTrue(new_backups >= initial_backups)

        # 3. Test non-destructive alias union
        existing = {
            "name": "Wei Wuxian",
            "aliases": ["Wei Ying", "Yiling Patriarch", "A-Xian"],
            "summary": "Original ancient summary."
        }
        incoming = {
            "name": "Wei Wuxian",
            "aliases": ["Wei Ying", "Yiling Laozu"],
            "summary": "AI summary that must not overwrite."
        }
        merged = merge_glossary_entry(existing, incoming, query_name="Senior Wei")

        # Summary preserved
        self.assertEqual(merged["summary"], "Original ancient summary.")
        # All old and new aliases present without duplicates
        self.assertIn("Wei Ying", merged["aliases"])
        self.assertIn("Yiling Patriarch", merged["aliases"])
        self.assertIn("A-Xian", merged["aliases"])
        self.assertIn("Yiling Laozu", merged["aliases"])
        self.assertIn("Senior Wei", merged["aliases"])

    def test_transportation_talisman_and_category_isolation(self):
        from app import load_glossary, find_matching_glossary_entry

        glossary = load_glossary('mo-dao-zu-shi')

        # 1. Verify Cloud Recesses does NOT contain Transportation Talisman
        cr = next((e for e in glossary if "Cloud Recesses" in e.get("name", "")), None)
        self.assertIsNotNone(cr)
        cr_aliases_lower = [a.lower() for a in cr.get("aliases", [])]
        self.assertNotIn("transportation talisman", cr_aliases_lower)

        # 2. Verify Transportation Talisman exists as its own Weapon / Item entry
        tt = next((e for e in glossary if e.get("name") == "Transportation Talisman"), None)
        self.assertIsNotNone(tt)
        self.assertEqual(tt.get("category"), "Weapon / Item")

        # 3. Verify lookup finds Transportation Talisman directly and not Cloud Recesses
        match = find_matching_glossary_entry(glossary, "Transportation Talisman")
        self.assertIsNotNone(match)
        self.assertEqual(match.get("name"), "Transportation Talisman")
        self.assertEqual(match.get("category"), "Weapon / Item")

        # 4. Verify cross-category matching is strictly rejected
        cross_cat_item = {"name": "The Cloud Recesses", "category": "Weapon / Item"}
        cross_match = find_matching_glossary_entry(glossary, "Nonexistent", incoming_item=cross_cat_item)
        self.assertIsNone(cross_match)

    def test_mobile_pwa_routes(self):
        # 1. Test /m returns 200 and mobile shell
        res = self.client.get('/m')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'My Library', res.data)
        self.assertIn(b'mobile-app.js', res.data)

        # 2. Test /m/manifest.json and /manifest.json
        res_m = self.client.get('/m/manifest.json')
        self.assertEqual(res_m.status_code, 200)
        data_m = json.loads(res_m.data.decode('utf-8'))
        self.assertEqual(data_m['display'], 'standalone')
        self.assertEqual(data_m['start_url'], '/m')

        res_root = self.client.get('/manifest.json')
        self.assertEqual(res_root.status_code, 200)

        # 3. Test /m/sw.js and /sw.js
        res_sw = self.client.get('/m/sw.js')
        self.assertEqual(res_sw.status_code, 200)
        self.assertIn(b'CACHE_NAME', res_sw.data)

        # 4. Test mobile static assets
        res_css = self.client.get('/m/static/css/mobile.css')
        self.assertEqual(res_css.status_code, 200)
        self.assertIn(b'safe-area-inset-top', res_css.data)

        res_js = self.client.get('/m/static/js/mobile-app.js')
        self.assertEqual(res_js.status_code, 200)
        self.assertIn(b'switchView', res_js.data)

        res_api = self.client.get('/m/static/js/api.js')
        self.assertEqual(res_api.status_code, 200)
        self.assertIn(b'export const api', res_api.data)

    def test_epub_import_endpoint(self):
        # 1. Non-epub rejection
        import io
        fake_txt = (io.BytesIO(b"Hello world"), "test.txt")
        res = self.client.post('/api/books/import-epub', data={'file': fake_txt}, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 400)

        # 2. Real EPUB import test
        epub_path = 'Mo_Dao_Zu_Shi_Chapters_1-113.epub'
        if os.path.exists(epub_path):
            with open(epub_path, 'rb') as f:
                res_epub = self.client.post('/api/books/import-epub', data={'file': (f, 'test_import.epub')}, content_type='multipart/form-data')
            self.assertEqual(res_epub.status_code, 201)
            data = res_epub.get_json()
            self.assertTrue(data.get('success'))
            self.assertIn('book', data)
            imported_id = data['book']['id']
            # Clean up the test-imported book
            self.client.delete(f'/api/books/{imported_id}')

    def test_glossary_link_rules(self):
        # 1. Test GET glossary-link endpoint
        res = self.client.get('/api/books/the-two-towers/glossary-link')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('all_other_books', data)
        self.assertIn('current_book', data)
        
        # Verify books with enable_glossary: False are excluded
        other_ids = [b['id'] for b in data['all_other_books']]
        self.assertNotIn('things-that-deserve-to-die', other_ids)

        # Verify books with > 0 entries have can_link: False when current book also has > 0 entries
        mdzs = next((b for b in data['all_other_books'] if b['id'] == 'mo-dao-zu-shi'), None)
        if mdzs:
            self.assertFalse(mdzs['can_link'])

        # Verify POST rejects linking two non-empty distinct glossary sources
        res_post = self.client.post('/api/books/the-two-towers/glossary-link',
                                    data=json.dumps({'target_book_ids': ['mo-dao-zu-shi']}),
                                    content_type='application/json')
        self.assertEqual(res_post.status_code, 400)
        self.assertIn('error', res_post.get_json())

    def test_auto_arrange_chapters(self):
        # Create a test book with non-sequential chapters 1, 4, 6
        test_book_id = "test-arrange-book"
        res_book = self.client.post('/api/books',
                                    data=json.dumps({"title": "Test Arrange Novel"}),
                                    content_type='application/json')
        self.assertEqual(res_book.status_code, 201)
        created_id = res_book.get_json()['id']

        try:
            # Create chapters 1, 4, 6
            for num in [1, 4, 6]:
                res_ch = self.client.post(f'/api/books/{created_id}/chapters',
                                         data=json.dumps({
                                             "chapter_number": num,
                                             "title": f"Chapter {num}: Test Title",
                                             "content": f"<p>Content of chapter {num}.</p>",
                                             "auto_scan": False
                                         }),
                                         content_type='application/json')
                self.assertEqual(res_ch.status_code, 200)

            # Call auto-arrange
            res_arrange = self.client.post(f'/api/books/{created_id}/auto-arrange-chapters')
            self.assertEqual(res_arrange.status_code, 200)
            data = res_arrange.get_json()
            self.assertTrue(data['success'])
            self.assertTrue(data['changed'])
            self.assertEqual(data['chapters_count'], 3)
            self.assertEqual(data['mapping'], {"1": 1, "4": 2, "6": 3})

            # Verify chapters list now has 1, 2, 3
            res_list = self.client.get(f'/api/books/{created_id}/chapters')
            self.assertEqual(res_list.status_code, 200)
            chapters = res_list.get_json()
            self.assertEqual([c['chapter_number'] for c in chapters], [1, 2, 3])
            self.assertEqual(chapters[0]['title'], "Chapter 1: Test Title")
            self.assertEqual(chapters[1]['title'], "Chapter 2: Test Title")
            self.assertEqual(chapters[2]['title'], "Chapter 3: Test Title")

            # Calling again when already sequential should return changed: False
            res_again = self.client.post(f'/api/books/{created_id}/auto-arrange-chapters')
            self.assertEqual(res_again.status_code, 200)
            data_again = res_again.get_json()
            self.assertFalse(data_again['changed'])

        finally:
            # Cleanup test book
            self.client.delete(f'/api/books/{created_id}')

    def test_soft_delete_trash(self):
        from app import TRASH_CHAPTERS_DIR, TRASH_BOOKS_DIR
        # 1. Create a temporary book
        res_book = self.client.post('/api/books',
                                    data=json.dumps({"title": "Trash Test Book"}),
                                    content_type='application/json')
        self.assertEqual(res_book.status_code, 201)
        book_id = res_book.get_json()['id']

        # 2. Create and delete chapter 5
        self.client.post(f'/api/books/{book_id}/chapters',
                         data=json.dumps({
                             "chapter_number": 5,
                             "title": "Chapter 5: Trash Test",
                             "content": "<p>Temporary trash chapter content.</p>",
                             "auto_scan": False
                         }),
                         content_type='application/json')

        res_del_ch = self.client.delete(f'/api/books/{book_id}/chapters/5')
        self.assertEqual(res_del_ch.status_code, 200)

        # Verify chapter exists in TRASH_CHAPTERS_DIR
        book_trash = os.path.join(TRASH_CHAPTERS_DIR, book_id)
        self.assertTrue(os.path.exists(book_trash))
        trashed_chapters = [f for f in os.listdir(book_trash) if f.endswith("_ch_5.json")]
        self.assertTrue(len(trashed_chapters) >= 1)

        # 3. Delete the book and verify it exists in TRASH_BOOKS_DIR
        res_del_book = self.client.delete(f'/api/books/{book_id}')
        self.assertEqual(res_del_book.status_code, 200)

        trashed_books = [d for d in os.listdir(TRASH_BOOKS_DIR) if d.endswith(f"_{book_id}")]
        self.assertTrue(len(trashed_books) >= 1)

if __name__ == '__main__':
    unittest.main()






