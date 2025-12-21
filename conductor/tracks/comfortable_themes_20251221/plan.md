# Implementation Plan: Comfortable Reading Themes

This plan details the steps to implement Solarized Light and Dark themes with manual switching in the sidebar, ensuring local persistence without WebDAV synchronization.

## Phase 1: Foundation & State Management
*Goal: Define the theme system and ensure selection is persisted locally.*

- [ ] **Task: Define Theme Constants and Styles**
    - [ ] Sub-task: Add Solarized Light (`#fdf6e3` / `#657b83`) and Solarized Dark (`#002b36` / `#839496`) definitions to `constants.tsx` or a new theme config.
    - [ ] Sub-task: Update `types.ts` to include the new theme identifiers.
- [ ] **Task: Enhance ThemeContext for New Themes**
    - [ ] Sub-task: Update `ThemeContext.tsx` to handle the new Solarized options.
    - [ ] Sub-task: Implement logic to save/load the selected theme from `localStorage` independently of the main config object used for sync.
- [ ] **Task: Write Tests for Theme Switching Logic**
    - [ ] Sub-task: Write unit tests for `ThemeContext` to verify theme state updates correctly and persists to `localStorage`.
- [ ] Task: Conductor - User Manual Verification 'Foundation & State Management' (Protocol in workflow.md)

## Phase 2: UI Implementation
*Goal: Provide the user with visual controls to switch themes.*

- [ ] **Task: Implement Theme Swatch Component**
    - [ ] Sub-task: Create a reusable `ThemeSwatch` component (24x24px circle).
- [ ] **Task: Integrate Switcher into Sidebar**
    - [ ] Sub-task: Add a "Themes" section to `Sidebar.tsx`.
    - [ ] Sub-task: Render the row of swatches and connect them to the `ThemeContext` switcher.
- [ ] **Task: Verify Theme Application**
    - [ ] Sub-task: Write tests to ensure the `Reader` component correctly applies the selected theme's CSS variables or styles.
- [ ] Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md)

## Phase 3: Sync Exclusion & Final Polish
*Goal: Ensure themes remain local and the experience is seamless.*

- [ ] **Task: Verify Sync Exclusion**
    - [ ] Sub-task: Inspect `syncService.ts` or `useWebDAVSync.ts` to confirm the theme selection is not included in the payload sent to WebDAV.
- [ ] **Task: Final CSS Polish**
    - [ ] Sub-task: Ensure scrollbars and modal overlays are consistent with the Solarized palettes.
- [ ] Task: Conductor - User Manual Verification 'Sync Exclusion & Final Polish' (Protocol in workflow.md)
