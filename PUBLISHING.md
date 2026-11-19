# Publish The Speaking Hand on GitHub

## Create repository

1. Sign in to https://github.com and choose **New repository**.
2. Repository name: `the-speaking-hand`; visibility: **Public** (if you want other players to install it).
3. **Do not** add an auto-generated README (this repository includes one).
4. Create the repository and upload the contents of this folder using **Add file → Upload files**. Upload files and folders **inside** `the-speaking-hand`, not its enclosing folder. The `.github/workflows/release.yml` workflow must also be uploaded. GitHub's website may handle hidden `.github` folder uploads differently; using GitHub Desktop is more reliable for preserving folders.
5. Commit the upload to the default branch (normally `main`).

## Create first release

1. Open the GitHub repo and choose **Releases → Draft a new release**.
2. Choose **Create new tag** and enter `v1.14.0`, targeting `main`.
3. Release title: `The Speaking Hand v1.14.0`.
4. Publish the release.
5. Open **Actions** and watch **Build Foundry release**. The workflow attaches `module.json` and `the-speaking-hand.zip` to that release. If action permissions block the upload, go to repository **Settings → Actions → General** and allow GitHub Actions read and write permissions, or adjust your repository policy as permitted.
6. Verify both files exist under release Assets. The manifest should be a JSON file, not HTML.

## Install from Foundry

Use `https://github.com/YOUR-USERNAME/the-speaking-hand/releases/latest/download/module.json` in **Install Module → Manifest URL** (replace the username). Enable the module in the world.

## Updating

1. Edit source files; update version in `module.json`, e.g. `1.14.1`.
2. Push changes to `main`.
3. Publish a release with tag `v1.14.1`. The workflow builds the matching ZIP + manifest.
4. Do not change module `id` or its folder name unless planning and implementing a data migration.

## Important

- The module's current turn sound uses a synthesized tone. A Forge file-picker custom audio-upload feature is not yet in this release.
- This repository does not include the separately hosted Discord bot.
- Keep Discord bridge keys, bot tokens, private assets and campaign data out of a public GitHub repository.
- No license is included; determine the license you want before asking others to contribute or redistribute code.
