import JSZip from 'jszip';
import { Book, Chapter } from '../types';

// Helper to create a safe ID
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Main entry point to parse a file
 */
export const parseFile = async (file: File): Promise<Book> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return parseTxt(file);
  } else if (extension === 'epub') {
    return parseEpub(file);
  } else {
    throw new Error('Unsupported file format. Please use .txt or .epub');
  }
};

/**
 * Parse TXT files
 * Looks for regex patterns like "Chapter 1" or "第1章" to split content.
 */
const parseTxt = (file: File): Promise<Book> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        reject(new Error('Empty file'));
        return;
      }

      const chapters: Chapter[] = [];
      // Regex to identify chapter headers:
      // Matches: "Chapter 1", "Chapter 1:", "第1章", "第一章", etc.
      // ^\s* start of line, allow spaces
      // (Chapter|第) keyword
      // .*? non-greedy chars
      // (章|\d|:|.) end markers
      const chapterRegex = /(?:^\s*Chapter\s+\d+.*)|(?:^\s*第[0-9一二三四五六七八九十百千]+章.*)/gim;
      
      // Find all indices
      const matches = [...content.matchAll(chapterRegex)];
      
      if (matches.length === 0) {
        // No chapters found, treat whole file as one chapter
        chapters.push({
          id: generateId(),
          title: '全文内容',
          content: content
        });
      } else {
        // Split content based on matches
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const start = match.index!;
          const end = i < matches.length - 1 ? matches[i + 1].index! : content.length;
          
          const fullSection = content.slice(start, end);
          // Extract title (first line)
          const firstLineEnd = fullSection.indexOf('\n');
          const title = firstLineEnd > -1 ? fullSection.slice(0, firstLineEnd).trim() : fullSection.trim();
          const body = firstLineEnd > -1 ? fullSection.slice(firstLineEnd).trim() : '';

          // Format as markdown-ish header for our reader
          const formattedContent = `# ${title}\n\n${body}`;

          chapters.push({
            id: generateId(),
            title: title.substring(0, 50), // Limit title length
            content: formattedContent
          });
        }
      }
      
      // Handle preamble (text before first chapter)
      if (matches.length > 0 && matches[0].index! > 0) {
          const preContent = content.slice(0, matches[0].index);
          if (preContent.trim()) {
              chapters.unshift({
                  id: generateId(),
                  title: '前言 / 序',
                  content: `# 前言\n\n${preContent}`
              });
          }
      }

      resolve({
        id: generateId(),
        title: file.name,
        chapters: chapters
      });
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Parse EPUB files using JSZip
 * This is a simplified parser that extracts text from HTML files inside the EPUB.
 * It intentionally strips HTML tags to fit the current "Reader" component which
 * expects plain text/markdown text to perform its own word annotation logic.
 */
const parseEpub = async (file: File): Promise<Book> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const chapters: Chapter[] = [];
    
    // 1. Find all HTML/XHTML files
    // In a full implementation, we should parse container.xml -> content.opf -> manifest/spine
    // For this demo, we will iterate all .html/.xhtml files and try to sort them by name.
    const htmlFiles: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && (relativePath.endsWith('.html') || relativePath.endsWith('.xhtml'))) {
        htmlFiles.push(relativePath);
      }
    });

    // Sort files naturally (chapter1, chapter2, ... chapter10)
    htmlFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const parser = new DOMParser();

    for (const filePath of htmlFiles) {
      const fileData = await zip.file(filePath)?.async('string');
      if (fileData) {
        // Parse HTML string to DOM
        const doc = parser.parseFromString(fileData, 'text/html');
        
        // Extract Title
        let title = doc.title || doc.querySelector('h1')?.innerText || doc.querySelector('h2')?.innerText || 'Untitled Chapter';
        
        // Extract Body Text
        // We want to preserve some structure (paragraphs), so we look for <p> tags
        const paragraphs = Array.from(doc.querySelectorAll('p'));
        let textContent = '';
        
        if (paragraphs.length > 0) {
            textContent = paragraphs.map(p => p.textContent?.trim()).filter(t => t).join('\n\n');
        } else {
            // Fallback: just get body text if no p tags
            textContent = doc.body.textContent || '';
        }

        if (textContent.trim().length > 50) { // Filter out tiny files (like cover pages sometimes)
            chapters.push({
                id: generateId(),
                title: title.trim().substring(0, 60),
                content: `# ${title}\n\n${textContent}`
            });
        }
      }
    }

    if (chapters.length === 0) {
        throw new Error('No readable content found in EPUB');
    }

    return {
        id: generateId(),
        title: file.name,
        chapters
    };

  } catch (err) {
    console.error(err);
    throw new Error('Failed to parse EPUB file');
  }
};
