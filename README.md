# Reveal in Terminal

An [Obsidian](https://obsidian.md) plugin that adds a **Reveal in terminal**
action next to the built-in **Reveal in Finder**, opening the vault root or
any folder/note's parent folder in your preferred terminal emulator.

> Desktop-only (macOS). The plugin shells out to a terminal application, so it
> cannot run on mobile.

## Features

- **File / folder context menu** — right-click any note or folder in the file
  explorer and pick *Reveal in terminal*.
- **Multi-select** — select several files or folders and reveal each unique
  parent folder in one click.
- **Command palette**
  - *Reveal vault in terminal*
  - *Reveal current file's folder in terminal*
- **Pick your terminal** — Terminal.app, iTerm, Warp, Ghostty, Alacritty,
  kitty, WezTerm, Hyper, or a custom shell command.

## Install

### From a release build

1. Copy `manifest.json` and `main.js` into
   `<your-vault>/.obsidian/plugins/reveal-in-terminal/`.
2. In Obsidian, open **Settings → Community plugins**, refresh the list,
   and enable **Reveal in Terminal**.

### From source

Build artifacts (`main.js`) are not committed. To produce them:

```sh
docker run --rm -v "$PWD":/work -w /work node:20-alpine \
  sh -c "npm install && npm run build"
```

Then copy `manifest.json` and the generated `main.js` into the plugin folder
shown above.

For iterative development:

```sh
docker run --rm -it -v "$PWD":/work -w /work node:20-alpine \
  sh -c "npm install && npm run dev"
```

`npm run dev` watches `main.ts` and rebuilds `main.js` on change. Symlink the
plugin directory into your vault to pick changes up live.

## Configuration

Open **Settings → Reveal in Terminal**:

- **Terminal** — choose the emulator to launch.
- **Menu placement** — *Next to Reveal in Finder* (default, groups with the
  system actions) or *In its own section* (separate divider).
- **Custom command** (shown when *Custom command* is selected) — any shell
  command. Use `{folder}` as a placeholder for the absolute folder path; if
  omitted, the path is appended to the end of the command.

Examples for the custom field:

```
/usr/local/bin/wezterm start --cwd {folder}
open -na "Visual Studio Code" --args {folder}
/opt/homebrew/bin/tmux new-window -c {folder}
```

Paths are shell-quoted before they reach `exec`, so folders with spaces or
quotes work without extra escaping.

## How it resolves the folder

- A **folder** opens at its own path.
- A **note** opens at its parent folder.
- The **vault command** opens at the vault's root path (as reported by
  Obsidian's `FileSystemAdapter`).

## Troubleshooting

- *"Open in Terminal failed: ..."* notice — the command exited non-zero.
  Check the developer console (**View → Toggle Developer Tools**) for the
  full command and stderr.
- *"set a custom command in plugin settings"* — you picked *Custom command*
  but left the field empty.
- Terminal launches but with the wrong working directory — some emulators
  ignore `open -a <App> <path>`. Switch the setting to **Custom command** and
  use the emulator's own CLI (e.g. `wezterm start --cwd {folder}`).

## License

MIT
