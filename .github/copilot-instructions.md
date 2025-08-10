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
- **Categorized Organization**: Group related constants into objects (CSS_CLASSES, DUNGEON_INDICES, etc.)
- **Import Pattern**: Always import constants using `@/constants` alias
- **Coverage**: Include CSS class names, magic numbers, asset names, configuration values

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
    - `TrackerGrid.tsx`: Main item grid component
    - `grid/`: Grid rendering components (GridRow, GridItem)
    - `items/`: Item-specific components (BossItem, RegularItem)
    - `overlays/`: Interactive overlay components (ChestOverlay, RewardOverlay, MedaillonOverlay)
  - `map/`: Map-related components (MapTracker, MapChest, DungeonBoss)
  - `ui/`: Reusable UI components (Caption, Header)
- **Modular CSS Architecture** in `src/styles/`:
  - `index.css`: Master import file for all stylesheets
  - `variables.css`: CSS custom properties and design tokens
  - `base.css`: Reset styles and foundational rules
  - `header.css`: Header component styles with backdrop blur
  - `tracker.css`: Item grid and tracker-specific styles
  - `map.css`: Map components and location markers
  - `overlays.css`: Interactive overlay components
  - `ui.css`: Caption system and mini icons
- Data and types go in `src/data/`
- Constants go in `src/constants/index.ts` with simple export pattern
- State management in `src/stores/` using Zustand
- Tests should be co-located with components (`.spec.tsx`)
- **DO NOT** use index.ts files for component exports
- Always import components directly from their file paths (e.g., `from "./components/tracker/TrackerGrid"`)
- Use @ aliases for all imports instead of relative imports
- **CSS imports**: Use `@/styles/index.css` in main App component, individual modules imported via index.css

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
- **DO NOT** keep the file tsconfig.tsbuildinfo

### Performance
- Use React.memo for expensive components when needed
- Avoid unnecessary re-renders
- Optimize bundle size by avoiding large dependencies

### Error Handling
- Implement proper error boundaries
- Handle async operations with proper error states
- Provide meaningful error messages to users