#!/bin/sh
# POSIX entry point; Python handles validation and recoverable directory swaps.
set -eu

case "$(uname -s)" in
    Darwin|Linux) ;;
    *) printf '%s\n' 'Error: Only macOS and Linux are supported. Run this installer on the computer that hosts your desktop app.' >&2; exit 1 ;;
esac

if [ "${1-}" = '--help' ]; then
    printf '%s\n' 'Usage: sh install.sh [--variant classic|winter] [--codex-home PATH]' \
        'Default variant: classic. Both variants can be installed side by side.' \
        'Requires curl, Python 3.8+, and an existing Codex home directory.' \
        'Uses CODEX_HOME, or ~/.codex when unset. Installs files without selecting a pet.'
    exit 0
fi
for dependency in curl python3; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Error: %s is required. Install it using your OS package manager, then retry.\n' "$dependency" >&2
        exit 1
    fi
done

python3 - "$@" <<'PY'
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile

REPOSITORY = 'MeFoDy/coderun-cat-pet'
FILES = ('pet.json', 'spritesheet.webp')
VARIANTS = {
    'classic': ('pet', 'coderun-cat', 'CodeRun Cat'),
    'winter': ('pet-winter', 'coderun-cat-winter', 'CodeRun Cat — Winter'),
}


class InstallError(Exception):
    pass


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url, destination):
    result = subprocess.run([
        'curl', '--fail', '--silent', '--show-error', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2',
        '--connect-timeout', '15', '--max-time', '120', '--retry', '2',
        '--max-filesize', str(20 * 1024 * 1024),
        '--output', str(destination), url,
    ])
    if result.returncode:
        raise InstallError('Could not download ' + destination.name + '. Check your internet connection, '
                           'proxy, and access to api.github.com and raw.githubusercontent.com. '
                           'If GitHub reports a rate limit, wait and retry. '
                           'Your existing pet was not changed.')


def resolve_main(stage):
    metadata = stage / '.source.json'
    download('https://api.github.com/repos/' + REPOSITORY + '/git/ref/heads/main', metadata)
    response = json.loads(metadata.read_text(encoding='utf-8'))
    obj = response.get('object', {}) if isinstance(response, dict) else {}
    obj = obj if isinstance(obj, dict) else {}
    commit = obj.get('sha')
    if obj.get('type') != 'commit' or not isinstance(commit, str) or not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise InstallError('GitHub returned an invalid main branch reference. Retry later with the official installer.')
    metadata.unlink()
    return commit


def read_hashes(stage):
    checksums = stage / 'SHA256SUMS'
    hashes = {}
    for line in checksums.read_text(encoding='utf-8').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (pet\.json|spritesheet\.webp)', line)
        if not match or match[2] in hashes:
            raise InstallError('Invalid or duplicate package checksum. The maintainer must update SHA256SUMS in main.')
        hashes[match[2]] = match[1]
    if set(hashes) != set(FILES):
        raise InstallError('Missing package checksums. The maintainer must update SHA256SUMS in main.')
    checksums.unlink()
    return hashes


def validate(stage, hashes, pet_id):
    for name, expected in hashes.items():
        path = stage / name
        if not path.is_file() or digest(path) != expected:
            raise InstallError('Checksum verification failed for ' + name +
                               '. Retry with the official installer. If this persists, ask the maintainer '
                               'to update SHA256SUMS alongside the assets in main.')
    manifest = json.loads((stage / 'pet.json').read_text(encoding='utf-8'))
    if not isinstance(manifest, dict) or (
            manifest.get('id'), manifest.get('spriteVersionNumber'), manifest.get('spritesheetPath')) != (
            pet_id, 2, 'spritesheet.webp'):
        raise InstallError('The pet manifest is incompatible. Download a supported CodeRun Cat release.')
    data = (stage / 'spritesheet.webp').read_bytes()
    # The package uses a lossless VP8L WebP. Check its container/header too.
    if (len(data) < 25 or data[:4] != b'RIFF' or data[8:12] != b'WEBP' or data[12:16] != b'VP8L'
            or data[20:21] != b'\x2f' or struct.unpack('<I', data[4:8])[0] + 8 != len(data)):
        raise InstallError('Invalid lossless WebP package. Download the official release again.')
    bits = struct.unpack('<I', data[21:25])[0]
    if ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1, (bits >> 28) & 1) != (1536, 2288, 1):
        raise InstallError('The spritesheet must be a transparent 1536x2288 WebP. Use the official release.')


def interrupted(signum, frame):
    raise InstallError('Installation interrupted. Retry when ready.')


