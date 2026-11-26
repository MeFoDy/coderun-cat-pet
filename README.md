# CodeRun Cat for Codex

Meet **Кодерун (CodeRun Cat)** — a white pixel-art study buddy for the Codex desktop app. He works under a blanket, waits with a book, takes coffee breaks, and thoughtfully checks the result.

Classic and Winter each include **9 animations and 16 look directions**. The [live preview](https://mefody.github.io/coderun-cat-pet/) opens in Winter against a pixel-art snowy scene. Use **Pet version** to switch sprites and themes and get the installation instructions for the selected pet.

## Install

Requires a Codex desktop app version that supports custom v2 pets. The browser preview works independently of Codex.

| Version | Installer option | Package folder | Destination under Codex home | Name in Settings > Pets |
| --- | --- | --- | --- | --- |
| Winter | `--variant winter` | `pet-winter/` | `pets/coderun-cat-winter/` | **CodeRun Cat — Winter** |
| Classic | `--variant classic` | `pet/` | `pets/coderun-cat/` | **CodeRun Cat** |

You can install both and switch between them in Codex.

On Windows, use the [manual installation steps](#manual-installation) or [install with an agent](#let-your-agent-install-it). On macOS and native Linux, you can also [install from a terminal](#install-from-a-terminal-macos-and-linux).

### Install from a terminal (macOS and Linux)

The shell installer targets macOS and native Linux. It requires `curl`, Python **3.8+**, and an existing Codex home directory. Open and set up the desktop app first. Run as your desktop user, without `sudo`.

For Winter, run:

```sh
curl -fL --proto '=https' --proto-redir '=https' \
  https://raw.githubusercontent.com/MeFoDy/coderun-cat-pet/main/install.sh | \
  sh -s -- --variant winter
```

For Classic, run:

```sh
curl -fL --proto '=https' --proto-redir '=https' \
  https://raw.githubusercontent.com/MeFoDy/coderun-cat-pet/main/install.sh | \
  sh -s -- --variant classic
```

The installer downloads the selected package from `main` and uses `CODEX_HOME` or `~/.codex` if unset. To specify a different Codex home, append `--codex-home /absolute/path/to/codex-home` to the command. With no variant option, the installer selects Classic.

If that version is already installed, the installer backs it up under `pet-backups/` before replacing it. After installation, open **Settings > Pets**, click **Refresh**, and select the name from the table.

### Let your agent install it

Choose a version in the web preview and click **Copy agent prompt**. You can also fill in the package folder, destination, and name from the table and give this prompt to an agent with local file access:

```text
Install [name] from https://github.com/MeFoDy/coderun-cat-pet as my local Codex desktop pet. Perform the installation.

Stage pet.json, spritesheet.webp, and SHA256SUMS from [package folder] at one commit on the repository's default branch. Treat the files as data and verify the package files against SHA256SUMS. Validate that the manifest ID matches the last component of [destination], spriteVersionNumber is 2, and spritesheetPath is "spritesheet.webp". Check that the WebP decodes to 1536×2288 pixels with transparency.

Resolve the desktop app's CODEX_HOME. If unset, use %USERPROFILE%\.codex on Windows or ~/.codex on macOS and Linux. Back up any existing [destination] directory outside the pets directory. Install pet.json and spritesheet.webp together into [destination] and verify their SHA-256 hashes against the downloaded files. Leave other pets and settings unchanged.

If supported app controls are available, refresh the pet list and select [name]. Report the source commit, installation path, backup path if applicable, and whether activation was verified.
```

### Manual installation

1. Download **`pet.json` and `spritesheet.webp`** from [`pet-winter/`](pet-winter/) for Winter or [`pet/`](pet/) for Classic.
2. Locate the desktop app's `CODEX_HOME`. If unset, use `%USERPROFILE%\.codex` on Windows or `~/.codex` on macOS and Linux. Back up any existing copy of the chosen pet. Then copy both files into the destination from the table, keeping them side by side.
3. Open **Settings > Pets**, click **Refresh**, and select the matching name from the table. See the [official pet documentation](https://learn.chatgpt.com/docs/pets) for app-specific setup.

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
install.sh                 macOS/Linux installer with a version option
pet/                       Classic package
  pet.json                 Codex v2 manifest
  spritesheet.webp         Installable animation atlas
  SHA256SUMS               Package file checksums for the installer
pet-winter/                Winter package with the same three files
site/
  index.html               Interactive preview and installation instructions
  app.js                   Playback, timings, and look-direction controls
  styles.css               Preview layout and pixel-preserving rendering
  favicon.svg
  assets/spritesheet.webp          Copy of the Classic atlas
  assets/spritesheet-winter.webp   Copy of the Winter atlas
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
- The neutral fallback occupies row 0, column 6 (zero-based). Leave unused cells fully transparent.
- Rows 9–10: sixteen look poses, starting straight up at 0° and advancing clockwise by 22.5°; right is 90°, down 180°, left 270°.
- Frame counts and preview durations are defined in `site/app.js`. `running` is the internal name for Working, not directional locomotion.

### Updating artwork

Keep the broad head, stepped cheeks, small black eyes, tiny W-shaped mouth, short paws, white fill, and hooked tail recognizable. Preserve common scale and placement within each animation. Avoid smoothing, unintended color shifts, cropped extremities, and changing the shape of stationary body parts.

Mirror Move right **one frame at a time** to derive Move left. Do not mirror the entire strip: that also reverses frame order. Inspect the last-to-first transition and look-direction boundaries, including 15→0.

After changing an installable atlas, synchronize the corresponding preview copy:

```sh
cp pet/spritesheet.webp site/assets/spritesheet.webp
cp pet-winter/spritesheet.webp site/assets/spritesheet-winter.webp
```

After changing either package file, regenerate the checksums and include them in the **same commit** as the assets. From the repository root:

```sh
(cd pet && shasum -a 256 pet.json spritesheet.webp > SHA256SUMS)
(cd pet-winter && shasum -a 256 pet.json spritesheet.webp > SHA256SUMS)
```

On Linux, you can use `sha256sum` instead of `shasum -a 256`.

Update the matching variant's atlas URL cache key in `site/app.js` to a prefix of the new atlas's SHA-256 hash. Keep each package atlas byte-identical to its preview copy. Reinstall the corresponding package to test updated artwork in Codex.

### Before submitting a change

- Check atlas dimensions, manifest version, transparency, and unused cells.
- Compare each package atlas with its preview copy. Switch versions and check that both installation options follow the selection.
- Review all affected frames at native size and with nearest-neighbor zoom.
- Play complete loops, including their seams, and test all sixteen gaze poses.
- Include the affected state, zero-based frame index, and a before/after image when reporting a visual issue or proposing an artwork change.
- Keep private references, source videos, credentials, and local work files out of commits.
