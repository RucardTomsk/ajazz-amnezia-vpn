# Changelog

Versions use semantic versioning. Dates use YYYY-MM-DD.

## [Unreleased]

## [1.2.0] - 2026-09-15

First public release; earlier versions below describe local development only.

### Added

- Shared computer settings: protocol, optional executable path, custom state labels, timeout.
- Read-only compatibility diagnostics inside the AJAZZ property inspector.
- Standalone ZIP installer, MIT license, contributor documentation, and Windows CI.
- Version-checked draft releases with SHA-256 checksums.

### Fixed

- Inactive WireGuard status no longer implies an unrelated VPN protocol is disconnected.
- Changes to computer settings invalidate queued commands based on the previous configuration.

## 1.1.1 - 2026-09-15 (local)

- Recognize the actual Connect / Подключиться button state.
- Restore hidden Qt controls through the client's second-instance mechanism before control.
- Verify real off/on cycles with visible, minimized, and tray-hidden windows on AmneziaWG v2.

## 1.1.0 - 2026-09-15 (local)

- Read background status from the local AmneziaWG service without showing the window.

## 1.0.0 - 2026-09-15 (local)

- Initial Windows plugin, state icons, monitoring mode, UI Automation bridge, and tests.

[Unreleased]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/releases/tag/v1.2.0
