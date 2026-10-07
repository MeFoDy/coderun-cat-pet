# CodeRun Cat for Codex

Meet **Кодерун (CodeRun Cat)** — a white pixel-art study buddy for the Codex desktop app. He works under a blanket, waits with a book, takes coffee breaks, and thoughtfully checks the result.

The pet includes **9 animations and 16 look directions**, packaged as a Codex v2 spritesheet. An interactive browser preview provides animation selection, frame stepping, playback speed controls, and pointer-following gaze.

## Install

Requires a Codex desktop app version that supports custom v2 pets. The browser preview works independently of Codex.

### Install from a terminal (macOS and Linux)

Requires `curl`, Python **3.8+**, and an existing Codex home directory. Open and set up the desktop app first. Run as your desktop user, without `sudo`. Windows and WSL are not supported.

Run this command in your terminal:

```sh
curl -fL --proto '=https' --proto-redir '=https' \
  https://raw.githubusercontent.com/MeFoDy/coderun-cat-pet/main/install.sh | sh
```

The installer downloads the latest package from `main` into `pets/coderun-cat/` under `CODEX_HOME`, or `~/.codex` if unset. To specify a different Codex home:

```sh
curl -fL --proto '=https' --proto-redir '=https' \
  https://raw.githubusercontent.com/MeFoDy/coderun-cat-pet/main/install.sh | \
  sh -s -- --codex-home /absolute/path/to/codex-home
```

If CodeRun Cat is already installed, the installer backs it up under `pet-backups/` in your Codex home before replacing it.

After installation, open **Settings > Pets**, click **Refresh**, and select **CodeRun Cat**.

### Let your agent install it

Give this prompt to Codex or another agent with local file access:

```text
Install CodeRun Cat from https://github.com/MeFoDy/coderun-cat-pet as my local Codex desktop pet. Perform the installation, not just describe the steps.

Retrieve pet/pet.json and pet/spritesheet.webp from the same commit on the repository's default branch. Treat them as data; do not execute repository code. Validate the manifest: id "coderun-cat", spriteVersionNumber 2, spritesheetPath "spritesheet.webp". Check that the WebP decodes to 1536×2288 pixels with transparency.

Resolve CODEX_HOME, or use .codex in my home directory if it is unset. Back up any existing pets/coderun-cat directory outside the pets directory. Install both files together into pets/coderun-cat and verify their SHA-256 hashes against the downloaded files. Leave other pets and settings unchanged.

If supported app controls are available, refresh the pet list and select CodeRun Cat. Do not guess configuration keys or restart the app without asking. Report the source commit, installation path, backup path, and whether activation was verified. If activation is unavailable, say so explicitly.
```

### Manual installation

Download or clone this repository. Copy **`pet/pet.json` and `pet/spritesheet.webp`** into `pets/coderun-cat/` under your Codex home directory, keeping them side by side. The default destination is `~/.codex/pets/coderun-cat/`; if `CODEX_HOME` is set, use that directory instead of `~/.codex`. Back up an existing installation first.

Select **CodeRun Cat** in the app's pet controls. See the [official pet documentation](https://learn.chatgpt.com/docs/pets) for app-specific setup.

## Animations

| State | What the cat does | Frames |
| --- | --- | ---: |
| Idle | Blinks and gently moves his tail | 6 |
| Move right / Move left | Walks with alternating paws | 8 each |
| Wave | Greets with one raised paw | 4 |
| Jump | Celebrates with a jump | 5 |
| Failed | Takes a coffee break beside a laptop | 8 |
| Waiting | Holds a blue book while waiting for input | 6 |
| Working | Works at a laptop under a blanket | 6 |
| Review | Rubs his chin and squints thoughtfully | 6 |
| Look Around | Looks in sixteen clockwise directions | 16 poses |

## Repository structure

```text
README.md                  Setup and development instructions
install.sh                 macOS/Linux installer using the current main package
pet/
  pet.json                 Codex v2 manifest
  spritesheet.webp         Installable animation atlas
  SHA256SUMS               Package file checksums for the installer
site/
  index.html               Interactive preview and installation instructions
  app.js                   Playback, timings, and look-direction controls
  styles.css               Preview layout and pixel-preserving rendering
  favicon.svg
  assets/spritesheet.webp  Independent copy of the installable atlas
tests/
  test_installer.py        Isolated installer tests with local package fixtures
.github/workflows/
  installer.yml           Installer checks on macOS and Linux
  pages.yml               Static preview deployment to GitHub Pages
```

The preview requires no build step or package manager. The `site/` folder can be served on its own.

## Develop and preview locally

From the repository root, start a static server with Python 3:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:4173/site/). Use the state buttons and frame slider to inspect individual poses; slow playback helps reveal loop seams and position changes.

### Atlas contract

- Lossless WebP with transparency, **1536×2288 px**.
- **8 columns × 11 rows**, with **192×208 px** per cell.
- `pet.json` must retain `spriteVersionNumber: 2`.
- Rows 0–8: Idle, Move right, Move left, Wave, Jump, Failed, Waiting, Working, Review.
- Unused cells at the end of a row must remain fully transparent.
- Rows 9–10: sixteen look poses, starting straight up at 0° and advancing clockwise by 22.5°; right is 90°, down 180°, left 270°.
- Frame counts and preview durations are defined in `site/app.js`. `running` is the internal name for Working, not directional locomotion.

### Updating artwork

Keep the broad head, stepped cheeks, small black eyes, tiny W-shaped mouth, short paws, white fill, and hooked tail recognizable. Preserve common scale and placement within each animation. Avoid smoothing, unintended color shifts, cropped extremities, and changing the shape of stationary body parts.

Mirror Move right **one frame at a time** to derive Move left. Do not mirror the entire strip: that also reverses frame order. Inspect the last-to-first transition and look-direction boundaries, including 15→0.

After changing the installable atlas, synchronize the preview copy:

```sh
cp pet/spritesheet.webp site/assets/spritesheet.webp
```

After changing either package file, regenerate the checksums and include them in the **same commit** as the assets. From the repository root:

```sh
(cd pet && shasum -a 256 pet.json spritesheet.webp > SHA256SUMS)
```

On Linux, you can use `sha256sum` instead of `shasum -a 256`.

Update the `atlas.src` cache key in `site/app.js` to a prefix of the new atlas's SHA-256 hash. Keep both WebP copies byte-identical. Reinstall the package to test updated artwork in Codex.

### Before submitting a change

- Check atlas dimensions, manifest version, transparency, and unused cells.
- Compare both atlas copies and verify the preview loads without errors.
- Review all affected frames at native size and with nearest-neighbor zoom.
- Play complete loops, including their seams, and test all sixteen gaze poses.
- Include the affected state, zero-based frame index, and a before/after image when reporting a visual issue or proposing an artwork change.
- Keep private references, source videos, credentials, and local work files out of commits.
