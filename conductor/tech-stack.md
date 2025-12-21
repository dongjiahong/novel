# Tech Stack: only reading

This project is built using a modern React-based stack optimized for client-side performance and personal data sovereignty.

## Frontend
- **Framework:** React 19
- **Language:** TypeScript
- **State Management:** React Context API
- **Styling:** CSS (Modular/Component-based)
- **Icons:** Lucide React
- **Gestures/Interaction:** @use-gesture/react

## Core Utilities
- **EPUB Parsing:** JSZip (for reading compressed EPUB structures)
- **Text Processing:** Regular expressions for TXT chapter detection and intelligent pagination.
- **Synchronization:** WebDAV (Client-side integration for personal cloud sync)

## Build & Development
- **Build Tool:** Vite 6
- **Type Checking:** TypeScript Compiler (tsc)

## Infrastructure
- **Deployment:** Nginx (Static file serving with WebDAV proxy support)
