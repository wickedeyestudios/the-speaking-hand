THE SPEAKING HAND BY DM WICKED — 1.14.0
Foundry VTT 14 / dnd5e / The Forge

INSTALL / UPDATE
1. Back up your Foundry world and, if possible, export your speaking assignments from the currently installed GM dashboard.
2. Unzip this archive. It contains ONE folder: guild-speaking-circle-autohud.
3. Replace the existing module folder with this entire folder. The folder name and module ID have NOT changed.
4. Enable The Speaking Hand by DM Wicked in Manage Modules, reload the world, and have players refresh.
5. On the Foundry scene controls toolbar, click the hand icon. The Floating Hands subtool controls local HUD visibility; the GM-only Dashboard subtool opens all settings and assignments.
6. Do not execute the old GM macro or Player HUD macro alongside this standalone module.

NEW GM DASHBOARD
Queue: drag any waiting row to reorder it, set a speaker current, insert new hands, or use Undo. GM Priority remains on the floating GM controls. Undo stores the last 30 queue snapshots in the CURRENT GM session only (not a permanent history).
Speakers: searchable compact roster with quick Raise, Current and Edit buttons. Expand an entry to edit name, image, token requirement or surrogate accounts. Surrogates are searchable, with chips showing selections. Save to commit each edited speaker.
Add Speaker: create an account/actor assignment as before, including no-token GM entries and Forge hand image browser/uploads.
Discord: old optional Discord voice settings and emergency release. A separately deployed Discord bot/bridge is still required. No bot token is stored in Foundry.
Settings & Backup: export/import speaker assignment JSON. Export excludes Discord bridge access key, Discord user IDs and other Discord credentials. Import requires the original Foundry user/Actor IDs to be present; it merges by speaker record ID, keeping queue state unchanged. Export before importing.
Help: in-app instructions and tooltips.

OPTIONAL SOUND
Game Settings > Configure Settings > Module Settings > The Speaking Hand > Speaker Turn Sound (client setting, default off) and Speaker Sound Volume. The GM also has audio controls for their own device under Settings & Backup. The short synthesized tone plays when the current speaker changes, not on initial load. Browsers may block audio until the user interacts with the page.

PRESERVATION
Internal module ID: guild-speaking-circle-autohud (unchanged).
World data: world.guildSpeakingCircleV1 (unchanged). Existing registered persons, queue order, DM priority, token requirements, surrogate user IDs, assigned hand image paths, player HUD locations and sizing remain compatible.
Voice bridge settings remain local to the original GM browser, as before.

TEST PLAN BEFORE A LIVE SESSION
- GM and one player join; confirm that the automatic HUD loads and the GM toolbar/dashboard opens.
- Raise/lower a player hand and reorder it by dragging; verify both clients see the same queue.
- Edit a speaker with surrogate accounts and save; confirm selection rights.
- Export a JSON backup; check it excludes Discord secrets. Only import backups you trust.
- Test batch actions and Undo on a practice queue before a session.
- Enable optional sound on one player client and promote a speaker.
- If using Discord, confirm bridge connection and Emergency Unmute in a test voice channel.

The code has been syntax checked, but full UI and multiplayer behavior must be tested in your live Foundry/Forge world.
