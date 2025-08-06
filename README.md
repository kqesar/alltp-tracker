# GitHub Pages Branch

This branch contains the built assets for GitHub Pages deployment.

The content is automatically generated and deployed by GitHub Actions from the `master` branch.

## Deployment Process

1. Push to `master` triggers the deployment workflow
2. The app is built using `pnpm build`
3. Tests and linting are run to ensure quality
4. A PR is created with the built assets
5. If all checks pass, the PR is auto-merged
6. The built assets are deployed to GitHub Pages

## Live Site

The tracker is available at: https://kqesar.github.io/alltp-tracker/

---

*This branch is managed automatically. Do not make manual changes.*
