# Copilot Instructions for ALLTP Tracker

## Project Structure
- The project uses **pnpm** as package manager
- The react version uses React 19 and TypeScript 5
- All work should be done in the root directory unless specifically mentioned

## Development Standards

### React & TypeScript
- Respects standard React practices and uses functional components with hooks
- The code is structured to be modular and reusable, following best practices for React development
- Each component will be documented with comments explaining its purpose and functionality
- Each component will be small and focused on a single responsibility
- Each component will be tested with vitest and react testing library
- Use TypeScript strict mode and proper type definitions

### Component Structure
A React component should be created like this:

```tsx
type MyComponentProps = {
  message: string;
};

/**
 * MyComponent description explaining its purpose
 * @param message - Description of the message prop
 */
export const MyComponent = ({ message }: MyComponentProps) => {
  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
};
```

### Component Architecture Principles
- **Separation of Concerns**: Components are organized by functionality (tracker, map, ui)
- **Single Responsibility**: Each component has a focused, specific purpose
- **Composition over Inheritance**: Use composition patterns for complex functionality
- **Direct Imports**: Always import components directly from their file paths, no index.ts files
- **Co-location**: Keep related files (component + test) together
- **Progressive Enhancement**: Build features incrementally with clear interfaces

### Import Standards
- **Use @ aliases**: Always use `@/` aliases instead of relative imports (`../`) for better maintainability
  - `@/components/` for component imports
  - `@/stores/` for store imports  
  - `@/types/` for type definitions
  - `@/data/` for data imports
  - `@/utils/` for utility functions
  - `@/constants/` for constants imports
- **Example**: Use `import { useGameStore } from "@/stores/gameStore"` instead of `import { useGameStore } from "../stores/gameStore"`
- **Type Safety**: Import types from their original definition files when needed for compatibility

### Constants Management
- **Centralized Constants**: All hardcoded values must be defined in `src/constants/index.ts`
- **Simple Export Pattern**: Use simple export declarations (`export const OBJECT = {}`, `export const ARRAY = []`)
- **Categorized Organization**: Group related constants into objects (CSS_CLASSES, DUNGEON_INDICES, KEYBOARD_NAVIGATION, etc.)
- **Import Pattern**: Always import constants using `@/constants` alias
- **Coverage**: Include CSS class names, magic numbers, asset names, configuration values, keyboard key codes

### Save Management Standards
- **Auto-Save System**: Use 5-second intervals with localStorage persistence
- **Save Slots**: Support 10 save slots (0-9) with slot 0 reserved for auto-save
- **Data Format**: JSON serialization with metadata (version, timestamp, platform)
- **Error Handling**: Graceful handling of localStorage errors and data validation
- **Confirmation Modals**: Use ConfirmationModal component for destructive operations
- **Method Restoration**: Ensure ChestItem and DungeonItem methods are restored after deserialization
- **State Management**: Use individual Zustand selectors to prevent object creation and infinite re-renders

### Header Component Standards
- **Fixed Positioning**: Use fixed header with backdrop-filter blur effect for modern appearance
- **Navigation Pattern**: Include essential external links (GitHub, ALttPR, Original tracker) with appropriate icons
- **Icon Integration**: Use authentic assets (triforce icon for ALttPR) and SVG icons for GitHub
- **Responsive Design**: Ensure header adapts to different screen sizes
- **Accessibility**: Include proper alt text for icons and semantic navigation structure
- **Styling**: Use modular CSS from `@/styles/header.css` with proper backdrop blur effects

When creating new components:
1. Determine the appropriate folder based on functionality
2. Create both the component and its test file
3. Import components directly from their file paths using @ aliases
4. Use appropriate @ aliases for all internal imports
5. Use constants from `@/constants` instead of hardcoded values
6. Follow the established patterns for similar components

