# Contributing Guide

## Development Workflow

### Setup
```bash
# Clone the repository
git clone https://github.com/kqesar/alltp-tracker
cd alltp-tracker

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Follow the project structure in `src/`
   - Add tests for new features
   - Update documentation if needed

3. **Commit your changes**
   ```bash
   # Use conventional commits format
   git add .
   pnpm commit  # This uses commitizen for guided commit messages
   
   # Or manually with conventional format:
   git commit -m "feat(tracker): add new item tracking feature"
   ```

4. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   ```

### Conventional Commits

We use [Conventional Commits](https://conventionalcommits.org/) for consistent commit messages.

#### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

#### Examples
```bash
feat(map): add chest markers with click interaction
fix(tracker): correct item state cycling bug
docs(readme): update installation instructions
refactor(components): extract MapChest component
test(tracker): add tests for item state management
```

### Release Process

#### Automatic Releases
- Push to `master` branch triggers automatic patch release
- Changelog is automatically generated from conventional commits
- GitHub release is created with build artifacts

#### Manual Releases
Use GitHub Actions workflow dispatch:
- Go to Actions → Release and Changelog → Run workflow
- Choose release type: patch, minor, or major
- Manually trigger the release

#### Local Release Testing
```bash
# Dry run to see what would be released
pnpm release:dry

# Generate changelog without releasing
pnpm changelog

# Create full changelog from all commits
pnpm changelog:all
```

### Code Quality

#### Linting
```bash
# Check code style
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

#### Testing
```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

#### Pre-commit Hooks
- **commit-msg**: Validates commit message format
- Automatically runs when you commit

### Project Structure

```
src/
├── components/          # React components
│   ├── tracker/        # Item tracking with CSS Grid layout
│   │   ├── TrackerGrid.tsx    # Main CSS Grid container
│   │   ├── grid/              # Grid rendering components
│   │   ├── items/             # Item-specific components  
│   │   └── overlays/          # Interactive overlays
│   ├── map/            # Map components
│   │   ├── MapTracker.tsx     # Main map component
│   │   └── ...
│   └── ui/             # Reusable UI components
├── data/               # Game data and configurations
│   ├── chests.ts      # Chest and dungeon definitions
│   ├── items.ts       # Item definitions and layout
│   └── ...
├── styles/             # Modular CSS architecture
│   ├── tracker.css    # CSS Grid layout system
│   └── ...
├── App.tsx            # Main application component
├── main.tsx           # React entry point
└── ...
```

### Best Practices

#### React Components
- Use functional components with hooks
- Keep components small and focused
- Add TypeScript types for all props
- Add JSDoc comments for complex components
- Use semantic HTML elements (button, section, nav, etc.)
- Ensure WCAG accessibility compliance
- Use CSS Grid for layout instead of HTML tables

#### State Management
- Use useState for local state
- Keep state as close to where it's used as possible
- Use proper TypeScript types for state

#### Testing
- Write tests for new features
- Test component behavior, not implementation
- Use React Testing Library best practices

#### Git Workflow
- Use conventional commits
- Keep commits atomic and focused
- Write descriptive commit messages
- Rebase before merging to keep history clean

### Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive in discussions
