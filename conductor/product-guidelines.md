# Product Guidelines: only reading

These guidelines define the standards for communication, visual identity, and user experience to ensure a consistent and effective learning environment.

## 1. Tone and Voice
- **Encouraging and Helpful:** Since the target audience consists of language learners, the interface should feel like a supportive companion. Use positive reinforcement when new words are learned.
- **Clarity and Simplicity:** Instructions and labels should be written in clear, unambiguous English. Avoid complex jargon unless it refers to specific linguistic terms necessary for the context (e.g., "conjugation," "synonym").
- **Concise:** Respect the user's focus. Reading is the primary task; the UI should provide maximum information with minimum text.

## 2. Visual Identity
- **Minimalist Aesthetic:** Maintain a distraction-free environment. Use whitespace effectively to separate the reading area from controls.
- **Typography-First:** High-quality, legible fonts are crucial. Use serif fonts for the reading body (to mimic traditional books) and clean sans-serif fonts for the interface.
- **Functional Color Palette:**
    - **Highlighting:** Use distinct but soft colors for vocabulary levels (e.g., soft orange for unknown, subtle underline for recognized).
    - **Themes:** Support at least a light (parchment), dark (night), and sepia (comfortable) mode to reduce eye strain.
- **Iconography:** Use consistent, recognizable icons (Lucide React) for settings, synchronization, and navigation.

## 3. User Experience (UX)
- **Instant Response:** Vocabulary lookups must feel instantaneous. Ensure the Small dictionary is cached and the Large dictionary loads seamlessly in the background.
- **Gesture-Friendly:** Prioritize touch and click areas for page turns (e.g., 30/40/30 split for prev/center/next).
- **Data Transparency:** Always indicate the synchronization status. Users should know exactly when their data is being sent to or received from WebDAV.
- **Performance:** Chapters should be processed and paginated efficiently. For long chapters, prioritize rendering the current view to ensure no lag during reading.

## 4. Accessibility
- **Level Customization:** Allow users to easily toggle their proficiency level at any time.
- **Legibility:** Provide adjustable font sizes and line heights to accommodate different visual needs.