### File Organization
- Components are organized in logical sub-folders within `src/components/`:
  - `tracker/`: Item tracking functionality
    - `TrackerGrid.tsx`: Main item grid component using CSS Grid layout with keyboard navigation
    - `grid/`: Grid rendering components (GridRow, GridItem) with spacer support for layout consistency
    - `items/`: Item-specific components (BossItem, RegularItem) with keyboard navigation support
    - `overlays/`: Interactive overlay components (ChestOverlay, RewardOverlay, MedaillonOverlay)
  - `map/`: Map-related components (MapTracker, MapChest, DungeonBoss)
  - `ui/`: Reusable UI components (Caption, Header)
- **Modular CSS Architecture** in `src/styles/`:
  - `index.css`: Master import file for all stylesheets
  - `variables.css`: CSS custom properties and design tokens
  - `base.css`: Reset styles and foundational rules
  - `header.css`: Header component styles with backdrop blur
  - `tracker.css`: CSS Grid layout, tracker-specific styles, and grid spacer classes
  - `map.css`: Map components and location markers
  - `overlays.css`: Interactive overlay components
  - `ui.css`: Caption system and mini icons
  - `tooltip.css`: Tooltip system with positioning and animations
  - `help.css`: Help overlay styles with responsive design
- Data and types go in `src/data/`
  - `items.ts`: Item definitions and default state
  - `chests.ts`: Chest locations and requirements  
  - `tooltips.ts`: Tooltip content for items, dungeons, and help system
- Constants go in `src/constants/index.ts` with simple export pattern
- State management in `src/stores/` using Zustand
  - `gameStore.ts`: Main game state (items, chests, dungeons, medallions)
  - `persistenceStore.ts`: Save/load operations and auto-save functionality
- Custom hooks in `src/hooks/` for reusable logic
  - `useAutoSave.ts`: Auto-save functionality with 5-second intervals
  - `useKeyboardNavigation.ts`: Keyboard navigation system for tracker grid
  - `useTooltip.ts`: Tooltip visibility and interaction management
- Tests should be co-located with components (`.spec.tsx`)
- **DO NOT** use index.ts files for component exports
- Always import components directly from their file paths (e.g., `from "./components/tracker/TrackerGrid"`)
- Use @ aliases for all imports instead of relative imports
- **CSS imports**: Use `@/styles/index.css` in main App component, individual modules imported via index.css

### Web Standards Compliance
- **W3C HTML Validation**: All HTML output is valid according to W3C standards
- **WCAG Accessibility**: Meets WCAG accessibility compliance with semantic HTML and keyboard navigation
- **CSS Grid Layout**: Modern CSS Grid replaces legacy table-based layouts with proper spacer elements
- **Semantic HTML**: Uses proper semantic elements (button, section, nav, header, main)
- **ARIA Attributes**: Proper ARIA labels and roles for screen reader accessibility
- **Keyboard Navigation**: Full keyboard support with arrow keys, Tab sequences, and focus management
- **No Table Layouts**: CSS Grid is used for all grid layouts instead of HTML tables
- **Modern CSS**: Uses CSS custom properties, backdrop-filter, and modern selectors

### Keyboard Navigation Architecture
- **useKeyboardNavigation Hook**: Custom hook managing keyboard events and focus states
- **Arrow Key Navigation**: Directional navigation with wrap-around support
- **Tab Sequence Navigation**: Standard Tab/Shift+Tab linear navigation
- **Space/Enter Activation**: Standard activation keys for interactive elements
- **Focus Management**: Visual focus indicators and programmatic focus control
- **Grid Position Tracking**: Intelligent position calculation with empty cell handling
- **Accessibility Integration**: WCAG-compliant keyboard navigation patterns

### Grid Layout & Spacer System
- **CSS Grid Container**: Semantic grid structure using `display: grid`
- **Grid Spacer Elements**: Invisible spacers maintain layout consistency for empty cells
- **Layout Preservation**: Empty cells render spacer divs instead of null to prevent column misalignment
- **Responsive Design**: Grid adapts to different screen sizes with consistent spacing
- **Data Attributes**: Grid position tracking via `data-grid-row` and `data-grid-col` attributes

