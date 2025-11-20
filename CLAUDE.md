# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E-Book Lingo Reader is a React-based English reading application with integrated vocabulary learning features. It parses EPUB and TXT files, highlights new vocabulary based on user proficiency levels, and provides dictionary lookups with translation. The app includes WebDAV sync capabilities for cross-device synchronization of books, reading progress, and vocabulary lists.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (Vite)
npm run build        # Build for production
npm run preview      # Preview production build on port 3000
```

## Architecture Overview

### Core State Management Pattern

The app uses a **centralized WordContext** (`context/WordContext.tsx`) that manages:
- Dictionary loading and size selection (small vs large)
- Vocabulary level system (determines which words the user knows)
- User-managed known/excluded words (manual overrides)
- New words list (vocabulary learning history)
- Word interaction state (for modal display)

This context wraps the entire app and is consumed by reading components to determine word highlighting.

### Book ID Generation Strategy

**CRITICAL**: Book IDs are generated using a hash of the book title (`services/parserService.ts:21`):
```typescript
const generateBookId = (title: string) => `book-${simpleHash(title)}`;
```

This ensures the same book has the same ID across devices, preventing duplicates during WebDAV sync. Chapter IDs are random UUIDs since they're device-specific.

### Dictionary Loading System

The app uses a **two-tier dictionary system** with lazy loading:

1. **Small dictionary** (~3MB, dict-small.js): Loaded at startup for common words
2. **Large dictionary** (~20MB, dict-large.js): Only loaded when user enables it in settings

**Implementation** (`dicts/index.ts`):
- `DictionaryWrapper` class provides async dictionary access with caching
- Dynamic imports ensure large dict is only loaded when `dictionarySize === 'large'`
- Default behavior: `lookupWord(word, useLarge = false)` only queries small dict

**IMPORTANT**: Never preload both dictionaries simultaneously - this defeats the performance optimization.

### WebDAV Sync Architecture

The sync system uses a **split-file architecture** for efficient synchronization:

**File Structure** (`/novel-reader/` on WebDAV):
```
config.json              # User settings (vocab level, known words)
books-meta.json          # Book metadata only (titles, IDs, chapter counts)
new-words.json           # Vocabulary learning list
reading-progress.json    # Reading positions per book
sync-metadata.json       # Sync timestamps and device info
books/                   # Actual book files
  book-{hash}.txt
  book-{hash}.epub
```

**Sync Flow** (`services/syncService.ts`):
1. Download metadata files
2. Merge with local data using conflict resolution strategies:
   - **Config**: Latest timestamp wins for vocab level; union for word lists
   - **Books metadata**: Union by title (same title = same book)
   - **New words**: Union by word+bookId, latest timestamp wins for duplicates
   - **Reading progress**: Per-book, latest timestamp wins
3. Upload merged data back to server
4. Download missing book files (based on books-meta but not present locally)

**Key Methods**:
- `syncService.performFullSync(localBooks, bookFiles)`: Main sync entry point
- Individual merge functions: `mergeConfig()`, `mergeBooksMeta()`, `mergeNewWords()`, `mergeReadingProgress()`

### Word Annotation Pipeline

The Reader component has a complex annotation system to handle performance with large texts:

**Pipeline** (`components/Reader.tsx`):
1. **Word Analysis Phase** (useEffect on chapter change):
   - Extract all words from chapter content
   - Check each word against known vocabulary and dictionary
   - Build `wordAnalysis` object with new word positions

2. **Annotation Set Building** (useEffect on analysis update):
   - Select first N new words to annotate (BATCH_SIZE = 500)
   - Ensure all words in new words list are always annotated
   - Store in `shouldAnnotateSet` for O(1) lookup

3. **Rendering Phase** (processText function):
   - Paginate content based on window height
   - For each word, check if index is in `shouldAnnotateSet`
   - Render `<AnnotatedWord>` only for selected words

4. **Progressive Loading**:
   - On page turn, calculate visible word count
   - If approaching annotation limit, increment batch by 500

This architecture prevents rendering thousands of tooltips simultaneously, which would freeze the UI.

### File Parsing System

**Supported Formats** (`services/parserService.ts`):
- **TXT**: Regex-based chapter detection (`/Chapter \d+/`, `/第\d+章/`)
- **EPUB**: JSZip extraction → HTML parsing → text stripping

Both parsers produce the same `Book` structure with chapters array. The parsers intentionally strip HTML formatting because the Reader component applies its own word-level annotation logic, which requires plain text.

## Important Patterns

### Vocabulary Level System

Users select a proficiency level (e.g., "CET-4", "TOEFL"). The system:
1. Loads corresponding word list from `/public/vocabulary-levels/{level}.txt`
2. Marks all words in that list as "known"
3. User can manually override with "I know this" / "I don't know this" buttons

**Exclusion Logic** (`context/WordContext.tsx:186-241`):
- `knownWords` = (vocabulary level words) ∪ (user marked known) - (user marked excluded)
- Includes basic stemming (plurals, -ed, -ing forms)

### WebDAV Configuration and HTTPS

The WebDAV service auto-converts HTTP URLs to HTTPS when the app is served over HTTPS to avoid mixed content errors (`services/webdavService.ts:23-36`). This is critical for production deployments.

### Pagination System

The Reader uses **dynamic pagination** based on window height:
- Calculates paragraphs per page: `(windowHeight - headers - footers) / PARAGRAPH_HEIGHT`
- Responds to window resize events
- Click zones: left 30% = previous page, right 30% = next page, center 40% = word interactions

## Key Files Reference

- `App.tsx`: Main app state (books, active book/chapter, sync orchestration)
- `components/Reader.tsx`: Core reading UI with word annotation
- `components/Sidebar.tsx`: Book library and chapter navigation
- `services/syncService.ts`: WebDAV sync with conflict resolution
- `services/dictionaryService.ts`: Word lookup with stemming
- `services/parserService.ts`: TXT/EPUB parsing with book ID hashing
- `context/WordContext.tsx`: Global vocabulary and dictionary state
- `hooks/useWebDAVSync.ts`: Auto-sync timer and manual sync trigger

## Testing Notes

When modifying the sync system:
1. Test with multiple devices (use different browser profiles to simulate)
2. Verify book deduplication by title (same book uploaded from different devices)
3. Check that reading progress survives sync conflicts
4. Ensure large dictionary isn't loaded unless explicitly enabled

When modifying the Reader:
1. Test with books containing 100+ chapters (pagination performance)
2. Verify word annotation doesn't freeze on long chapters (10,000+ words)
3. Check that new words list integration works (words added to list should always show tooltip)
