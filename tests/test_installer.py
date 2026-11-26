"""Exercise the real shell installer with local fixtures; no network or real profile writes."""
import os
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='coderun-installer-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / 'profile with spaces'
        self.home.mkdir()
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, CODEX_HOME=str(self.home), FIXTURE=str(ROOT / 'pet'))
        self.env['PATH'] = str(self.bin) + os.pathsep + self.env['PATH']
        self.stub('curl', '''import json, os, pathlib, shutil, sys
if os.environ.get('INTERRUPT_DOWNLOAD'):
    import signal
    os.kill(os.getppid(), signal.SIGTERM)
    sys.exit(22)
if os.environ.get('FAIL_DOWNLOAD'):
    sys.exit(22)
dest = pathlib.Path(sys.argv[sys.argv.index('--output') + 1])
if os.environ.get('REQUEST_LOG'):
    with open(os.environ['REQUEST_LOG'], 'a') as log:
        log.write(sys.argv[-1] + '\\n')
if sys.argv[-1].endswith('/git/ref/heads/main'):
    commit = os.environ.get('MAIN_SHA', 'a' * 40)
    dest.write_text(json.dumps({'object': {'type': 'commit', 'sha': commit}}))
    sys.exit(0)
shutil.copyfile(pathlib.Path(os.environ['FIXTURE']) / sys.argv[-1].rsplit('/', 1)[-1], dest)
if os.environ.get('CORRUPT_DOWNLOAD') and dest.name == 'spritesheet.webp':
    dest.write_bytes(b'corrupt')
''')
        self.stub('python3', '''import os, sys
sys.argv = sys.argv[1:]
if os.environ.get('SIMULATE_ROOT'):
    os.geteuid = lambda: 0
source = sys.stdin.read()
if os.environ.get('FAIL_VERIFY'):
    source = source.replace('            validate(target, hashes, pet_id)', '            raise OSError("Simulated verification failure")')
exec(compile(source, '<installer>', 'exec'))
''')

    def stub(self, name, source):
        path = self.bin / name
        path.write_text('#!' + sys.executable + '\n' + source)
        path.chmod(0o755)

    def run_installer(self, *args, ok=True):
        result = subprocess.run(['/bin/sh', str(ROOT / 'install.sh'), *args],
                                env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stdout + result.stderr)
        if not ok:
            self.assertIn('Error:', result.stderr)
            self.assertNotIn('Success!', result.stdout)
        return result

    def seed_old(self):
        target = self.home / 'pets' / 'coderun-cat'
        target.mkdir(parents=True)
        (target / 'old.txt').write_text('previous pet')
        other = self.home / 'pets' / 'other-pet'
        other.mkdir()
        (other / 'keep.txt').write_text('untouched')
        return target

    def assert_clean(self):
        self.assertFalse((self.home / '.coderun-cat-install.lock').exists())
        self.assertEqual(list(self.home.glob('.coderun-cat-stage-*')), [])

    def test_install_and_repeat(self):
        result = self.run_installer()
        self.assertIn('Success!', result.stdout)
        self.assertIn('( o.o )', result.stdout)
        self.assertIn('activation have not been verified', result.stdout)
        for name in ('pet.json', 'spritesheet.webp'):
            self.assertEqual((self.home / 'pets' / 'coderun-cat' / name).read_bytes(),
                             (ROOT / 'pet' / name).read_bytes())
        self.assertIn('already up to date', self.run_installer().stdout)
        self.assertFalse((self.home / 'pet-backups').exists())
        self.assert_clean()

    def test_variants_install_side_by_side(self):
        self.run_installer('--variant', 'classic')
        classic = self.home / 'pets' / 'coderun-cat'
        winter = self.home / 'pets' / 'coderun-cat-winter'
        log = self.root / 'requests.txt'
        self.env['REQUEST_LOG'] = str(log)
        self.env['FIXTURE'] = str(ROOT / 'pet-winter')
        result = self.run_installer('--codex-home', str(self.home), '--variant', 'winter')
        self.assertIn('select CodeRun Cat — Winter', result.stdout)
        for name in ('pet.json', 'spritesheet.webp'):
            self.assertEqual((classic / name).read_bytes(), (ROOT / 'pet' / name).read_bytes())
            self.assertEqual((winter / name).read_bytes(), (ROOT / 'pet-winter' / name).read_bytes())
        self.assertTrue(all('/pet-winter/' in url for url in log.read_text().splitlines()[1:]))
        self.assertIn('already up to date', self.run_installer('--variant', 'winter').stdout)
        self.assertFalse((self.home / 'pet-backups').exists())
        self.assert_clean()

    def test_winter_rejects_classic_manifest(self):
        result = self.run_installer('--variant', 'winter', ok=False)
        self.assertIn('manifest is incompatible', result.stderr)
        self.assertFalse((self.home / 'pets').exists())
        self.assert_clean()

    def test_install_from_stdin_without_saving_script(self):
        result = subprocess.run(
            ['/bin/sh', '-s', '--', '--codex-home', str(self.home)],
            input=(ROOT / 'install.sh').read_text(), env=self.env,
            cwd=self.root, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Success!', result.stdout)
        self.assertTrue((self.home / 'pets' / 'coderun-cat' / 'pet.json').is_file())
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ['bin', 'profile with spaces'])
        self.assert_clean()

    def test_backup_preserves_previous_and_other_pets(self):
        self.seed_old()
        self.run_installer()
        backup = list((self.home / 'pet-backups').glob('*/coderun-cat/old.txt'))
        self.assertEqual(len(backup), 1)
        self.assertEqual(backup[0].read_text(), 'previous pet')
        self.assertEqual((self.home / 'pets' / 'other-pet' / 'keep.txt').read_text(), 'untouched')
        self.assert_clean()

    def test_download_failure_and_checksum_mismatch_preserve_old(self):
        target = self.seed_old()
        for flag in ('FAIL_DOWNLOAD', 'CORRUPT_DOWNLOAD'):
            self.env[flag] = '1'
            self.run_installer(ok=False)
            self.assertEqual((target / 'old.txt').read_text(), 'previous pet')
            self.assert_clean()
            del self.env[flag]

    def test_rollback_after_install(self):
        target = self.seed_old()
        self.env['FAIL_VERIFY'] = '1'
        result = self.run_installer(ok=False)
        self.assertIn('Previous installation restored', result.stderr)
        self.assertEqual((target / 'old.txt').read_text(), 'previous pet')
        self.assertEqual(list((self.home / 'pet-backups').iterdir()), [])
        self.assert_clean()

    def test_missing_home_empty_home_and_relative_home(self):
        for value in (str(self.root / 'missing'), '', 'relative'):
            self.env['CODEX_HOME'] = value
            self.run_installer(ok=False)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_explicit_home_and_default_home(self):
        self.env['CODEX_HOME'] = '/missing'
        self.run_installer('--codex-home', str(self.home))
        del self.env['CODEX_HOME']
        self.env['HOME'] = str(self.root)
        (self.root / '.codex').mkdir()
        self.run_installer()
        self.assertTrue((self.root / '.codex' / 'pets' / 'coderun-cat' / 'pet.json').exists())

    def test_symlinks_and_files_are_rejected(self):
        for relative in ('pets', 'pets/coderun-cat', 'pet-backups'):
            path = self.home / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.symlink_to(self.root, target_is_directory=True)
            self.assertIn('symlink', self.run_installer(ok=False).stderr)
            path.unlink()
            path.write_text('not a directory')
            self.run_installer(ok=False)
            path.unlink()
        self.assert_clean()

    def test_lock_and_arguments(self):
        lock = self.home / '.coderun-cat-install.lock'
        lock.mkdir()
        self.assertIn('Another installation', self.run_installer(ok=False).stderr)
        self.assertTrue(lock.exists())
        lock.rmdir()
        self.run_installer('--codex-home', ok=False)
        self.run_installer('--unknown', ok=False)
        self.run_installer('--variant', 'unknown', ok=False)
        self.assertIn('Usage:', self.run_installer('--help').stdout)

    def test_unsupported_os(self):
        self.stub('uname', 'print("MINGW64_NT")\n')
        self.assertIn('Only macOS and Linux', self.run_installer(ok=False).stderr)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_linux_entry_point(self):
        self.stub('uname', 'print("Linux")\n')
        self.run_installer()

    def test_wsl_rejected(self):
        self.env['WSL_DISTRO_NAME'] = 'Ubuntu'
        self.assertIn('WSL', self.run_installer(ok=False).stderr)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_root_rejected(self):
        self.env['SIMULATE_ROOT'] = '1'
        self.assertIn('sudo', self.run_installer(ok=False).stderr)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_interruption_preserves_old_and_cleans_up(self):
        target = self.seed_old()
        self.env['INTERRUPT_DOWNLOAD'] = '1'
        self.run_installer(ok=False)
        self.assertEqual((target / 'old.txt').read_text(), 'previous pet')
        self.assert_clean()

    def test_missing_dependencies(self):
        self.env['PATH'] = str(self.bin)
        self.stub('uname', 'print("Darwin")\n')
        (self.bin / 'curl').unlink()
        self.assertIn('curl is required', self.run_installer(ok=False).stderr)
        self.stub('curl', '')
        (self.bin / 'python3').unlink()
        self.assertIn('python3 is required', self.run_installer(ok=False).stderr)

    def test_resolves_main_once_and_uses_that_commit_for_all_files(self):
        log = self.root / 'requests.txt'
        self.env['REQUEST_LOG'] = str(log)
        for commit in ('b' * 40, 'c' * 40):
            self.env['MAIN_SHA'] = commit
            result = self.run_installer()
            self.assertIn('main at commit ' + commit, result.stdout)
            requests = log.read_text().splitlines()
            self.assertEqual(len(requests), 4)
            self.assertTrue(requests[0].endswith('/git/ref/heads/main'))
            self.assertTrue(all('/' + commit + '/pet/' in url for url in requests[1:]))
            log.unlink()
        self.assertEqual(sorted(p.name for p in (self.home / 'pets' / 'coderun-cat').iterdir()),
                         ['pet.json', 'spritesheet.webp'])

    def test_invalid_main_reference_preserves_old(self):
        target = self.seed_old()
        self.env['MAIN_SHA'] = '../../other'
        self.assertIn('invalid main branch reference', self.run_installer(ok=False).stderr)
        self.assertEqual((target / 'old.txt').read_text(), 'previous pet')
        self.assert_clean()

    def test_new_main_package_uses_its_own_checksums(self):
        self.run_installer()
        fixture = self.root / 'new-package'
        shutil.copytree(ROOT / 'pet', fixture)
        manifest = json.loads((fixture / 'pet.json').read_text())
        manifest['description'] = 'Updated package in main'
        (fixture / 'pet.json').write_text(json.dumps(manifest))
        (fixture / 'SHA256SUMS').write_text(''.join(
            hashlib.sha256((fixture / name).read_bytes()).hexdigest() + '  ' + name + '\n'
            for name in ('pet.json', 'spritesheet.webp')))
        self.env['FIXTURE'] = str(fixture)
        self.env['MAIN_SHA'] = 'd' * 40
        self.run_installer()
        installed = self.home / 'pets' / 'coderun-cat' / 'pet.json'
        self.assertEqual(installed.read_bytes(), (fixture / 'pet.json').read_bytes())
        self.assertEqual(len(list((self.home / 'pet-backups').glob('*/coderun-cat/pet.json'))), 1)

    def test_invalid_checksums_preserve_old(self):
        target = self.seed_old()
        fixture = self.root / 'bad-package'
        shutil.copytree(ROOT / 'pet', fixture)
        self.env['FIXTURE'] = str(fixture)
        original = (fixture / 'SHA256SUMS').read_text()
        for content in ('', original + original, 'invalid checksum\n'):
            (fixture / 'SHA256SUMS').write_text(content)
            self.assertIn('checksum', self.run_installer(ok=False).stderr)
            self.assertEqual((target / 'old.txt').read_text(), 'previous pet')
            self.assert_clean()


if __name__ == '__main__':
    unittest.main()
