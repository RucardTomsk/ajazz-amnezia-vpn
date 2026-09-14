# Contributing

Issues and pull requests in Russian or English are welcome.

## Local development

Use Windows 10/11 x64, Windows PowerShell 5.1 or PowerShell 7, .NET Framework
4.x, and Node.js 20 or newer. Node 20 matches the tested AJAZZ host; the CI
also tests Node 24. Development does not require an AJAZZ device or a VPN account.

```powershell
git clone https://github.com/RucardTomsk/ajazz-amnezia-vpn.git
cd ajazz-amnezia-vpn
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1
node scripts/check-package.js
```

The build fetches only the locked `ws` package, checks SHA-512, and executes
no dependency lifecycle scripts. `npm install` is not needed. When updating
`ws`, update `plugin/package.json` and `plugin/package-lock.json` together;
the build reads the lock file and rejects inconsistent versions.

## Pull requests

1. Create a branch from `main` and keep changes focused on one problem.
2. Describe the user-visible behavior and relevant limitations.
3. Add meaningful regression coverage for behavior changes and run the checks.
4. Update documentation and the Unreleased changelog when appropriate.
5. Submit a pull request. Contributions are licensed under the project's MIT license.

Do not commit logs, binaries, server addresses, VPN profiles, private keys,
tokens, or screenshots containing personal information. Build products and
local test artifacts are ignored by Git.

## Live VPN tests

Automated CI tests use simulated VPN responses and never toggle a real VPN.
`scripts/live-test.js --allow-vpn-toggle --mode=hidden` deliberately disconnects
and reconnects an existing connection. Only run it on your own test machine
when interruption is acceptable. It attempts restoration on failure but cannot
guarantee connectivity if the client or network fails. Report the tested client,
protocol, host version, and window state; do not attach raw VPN logs.

## Releases

Versions follow `MAJOR.MINOR.PATCH`; update both package manifests and
`plugin/manifest.json` together. Add `docs/releases/vX.Y.Z.md`, update
`CHANGELOG.md`, and merge to `main`. After CI passes, push an annotated
`vX.Y.Z` tag. The release workflow validates versions, builds and tests on
Windows, and creates a draft GitHub release with a ZIP and SHA-256 checksum.
Inspect the draft, then publish it. Never overwrite an existing published tag.
