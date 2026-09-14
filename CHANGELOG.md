# Changelog

Versions use semantic versioning. Dates use YYYY-MM-DD.

## [Unreleased]

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

[Unreleased]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/RucardTomsk/ajazz-amnezia-vpn/releases/tag/v1.2.0
