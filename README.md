# The Speaking Hand by DM Wicked

A visual speaking queue for Foundry VTT v14. Players raise personalized hands and the GM manages speaking order from a compact dashboard.

## Features

- Automatic floating hand HUD, one-click raise/lower and shared turn queue
- Custom character hand artwork and token-optional or surrogate speakers
- Draggable, resizable player queue with no duplicate name overlay
- GM priority, compact tabbed dashboard, drag-and-drop queue, undo and batch management
- Assignment import/export, activity indicators, help and optional turn sound
- Optional separately hosted Discord voice bridge for voice-channel mute control

## Installation

After publishing the first GitHub Release, use this URL in Foundry's **Install Module** manifest field:

`https://github.com/OWNER/the-speaking-hand/releases/latest/download/module.json`

Replace `OWNER` with your actual GitHub username/organization. Existing users can keep the legacy module ID `guild-speaking-circle-autohud`, which preserves their data.

## Release management

This repository includes a GitHub Actions workflow that turns a `v1.14.0` tag into two release attachments:

- `module.json` — Foundry update manifest with real repository URLs
- `the-speaking-hand.zip` — installable Foundry module with its original module folder name

To publish a new version, update `module.json` version and release a matching `v<version>` tag. The workflow refuses mismatched versions.

See [PUBLISHING.md](PUBLISHING.md) for first-time steps. Back up worlds before updating. Discord muting needs a separate bot and server.

## Compatibility

Foundry VTT 14. This is a community module, not affiliated with Foundry Gaming LLC.

## License

No open-source license has been granted. Contact the author before redistributing or modifying the source. A license can be added before broad publication.