### Persistence & Auto-Save Architecture
- **Individual Selectors**: Use individual Zustand selectors instead of object destructuring to prevent infinite re-renders
- **Error Boundaries**: Proper error handling for localStorage operations and data validation

When working with persistence:
1. Use individual selectors from stores to avoid object creation
2. Always restore methods for ChestItem and DungeonItem objects after loading
3. Include proper error handling and user feedback
4. Use ConfirmationModal for destructive operations
5. Maintain data integrity with version checking and validation

### Layout Architecture
- **CSS Grid Container**: `TrackerGrid.tsx` uses CSS Grid with `grid-template-columns`
- **Grid Rows**: `GridRow.tsx` uses `display: contents` for CSS Grid participation
- **Grid Spacers**: `GridItem.tsx` renders invisible spacers for empty cells to maintain grid alignment
- **Button Elements**: All interactive grid items are semantic `<button>` elements
- **Accessibility**: Each button has proper `aria-label` for screen reader support
- **Keyboard Navigation**: Integrated useKeyboardNavigation hook for arrow key and Tab navigation
- **Visual Consistency**: Identical rendering to original table layout maintained
- **Responsive Design**: CSS Grid adapts to different screen sizes automatically
- **Data Attributes**: Grid position tracking via `data-grid-row` and `data-grid-col` attributes

### Tooltips & Help System Architecture
- **Tooltip Component**: Rich contextual help with intelligent positioning and accessibility
- **Help Overlay**: Comprehensive help system with tabbed interface for shortcuts and gameplay tips
- **useTooltip Hook**: Manages tooltip visibility, interactions, and event handling
- **Tooltip Data**: Centralized content database for items, dungeons, and help information
- **Smart Positioning**: Tooltips automatically adjust position to stay within viewport bounds
- **Accessibility First**: Full keyboard support, ARIA attributes, and screen reader compatibility
- **Delay Management**: Configurable show/hide delays to prevent accidental tooltips
- **Rich Content**: Support for structured content including mechanics, tips, requirements, and shortcuts
- **Integration Ready**: Easy integration with existing tracker components via trigger props

#### Tooltip Component Standards
- **Positioning Options**: Support for top, bottom, left, right positioning with auto-adjustment
- **Content Structure**: Title, description, mechanics, tips, shortcuts, requirements (dungeons)
- **Event Handling**: Mouse hover, keyboard focus, touch interactions
- **Performance**: Efficient cleanup of timeouts and event listeners
- **Responsive Design**: Adapts content and positioning for mobile screens
- **Animation**: Smooth fade-in/scale animations with reduced motion support

#### Help System Standards
- **Modal Interface**: Full-screen overlay with backdrop blur and focus management
- **Tabbed Navigation**: Keyboard shortcuts and gameplay tips in separate tabs
- **Keyboard Display**: Visual representation of keys with proper styling
- **Content Organization**: Hierarchical sections for easy navigation
- **Accessibility**: Proper modal semantics, focus trapping, and escape handling
- **Responsive**: Mobile-optimized layout with touch-friendly interactions

#### Tooltip Data Standards
- **Type Safety**: Full TypeScript types for tooltip and dungeon data structures
- **Content Quality**: Comprehensive descriptions, mechanics explanations, and practical tips
- **Consistency**: Standardized format across all items and dungeons
- **Extensibility**: Easy addition of new tooltip content without code changes
- **Validation**: Automated tests ensure data completeness and structure

When implementing tooltips:
1. Use the Tooltip component wrapper around trigger elements
2. Import tooltip data from `@/data/tooltips` for consistent content
3. Configure appropriate positioning and delay for the use case
4. Ensure proper accessibility attributes on trigger elements
5. Test tooltip positioning at viewport edges
6. Use the useTooltip hook for custom implementations when needed

## Development Workflow

### Getting Started
To launch the project:
1. Run `pnpm install` to install dependencies
2. Run `pnpm dev` to start the development server

