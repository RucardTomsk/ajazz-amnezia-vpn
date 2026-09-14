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

## Project structure

| Path | Responsibility |
| --- | --- |
| `plugin/core.js` | Connection state, command sequencing and repeated-press protection |
| `plugin/index.js` | AJAZZ WebSocket events and timed helper execution |
| `plugin/background.js` | Read-only status from the AmneziaWG service |
| `plugin/config.js`, `plugin/inspector.*` | Shared settings and the property inspector |
| `src/AmneziaBridge.cs` | Discovery and control of the client's UI Automation button |
| `scripts/` | Build, installation, package validation and integration tests |
| `tests/` | Automated JavaScript and C# regression checks |

The helper is compiled with the system .NET Framework C# compiler. Release
files are written to `dist`. The bridge does not start Amnezia or send control
commands to its service. Polling reads state only; a key press invokes the
client's own button. Unknown state blocks switching.

## Automated checks

`scripts/test.ps1` covers state parsing, custom labels, configuration validation,
command sequencing, repeated presses, timeouts, and WebSocket host events with
simulated VPN responses. `scripts/check-package.js` checks version consistency,
required release files, the dependency lock and the archive's SHA-256.
CI runs these checks on Windows with Node.js 20 and 24. CodeQL analyzes JavaScript.
Automated checks do not require a running Amnezia client or an AJAZZ device.

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

```powershell
node scripts/live-test.js --allow-vpn-toggle --mode=hidden
```

This command deliberately disconnects
and reconnects an existing connection. Only run it on your own test machine
when interruption is acceptable. It attempts restoration on failure but cannot
guarantee connectivity if the client or network fails. Report the tested client,
protocol, host version, and window state; do not attach raw VPN logs.

Start with VPN connected using AmneziaWG / WireGuard. Set `--mode` to the actual
window state: `visible`, `minimized`, or `hidden`. The script checks monitoring
mode, concurrent key presses, an off/on cycle, and service confirmation. Results
are saved to ignored `artifacts/live-test-*.json` files.

## Releases

Versions follow `MAJOR.MINOR.PATCH`; update both package manifests and
`plugin/manifest.json` together. Add `docs/releases/vX.Y.Z.md`, update
`CHANGELOG.md`, and merge to `main`. After CI passes, push an annotated
`vX.Y.Z` tag. The release workflow validates versions, builds and tests on
Windows, and creates a draft GitHub release with a ZIP and SHA-256 checksum.
Inspect the draft, then publish it. Never overwrite an existing published tag.

## API references

- [Stream Dock registration](https://sdk.key123.vip/en/guide/registration.html)
- [Stream Dock manifest](https://sdk.key123.vip/en/guide/manifest.html)
- [Amnezia 4.8.19.0 connection button](https://github.com/amnezia-vpn/amnezia-client/blob/4.8.19.0/client/ui/qml/Components/ConnectButton.qml)
- [Amnezia 4.8.19.0 second-instance handling](https://github.com/amnezia-vpn/amnezia-client/blob/4.8.19.0/client/main.cpp)
