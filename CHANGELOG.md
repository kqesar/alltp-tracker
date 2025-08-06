# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.2.3](https://github.com/kqesar/alltp-tracker/compare/v1.2.2...v1.2.3) (2025-08-06)


### 🐛 Bug Fixes

* resolve all linting and TypeScript errors ([484eef6](https://github.com/kqesar/alltp-tracker/commit/484eef67a2125172de904776c0cb07746a98986f))

### [1.2.2](https://github.com/kqesar/alltp-tracker/compare/v1.2.1...v1.2.2) (2025-08-06)


### 🐛 Bug Fixes

* use gh-pages branch deployment to bypass environment protection ([9f5a638](https://github.com/kqesar/alltp-tracker/commit/9f5a638f8bd9eb0f7a6fded82d7c35f51630d0b9))

### [1.2.1](https://github.com/kqesar/alltp-tracker/compare/v1.2.0...v1.2.1) (2025-08-06)


### 🐛 Bug Fixes

* simplify GitHub Pages deployment workflow ([3a7298d](https://github.com/kqesar/alltp-tracker/commit/3a7298da1e61ae3e3954c94583b28095638e62b0))

## [1.2.0](https://github.com/kqesar/alltp-tracker/compare/v1.1.1...v1.2.0) (2025-08-06)


### ✨ Features

* add automated GitHub Pages deployment workflow ([bca71c2](https://github.com/kqesar/alltp-tracker/commit/bca71c2b4be2104bacffd7fa80420a30cf92a85e))

### [1.1.1](https://github.com/kqesar/alltp-tracker/compare/v1.1.0...v1.1.1) (2025-08-06)

## 1.1.0 (2025-08-06)


### ✨ Features

* add chests ([5b61f7b](https://github.com/kqesar/alltp-tracker/commit/5b61f7b5a6793549536e47b9865b150af763a41e))
* add dependabot [#20](https://github.com/kqesar/alltp-tracker/issues/20) ([83c5fad](https://github.com/kqesar/alltp-tracker/commit/83c5fad3d37efe5cb87b86cab9bf4466116eb280))
* add react version ([6a82206](https://github.com/kqesar/alltp-tracker/commit/6a82206e673d2e25dd276172d063b9b177afaa55))
* add rewards management ([b43fc70](https://github.com/kqesar/alltp-tracker/commit/b43fc70dcd77579c11148398c55c3d2d9c8e2d9a))
* add tailwind ([17fd06d](https://github.com/kqesar/alltp-tracker/commit/17fd06dcb2d9bb14bc89d68678391de5911ffb9e))
* bump packages and remove yarn ([cbb33ea](https://github.com/kqesar/alltp-tracker/commit/cbb33ea53c30b250b80c01106fb0d9fcb83c8203))
* bump sass ([4db8f30](https://github.com/kqesar/alltp-tracker/commit/4db8f30018b50d76f60fede033624f1e33307a4d))
* evolve react version ([5f67908](https://github.com/kqesar/alltp-tracker/commit/5f67908c7e729132999ea06859f113e9f299efda))
* medaillon management ([de560dc](https://github.com/kqesar/alltp-tracker/commit/de560dca43b8b410d643d9a4c46c5c83669f915e))
* optimize app.tsx ([2172d8a](https://github.com/kqesar/alltp-tracker/commit/2172d8ae361958a8491aebf6b5581533e3d72ab2))
* remove codeQL workflow ([1e5e74e](https://github.com/kqesar/alltp-tracker/commit/1e5e74e010959fb5d1e351f4c66e555b8056e2db))
* remove settings ([d4ca121](https://github.com/kqesar/alltp-tracker/commit/d4ca121d06147f206b54b9f2b3dcc39772b8a85b))
* update License ([fda378e](https://github.com/kqesar/alltp-tracker/commit/fda378e2e85aff932200bb7153b92ef1db855936))
* update vscode config, delete useless file and update README ([0761dc2](https://github.com/kqesar/alltp-tracker/commit/0761dc2e15bc675759d1fd9dfcc3e5570023bd67))


### 🐛 Bug Fixes

* fix URL to git clone repository [#24](https://github.com/kqesar/alltp-tracker/issues/24) ([0157b68](https://github.com/kqesar/alltp-tracker/commit/0157b68cfe22ee2e09b7fd5c5b4e919454b116b2))
* **global:** fix test stup file ([92fa835](https://github.com/kqesar/alltp-tracker/commit/92fa8359123cb41c8715d8cc813700fa2ab8836d))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### ✨ Features

- **react**: Add React 19 version with TypeScript support
- **tracker**: Add item tracking with visual feedback system
- **map**: Add interactive map with chest and dungeon tracking
- **bosses**: Add boss overlays with medallion, chest count, and reward tracking
- **medallions**: Add medallion management for Misery Mire and Turtle Rock
- **rewards**: Add crystal/pendant reward tracking for each dungeon boss
- **ui**: Add dynamic caption system with hover information
- **build**: Add Vite build system with HMR
- **styling**: Add Tailwind CSS for modern styling
- **testing**: Add Vitest with React Testing Library
- **quality**: Add Biome for linting and formatting

### 🐛 Bug Fixes

- **css**: Fix CSS import paths and styling issues
- **images**: Fix image links for lumberjack tree
- **build**: Fix asset paths for production builds
- **dependencies**: Update vulnerable dependencies

### 📚 Documentation

- **readme**: Add comprehensive documentation for installation and usage
- **license**: Update MIT license with correct copyright information
- **deps**: Add dependabot configuration for automated dependency updates

### 🔧 Code Refactoring

- **legacy**: Migrate from legacy JavaScript to modern React with TypeScript
- **components**: Refactor code into modular, reusable components
- **state**: Implement proper state management with React hooks
- **variables**: Change var declarations to let/const for better scoping

### 📦 Build System

- **vite**: Replace Grunt with Vite for modern build tooling
- **typescript**: Add TypeScript configuration for type safety
- **pnpm**: Switch from yarn to pnpm for package management

### 👷 CI/CD

- **github**: Add GitHub workflows for automated testing and deployment
- **codeql**: Add CodeQL analysis for security scanning
- **dependabot**: Configure automated dependency updates

---

## Previous Legacy Commits (Pre-React)

### Legacy Features (2017-2023)
- Initial tracker implementation with vanilla JavaScript
- SCSS styling with Grunt build system
- Basic item tracking functionality
- Overworld chest tracking
- Dungeon boss tracking
- Live reload development setup

### Legacy Fixes
- CSS path corrections
- Image loading fixes
- Dependency security updates
- Build system improvements

---

*This changelog follows the [Conventional Commits](https://conventionalcommits.org/) specification.*
