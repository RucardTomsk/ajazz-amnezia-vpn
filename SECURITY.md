# Security policy

## Supported versions

Security fixes target the latest published release. Older releases may require
an upgrade. AmneziaVPN and AJAZZ themselves are maintained by their vendors.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/RucardTomsk/ajazz-amnezia-vpn/security/advisories/new).
Do not put vulnerabilities, keys, VPN configuration, or private logs in a public
issue. Include affected versions, expected impact, and a minimal reproduction
without secrets. There is no guaranteed response time or commercial support SLA.

## Security boundaries

- The plugin communicates with the AJAZZ host over loopback WebSocket.
- VPN control uses the running client's Windows UI Automation button.
- The AmneziaWG service receives only a read-only `status` request.
- Startup, settings changes, diagnostics, and polling do not toggle the VPN.
- The plugin neither imports VPN credentials nor launches the configured executable.
- The optional executable path selects an already running process; it is passed
  as encoded data to `execFile`, never interpreted as a shell command.
- Unknown state blocks control; uncertain commands are not retried automatically.
- Diagnostics display local executable paths and versions. Review these before sharing.

The plugin runs with the user's permissions. It does not provide a security
boundary against other software already running as that user. A displayed
connection state is not proof that all traffic is routed through the VPN.
Release binaries are not Authenticode signed; SHA-256 checksums verify file
integrity against the published release, not an independent publisher identity.
