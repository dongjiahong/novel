import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import { MOCK_BOOKS } from './constants';
import { Book } from './types';
import { parseFile } from './services/parserService';
import { Loader2, BookOpen } from 'lucide-react';
import { WordProvider, useWordContext } from './context/WordContext';
import { WordModal } from './components/WordModal';

function AppContent() {
  const [books, setBooks] = useState<Book[]>(MOCK_BOOKS);
  const [activeBookId, setActiveBookId] = useState<string>('');
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeBook = books.find(b => b.id === activeBookId);
  const currentBookChapters = activeBook?.chapters || [];

  const currentChapter = currentBookChapters.find(c => c.id === activeChapterId)
                         || currentBookChapters[0]
                         || { id: 'empty', title: '无内容', content: '' };

  useEffect(() => {
      if (activeBook && currentBookChapters.length > 0) {
          const exists = currentBookChapters.find(c => c.id === activeChapterId);
          if (!exists) {
              setActiveChapterId(currentBookChapters[0].id);
          }
      }
  }, [activeBookId, activeBook, currentBookChapters, activeChapterId]);

  const handleSelectBook = (id: string) => {
      setActiveBookId(id);
      const book = books.find(b => b.id === id);
      if (book && book.chapters.length > 0) {
          setActiveChapterId(book.chapters[0].id);
      } else {
          setActiveChapterId('');
      }
  };

  const handleDeleteBook = (id: string) => {
      const newBooks = books.filter(b => b.id !== id);
      setBooks(newBooks);
      
      if (activeBookId === id) {
          if (newBooks.length > 0) {
              const nextBook = newBooks[0];
              setActiveBookId(nextBook.id);
              setActiveChapterId(nextBook.chapters[0]?.id || '');
          } else {
              setActiveBookId('');
              setActiveChapterId('');
          }
      }
  };

  const handleAddBook = async (file: File) => {
    setIsParsing(true);
    setErrorMsg(null);
    try {
        const newBook = await parseFile(file);
        
        setBooks(prev => [...prev, newBook]);
        setActiveBookId(newBook.id);
        if (newBook.chapters.length > 0) {
            setActiveChapterId(newBook.chapters[0].id);
        }
    } catch (err: any) {
        console.error("Parsing error:", err);
        setErrorMsg(err.message || "解析文件失败");
        setTimeout(() => setErrorMsg(null), 3000);
    } finally {
        setIsParsing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white relative">
      
      {/* Global Modal for Words */}
      <WordModal />

      {/* Loading Overlay */}
      {isParsing && (
          <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                  <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
                  <span className="text-gray-700 font-medium">正在解析图书内容...</span>
              </div>
          </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-700 px-4 py-2 rounded shadow border border-red-200">
              {errorMsg}
          </div>
      )}

      {/* Sidebar Container */}
      <div className="hidden md:block flex-shrink-0 h-full border-r border-gray-200">
        <Sidebar 
          books={books}
          activeBookId={activeBookId}
          activeChapterId={currentChapter.id}
          chapters={currentBookChapters}
          onSelectBook={handleSelectBook}
          onSelectChapter={setActiveChapterId}
          onAddBook={handleAddBook}
          onDeleteBook={handleDeleteBook}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         {/* Mobile Header */}
         <div className="md:hidden h-12 bg-white border-b flex items-center px-4 justify-between flex-shrink-0">
            <span className="font-bold text-gray-700">E-Reader</span>
            <button className="text-gray-500">Menu</button>
         </div>

         {activeBookId ? (
             <Reader chapter={currentChapter} />
         ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
                 <BookOpen size={48} className="text-gray-200" />
                 <p>请上传或选择一本书开始阅读</p>
             </div>
         )}
      </div>
    </div>
  );
}

function App() {
  return (
    <WordProvider>
      <AppContent />
    </WordProvider>
  );
}

export default App;
