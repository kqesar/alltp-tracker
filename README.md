# A Link to the Past Tracker

A web-based item and progress tracker for The Legend of Zelda: A Link to the Past randomizer speedruns and playthroughs. This application helps players track their collected items, dungeon progress, and chest locations throughout their adventure in Hyrule.

### Live Site
The tracker is available at: **[https://kqesar.github.io/alltp-tracker/](https://kqesar.github.io/alltp-tracker/)**

The tracker is automatically deployed to GitHub Pages from the latest master branch.

## 🎮 What is it for

This tracker is designed for **A Link to the Past randomizer** players who need to:
- **Track items**: Monitor collected weapons, tools, and upgrades with visual indicators
- **Track dungeon progress**: See which dungeons are accessible, completed, or still need items
- **Track chest locations**: Mark which overworld chests have been opened
- **Track boss rewards**: Monitor crystal and pendant rewards for each dungeon boss
- **Track medallion requirements**: Manage Bombos, Ether, and Quake medallion requirements for Misery Mire and Turtle Rock

## 🛠️ Technical Stack

- **Frontend**: React 19 with TypeScript 5
- **Styling**: Custom CSS with game-themed assets
- **Package Manager**: pnpm
- **Code Quality**: Biome for linting and formatting
- **Testing**: Vitest with React Testing Library

## 🚀 How to Launch

### Prerequisites
- Node.js ≥ 22.0.0
- pnpm ≥ 10.0.0

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/kqesar/alltp-tracker
cd alltp-tracker

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application will be available at `http://localhost:5173` (or the next available port).

### Production Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Code Quality

```bash
# Run linter
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## 🎯 How to Use

### Item Tracking
- **Click items** in the left grid to cycle through their states (0-4 for progressive items, on/off for binary items)
- **Visual feedback**: Items show as dimmed when not obtained, bright when obtained
- **Progressive items**: Bow (0-4), Gloves (0-2), Sword (0-4), etc. cycle through upgrade levels

### Map Interaction
- **Chest markers**: Click to mark overworld chests as opened/unopened
- **Boss icons**: Click to mark dungeon bosses as beaten
- **Hover information**: Mouse over any element to see requirements and details

### Boss Overlays
Each dungeon boss has three clickable overlays:
- **Top-right (Medallion)**: For Misery Mire and Turtle Rock, cycle through medallion requirements (Unknown/Bombos/Ether/Quake)
- **Bottom-left (Chest count)**: Track remaining chests in the dungeon
- **Bottom-right (Reward)**: Track the boss reward (Crystal/Pendant type)

### Visual Indicators
- **Green**: Location/boss is accessible with current items
- **Red**: Not accessible with current items  
- **Yellow**: Partially accessible (some items missing)
- **Dimmed**: Already completed/opened

### Caption System
- **Hover over items** on the map to see detailed requirement information
- **Dynamic medallion info**: Captions for Misery Mire and Turtle Rock update to show the currently selected medallion requirement

## 🎮 Game Features

### Supported Items
- **Weapons**: Bow, Boomerang, Hookshot, various rods
- **Tools**: Hammer, Flippers, Boots, Gloves, Bottles
- **Magic**: Medallions (Bombos, Ether, Quake), Magic Cape, Cane of Byrna
- **Key items**: Moon Pearl, Mirror, Book of Mudora, Magic Powder

### Dungeon Logic
- **Accessibility checking**: Real-time calculation of which dungeons can be entered/completed
- **Chest requirements**: Track which dungeon chests can be obtained
- **Boss logic**: Separate tracking for boss accessibility vs. dungeon completion
- **Medallion requirements**: Special logic for Dark World medallion dungeons

### Map Features
- **64 overworld chest locations** with requirement logic
- **10 dungeon bosses** with individual state tracking
- **Interactive overlays** for complex dungeon information
- **Coordinate transformation** for different map orientations

## 🏗️ Project Structure

```
src/
├── components/
│   ├── tracker/           # Item tracking components
│   │   ├── TrackerGrid.tsx        # Main item grid layout
│   │   ├── grid/                  # Grid rendering components
│   │   │   ├── GridRow.tsx        # Individual grid rows
│   │   │   └── GridItem.tsx       # Individual grid items
│   │   ├── items/                 # Item-specific components
│   │   │   ├── BossItem.tsx       # Boss-specific item handling
│   │   │   └── RegularItem.tsx    # Standard item handling
│   │   └── overlays/              # Interactive overlay components
│   │       ├── ChestOverlay.tsx   # Dungeon chest counter
│   │       ├── RewardOverlay.tsx  # Boss reward indicator
│   │       └── MedaillonOverlay.tsx # Medallion requirement selector
│   ├── map/               # Map-related components
│   │   ├── MapTracker.tsx         # Interactive map component
│   │   ├── MapChest.tsx           # Map chest markers
│   │   ├── DungeonBoss.tsx        # Dungeon boss markers
│   │   └── DungeonChest.tsx       # Dungeon chest markers
│   └── ui/                # UI utility components
│       └── Caption.tsx            # Hover caption display
├── constants/             # Centralized constants
│   └── index.ts          # All hardcoded values and configuration
├── data/
│   ├── chests.ts          # Chest and dungeon definitions
│   └── items.ts           # Item definitions and layout
├── stores/
│   └── gameStore.ts       # Zustand state management
├── hooks/                 # Custom React hooks
├── App.tsx                # Main application logic
├── main.tsx              # React entry point
└── styles.css            # Game-specific styling
```

### Component Architecture

The application follows a modular component architecture with clear separation of concerns:

- **tracker/**: Contains all item tracking functionality
  - `TrackerGrid`: Main container for the item grid layout
  - `grid/`: Rendering components for the grid structure
  - `items/`: Item-specific logic and display components
  - `overlays/`: Interactive overlay components for complex dungeon interactions

- **map/**: Map and location tracking components
  - `MapTracker`: Main interactive map with chest and boss markers
  - `MapChest`: Individual chest marker components
  - `DungeonBoss`: Interactive dungeon boss markers
  - `DungeonChest`: Dungeon-specific chest counters

- **ui/**: Reusable UI components
  - `Caption`: Dynamic hover information display

- **constants/**: Centralized configuration management
  - All CSS class names, magic numbers, asset paths, and configuration values
  - Simple export pattern for easy maintenance and consistency

### Development Standards

#### Import System
- **@ Aliases**: All imports use `@/` aliases instead of relative paths for better maintainability
- **Examples**:
  - `import { CSS_CLASSES } from "@/constants"`
  - `import { useGameStore } from "@/stores/gameStore"`
  - `import { TrackerGrid } from "@/components/tracker/TrackerGrid"`

#### Constants Management
- **Centralized**: All hardcoded values are defined in `src/constants/index.ts`
- **Categorized**: Constants are organized into logical groups (CSS_CLASSES, DUNGEON_INDICES, etc.)
- **Simple Exports**: Uses simple export declarations (`export const OBJECT = {}`)
- **Coverage**: Includes CSS class names, magic numbers, asset names, and configuration values

## 🤝 Contributing

This project uses modern React practices and development standards:

### Code Standards
- **Functional components** with hooks
- **TypeScript** for type safety and better development experience
- **Modular architecture** with small, focused components
- **@ Alias imports**: Use `@/` aliases instead of relative imports for better maintainability
- **Centralized constants**: All hardcoded values stored in `@/constants` for consistency
- **Biome** for consistent code formatting and linting

### Import Examples
```tsx
// ✅ Good - Use @ aliases
import { CSS_CLASSES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";

// ❌ Avoid - Relative imports
import { CSS_CLASSES } from "../constants";
import { useGameStore } from "../../stores/gameStore";
```

### Constants Usage
```tsx
// ✅ Good - Use centralized constants
<div className={CSS_CLASSES.MAP_CONTAINER}>
  {GRID_CONSTANTS.ITEMS_PER_ROW}
</div>

// ❌ Avoid - Hardcoded values
<div className="map-container">
  {7}
</div>
```

### Conventional Commits

This project follows the [Conventional Commits](https://conventionalcommits.org/) specification. All commit messages should be formatted as:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

#### Examples:
```bash
feat(tracker): add medallion overlay for boss dungeons
fix(map): correct chest coordinates transformation
docs(readme): update installation instructions
```

### Release Process

Releases are automated using GitHub Actions:
- **Automatic**: Push to master branch triggers automatic patch release
- **Manual**: Use GitHub Actions workflow dispatch to create minor/major releases
- **Changelog**: Automatically generated from conventional commits

Pull requests welcome for bug fixes, feature improvements, and code quality enhancements!

## 🚀 Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions:

### Automatic Deployment Process
1. **Trigger**: Push to `master` branch or manual workflow dispatch
2. **Quality Checks**: 
   - ✅ `pnpm lint` - Code quality validation
   - ✅ `pnpm test` - Test suite execution
   - ✅ `pnpm build` - Production build verification
3. **Deploy**: Built assets are automatically pushed to `gh-pages` branch and deployed

### GitHub Pages Configuration
The deployment uses the traditional `gh-pages` branch approach:
- Built assets are pushed to the `gh-pages` branch
- GitHub Pages serves content from the `gh-pages` branch
- No environment protection rules interfere with deployment

### Manual Deployment
You can manually trigger a deployment via:
- GitHub Actions → Deploy to GitHub Pages → Run workflow
