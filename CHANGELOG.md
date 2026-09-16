# Changelog

Versions use semantic versioning. Dates use YYYY-MM-DD.

## [Unreleased]

## [1.2.1] - 2026-09-16

### Fixed

- Read AmneziaWG status when the client starts in the tray before its main window is exposed to UI Automation.
- Allow an explicit key press to initialize the client's UI through its existing second-instance channel, then restore it to the tray.
- Retry background status when the service starts later than the client, without asking users to open the window.

### Changed

- Simplify public documentation and scope the CI badge to the main branch.

## [1.2.0] - 2026-09-15

First public release.

### Added

- Shared computer settings: protocol, optional executable path, custom state labels, timeout.
- Read-only compatibility diagnostics inside the AJAZZ property inspector.
- Standalone ZIP installer, MIT license, contributor documentation, and Windows CI.
- Version-checked draft releases with SHA-256 checksums.

### Fixed

- Inactive WireGuard status no longer implies an unrelated VPN protocol is disconnected.
- Changes to computer settings invalidate queued commands based on the previous configuration.

[Unreleased]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/releases/tag/v1.2.0
