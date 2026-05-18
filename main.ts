import {
	App,
	FileSystemAdapter,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import { exec, ExecException } from "child_process";
import * as path from "path";

type TerminalId =
	| "terminal"
	| "iterm"
	| "warp"
	| "ghostty"
	| "alacritty"
	| "kitty"
	| "wezterm"
	| "hyper"
	| "custom";

interface TerminalDefinition {
	id: TerminalId;
	label: string;
	build: (folder: string, custom: string) => string;
}

const TERMINALS: TerminalDefinition[] = [
	{
		id: "terminal",
		label: "Terminal (macOS default)",
		build: (folder) => `open -a Terminal ${shellQuote(folder)}`,
	},
	{
		id: "iterm",
		label: "iTerm",
		build: (folder) => `open -a iTerm ${shellQuote(folder)}`,
	},
	{
		id: "warp",
		label: "Warp",
		build: (folder) => `open -a Warp ${shellQuote(folder)}`,
	},
	{
		id: "ghostty",
		label: "Ghostty",
		build: (folder) => `open -a Ghostty ${shellQuote(folder)}`,
	},
	{
		id: "alacritty",
		label: "Alacritty",
		build: (folder) =>
			`open -na Alacritty --args --working-directory ${shellQuote(folder)}`,
	},
	{
		id: "kitty",
		label: "kitty",
		build: (folder) => `open -na kitty --args --directory ${shellQuote(folder)}`,
	},
	{
		id: "wezterm",
		label: "WezTerm",
		build: (folder) =>
			`open -na WezTerm --args start --cwd ${shellQuote(folder)}`,
	},
	{
		id: "hyper",
		label: "Hyper",
		build: (folder) => `open -a Hyper ${shellQuote(folder)}`,
	},
	{
		id: "custom",
		label: "Custom command",
		build: (folder, custom) =>
			custom.includes("{folder}")
				? custom.replaceAll("{folder}", shellQuote(folder))
				: `${custom} ${shellQuote(folder)}`,
	},
];

interface OpenInTerminalSettings {
	terminal: TerminalId;
	customCommand: string;
}

const DEFAULT_SETTINGS: OpenInTerminalSettings = {
	terminal: "terminal",
	customCommand: "",
};

export default class OpenInTerminalPlugin extends Plugin {
	settings: OpenInTerminalSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new OpenInTerminalSettingTab(this.app, this));

		this.addCommand({
			id: "reveal-vault-in-terminal",
			name: "Reveal vault in terminal",
			callback: () => {
				const root = this.getVaultPath();
				if (root) this.openInTerminal(root);
			},
		});

		this.addCommand({
			id: "reveal-current-file-in-terminal",
			name: "Reveal current file's folder in terminal",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) this.revealFile(file);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) => {
					item.setTitle("Reveal in terminal")
						.setIcon("terminal-square")
						.onClick(() => this.revealFile(file));
				});
			})
		);

		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				const targets = files.filter(
					(f): f is TAbstractFile => f instanceof TFile || f instanceof TFolder
				);
				if (targets.length === 0) return;
				menu.addItem((item) => {
					item.setTitle("Reveal in terminal")
						.setIcon("terminal-square")
						.onClick(() => {
							const folders = new Set<string>();
							for (const t of targets) {
								const folder = this.resolveFolder(t);
								if (folder) folders.add(folder);
							}
							for (const folder of folders) this.openInTerminal(folder);
						});
				});
			})
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private getVaultPath(): string | null {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
		return null;
	}

	private resolveFolder(file: TAbstractFile): string | null {
		const root = this.getVaultPath();
		if (!root) return null;
		if (file instanceof TFolder) return path.join(root, file.path);
		if (file instanceof TFile) {
			const parent = file.parent?.path ?? "";
			return path.join(root, parent);
		}
		return null;
	}

	private revealFile(file: TAbstractFile) {
		const folder = this.resolveFolder(file);
		if (folder) this.openInTerminal(folder);
	}

	private openInTerminal(folder: string) {
		const def =
			TERMINALS.find((t) => t.id === this.settings.terminal) ?? TERMINALS[0];

		if (def.id === "custom" && !this.settings.customCommand.trim()) {
			new Notice("Open in Terminal: set a custom command in plugin settings.");
			return;
		}

		const command = def.build(folder, this.settings.customCommand.trim());
		exec(command, (err: ExecException | null, _stdout, stderr) => {
			if (err) {
				console.error("[open-in-terminal] command failed", { command, err, stderr });
				new Notice(
					`Open in Terminal failed: ${err.message.split("\n")[0]}`
				);
			}
		});
	}
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

class OpenInTerminalSettingTab extends PluginSettingTab {
	plugin: OpenInTerminalPlugin;

	constructor(app: App, plugin: OpenInTerminalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Terminal")
			.setDesc("Application launched when you reveal a folder.")
			.addDropdown((drop) => {
				for (const t of TERMINALS) drop.addOption(t.id, t.label);
				drop.setValue(this.plugin.settings.terminal).onChange(async (value) => {
					this.plugin.settings.terminal = value as TerminalId;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.terminal === "custom") {
			new Setting(containerEl)
				.setName("Custom command")
				.setDesc(
					"Shell command to run. Use {folder} as a placeholder for the absolute folder path. " +
						"If {folder} is omitted, the path is appended at the end."
				)
				.addText((text) => {
					text
						.setPlaceholder("e.g. /usr/local/bin/wezterm start --cwd {folder}")
						.setValue(this.plugin.settings.customCommand)
						.onChange(async (value) => {
							this.plugin.settings.customCommand = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.style.width = "100%";
				});
		}
	}
}
