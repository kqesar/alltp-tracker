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
- **Clean Imports**: Use index.ts files for organized folder-level imports
- **Co-location**: Keep related files (component + test) together
- **Progressive Enhancement**: Build features incrementally with clear interfaces

When creating new components:
1. Determine the appropriate folder based on functionality
2. Create both the component and its test file
3. Update relevant index.ts files for clean imports
4. Follow the established patterns for similar components

### File Organization
- Components are organized in logical sub-folders within `src/components/`:
  - `tracker/`: Item tracking functionality
    - `TrackerGrid.tsx`: Main item grid component
    - `grid/`: Grid rendering components (GridRow, GridItem)
    - `items/`: Item-specific components (BossItem, RegularItem)
    - `overlays/`: Interactive overlay components (ChestOverlay, RewardOverlay, MedaillonOverlay)
  - `map/`: Map-related components (MapTracker, MapChest)
  - `ui/`: Reusable UI components (Caption)
- Data and types go in `src/data/`
- State management in `src/stores/` using Zustand
- Tests should be co-located with components (`.spec.tsx`)
- Use clean imports via index.ts files for organized folders
- Import from folder level (e.g., `from "./components/tracker"`) rather than deep paths

## Development Workflow

### Getting Started
To launch the project:
1. Run `pnpm install` to install dependencies
2. Run `pnpm dev` to start the development server

### Testing
- All new components must have tests
- Run `pnpm test` to execute tests
- Use React Testing Library best practices
- Test user interactions, not implementation details

### Code Quality
- Follow the existing code style (Biome is configured)
- Run `pnpm lint` to check for linting issues
- Ensure TypeScript compilation passes without errors

### Git Workflow
- Each new feature must not be pushed to the master branch without a pull request
- Use descriptive commit messages
- Keep commits focused and atomic

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
- **DO NOT** keep the file tsconfig.tsbuildinfo

### Performance
- Use React.memo for expensive components when needed
- Avoid unnecessary re-renders
- Optimize bundle size by avoiding large dependencies

### Error Handling
- Implement proper error boundaries
- Handle async operations with proper error states
- Provide meaningful error messages to users