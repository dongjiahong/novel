# Specification: Comfortable Reading Themes

## Overview
Enhance the reading experience by providing a selection of "comfortable" color themes (Solarized Light and Solarized Dark) that can be manually toggled via the sidebar. These themes are intended for local comfort and will not be synchronized via WebDAV.

## Functional Requirements
- **Theme Selection:**
    - Provide a row of visual color swatches in the sidebar navigation menu.
    - Support at least two new themes: **Solarized Light** and **Solarized Dark**.
    - Maintain existing Light/Dark themes if they exist.
- **Manual Switching:**
    - Clicking a swatch immediately updates the reader's background and text colors.
- **Persistence:**
    - The selected theme should be saved to local storage so it persists across sessions on the current device.
- **No Synchronization:**
    - Explicitly exclude theme settings from the WebDAV sync logic to allow different themes on different devices (e.g., dark on mobile, light on desktop).

## Visual Identity (UI/UX)
- **Swatches:** 24x24px circular buttons representing the background color of each theme.
- **Solarized Light:** Background `#fdf6e3`, Text `#657b83`.
- **Solarized Dark:** Background `#002b36`, Text `#839496`.

## Acceptance Criteria
- [ ] Users can see theme swatches in the sidebar.
- [ ] Clicking a swatch changes the reading interface colors immediately.
- [ ] Refreshing the page preserves the selected theme.
- [ ] The theme choice does NOT change on other devices connected to the same WebDAV account.

## Out of Scope
- Integration with system-level dark mode settings.
- Custom user-defined color hex codes.