def install():
    if sys.version_info < (3, 8):
        raise InstallError('Python 3.8 or newer is required. Upgrade Python 3, then retry.')
    if os.geteuid() == 0:
        raise InstallError('Do not run this installer as root or with sudo. Run it as your desktop user.')
    kernel = Path('/proc/sys/kernel/osrelease')
    if (os.environ.get('WSL_INTEROP') or os.environ.get('WSL_DISTRO_NAME')
            or (kernel.is_file() and 'microsoft' in kernel.read_text().lower())):
        raise InstallError('WSL is not supported. This installer targets native macOS and Linux profiles; '
                           'it cannot install into your Windows desktop app.')
    args = sys.argv[1:]
    options = dict(zip(args[::2], args[1::2]))
    if len(args) != len(options) * 2 or options.keys() - {'--codex-home', '--variant'}:
        raise InstallError('Unknown or incomplete argument. Run sh install.sh --help for usage.')
    variant = options.get('--variant', 'classic')
    if variant not in VARIANTS:
        raise InstallError('Unknown variant. Use --variant classic or --variant winter.')
    package, pet_id, display_name = VARIANTS[variant]
    raw_home = options.get('--codex-home', os.environ.get('CODEX_HOME', str(Path.home() / '.codex')))
    if not raw_home or not Path(raw_home).expanduser().is_absolute():
        raise InstallError('Codex home must be a non-empty absolute path. Use --codex-home /absolute/path.')
    home = Path(raw_home).expanduser().resolve()
    if not home.is_dir():
        raise InstallError('Codex home does not exist: ' + str(home) +
                           '. Open and set up the desktop app first, or pass --codex-home with its actual directory.')
    if not os.access(home, os.W_OK | os.X_OK):
        raise InstallError('Codex home is not writable: ' + str(home) +
                           '. Check ownership and permissions; do not use sudo to bypass this check.')
    pets = home / 'pets'
    target = pets / pet_id
    backups = home / 'pet-backups'
    for directory in (pets, target, backups):
        if directory.is_symlink() or (directory.exists() and not directory.is_dir()):
            raise InstallError('Expected a real directory, not a file or symlink: ' + str(directory) +
                               '. Move it aside or choose the correct Codex home, then retry.')
    if pets.exists() and not os.access(pets, os.W_OK | os.X_OK):
        raise InstallError('The pets directory is not writable. Fix its permissions as your desktop user, then retry.')
    if shutil.disk_usage(home).free < 10 * 1024 * 1024:
        raise InstallError('At least 10 MiB of free space is required in Codex home. Free some space, then retry.')

    lock = home / '.coderun-cat-install.lock'
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise InstallError('Another installation may be running. Wait for it to finish. If none is running, '
                           'remove ' + str(lock) + ' and retry.')
    stage = None
    backup = None
    moved_old = False
    installed = False
    committed = False
    try:
        stage = Path(tempfile.mkdtemp(prefix='.coderun-cat-stage-', dir=str(home)))
        # Resolve main once so a branch update cannot mix package versions.
        commit = resolve_main(stage)
        base_url = 'https://raw.githubusercontent.com/' + REPOSITORY + '/' + commit + '/' + package + '/'
        download(base_url + 'SHA256SUMS', stage / 'SHA256SUMS')
        hashes = read_hashes(stage)
        for name in FILES:
            download(base_url + name, stage / name)
        validate(stage, hashes, pet_id)
        if target.is_dir() and all((target / name).is_file() and digest(target / name) == expected
                                   for name, expected in hashes.items()):
            print(display_name + ' is already up to date.')
        else:
            pets.mkdir(exist_ok=True)
            if target.exists():
                backups.mkdir(mode=0o700, exist_ok=True)
                backup = Path(tempfile.mkdtemp(prefix=pet_id + '-', dir=str(backups))) / pet_id
                os.rename(target, backup)
                moved_old = True
            os.rename(stage, target)
            installed = True
            validate(target, hashes, pet_id)
            committed = True
        print(r'''
 /\_/\
( o.o )
 > ^ <
''')
        print('Success! ' + display_name + ' files are installed and verified.')
        print('Installation: ' + str(target))
        print('Source: main at commit ' + commit)
        if backup:
            print('Previous installation backup: ' + str(backup))
        print('Open Settings > Pets, click Refresh, and select ' + display_name + '.')
        print('If it does not appear, update to an app version supporting custom v2 pets and check workspace pet settings.')
        print('App compatibility and activation have not been verified by this installer.')
    finally:
        try:
            if not committed and installed:
                os.rename(target, stage)
            if not committed and moved_old:
                os.rename(backup, target)
                print('Previous installation restored.', file=sys.stderr)
        except OSError as error:
            # Keep recovery files when automatic rollback cannot complete.
            raise InstallError('Automatic recovery failed: ' + str(error) +
                               '. Preserve and restore your backup at ' + str(backup) +
                               '; staged files are at ' + str(stage) + '.') from error
        else:
            if stage is not None and stage.exists():
                shutil.rmtree(stage)
            if backup is not None and not backup.exists():
                backup.parent.rmdir()
        finally:
            lock.rmdir()


signal.signal(signal.SIGTERM, interrupted)
signal.signal(signal.SIGHUP, interrupted)
try:
    install()
except (InstallError, OSError, ValueError, KeyboardInterrupt) as error:
    message = str(error) or 'Installation interrupted. Retry when ready.'
    print('Error: ' + message, file=sys.stderr)
    if isinstance(error, OSError):
        print('Check available disk space and directory permissions, then retry as your desktop user.', file=sys.stderr)
    sys.exit(1)
PY