### Testing
- All new components must have tests
- Run `pnpm test` to execute tests
- Run `pnpm test:coverage` for coverage reports
- Run `pnpm test:coverage:show` to see coverage table in terminal
- Run `pnpm coverage` to view existing coverage data
- Use React Testing Library best practices
- Test user interactions, not implementation details
- Note: Some warnings about act() wrappers and duplicate keys are expected and non-blocking

### Coverage Standards
- **Target Coverage**: Maintain high coverage across all metrics
  - Lines: ≥90% (Excellent)
  - Functions: ≥90% (Excellent)
  - Statements: ≥90% (Excellent)
  - Branches: ≥80% (Good target, ≥90% excellent)
- **Coverage Reporting**: Integrated in CI/CD pipeline with PR comments
- **Local Coverage**: Use `pnpm test:coverage:show` for detailed terminal output
- **Quality Thresholds**: 🟢 ≥90%, 🟡 ≥80%, 🟠 ≥70%, 🔴 <70%

### Code Quality
- Follow the existing code style (Biome is configured)
- Run `pnpm lint` to check for linting issues
- Ensure TypeScript compilation passes without errors
- **Maintain test coverage**: New code should include comprehensive tests
- **Coverage Integration**: CI automatically reports coverage in PR comments
- **Security Analysis**: CodeQL automatically scans for vulnerabilities in PRs
- **Update documentation** (copilot instructions and README) for any architectural changes

### Security Standards
- **CodeQL Analysis**: Automated security vulnerability scanning for all TypeScript/JavaScript code
- **PR Integration**: CodeQL status automatically reported in PR comments
- **Security Findings**: Available in GitHub Security tab for review
- **Weekly Scans**: Automated weekly security analysis runs on Sundays
- **Quality Queries**: Uses GitHub's security-and-quality query suite for comprehensive analysis

### Git Workflow
- Each new feature must not be pushed to the master branch without a pull request
- Use descriptive commit messages
- Keep commits focused and atomic
- **Coverage validation**: PR comments automatically show coverage metrics
- **Security validation**: CodeQL analysis automatically scans for vulnerabilities
- **Quality gates**: All CI checks (lint, test, coverage, build, security) must pass

### Documentation Maintenance
- **ALWAYS** update the copilot instructions when making architectural changes
- **ALWAYS** update the README when adding new features or changing setup procedures
- **ALWAYS** update documentation when changing file organization or project structure
- **ALWAYS** update instructions when introducing new development patterns or practices
- Review and update documentation as part of every significant change
- Ensure documentation stays current with the actual codebase
- **DO NOT** update the CHANGELOG.md file unless specifically requested

## Important Guidelines

### Documentation
- **DO NOT** create additional markdown files to explain new features
- Document features through code comments and JSDoc
- Update existing documentation files only when necessary
- Prefer self-documenting code over external documentation

### Code Practices
- Always use TypeScript types for props and state
- Prefer composition over inheritance
- Use React hooks appropriately (useState, useEffect, etc.)
- Handle loading states and error states properly
- Ensure accessibility (a11y) standards are met
- **Use @ aliases** for all imports instead of relative paths
- **Use constants** from `@/constants` for all hardcoded values
- **Web Standards Compliance**: Follow W3C HTML validation and WCAG accessibility guidelines
- **CSS Grid Layout**: Use CSS Grid instead of HTML tables for layout purposes
- **Grid Spacers**: Always render spacer elements for empty cells instead of null to maintain layout
- **Semantic HTML**: Use appropriate semantic elements (button, section, header, nav, main)
- **Accessibility First**: Include proper ARIA attributes and labels for all interactive elements
- **Keyboard Navigation**: Include data attributes and focus handlers for grid navigation
- **DO NOT** keep the file tsconfig.tsbuildinfo
- **DO NOT** use HTML tables for layout - use CSS Grid instead
- **DO NOT** return null for empty grid cells - use spacer elements instead

### Performance
- Use React.memo for expensive components when needed
- Avoid unnecessary re-renders
- Optimize bundle size by avoiding large dependencies

### Error Handling
- Implement proper error boundaries
- Handle async operations with proper error states
- Provide meaningful error messages to users