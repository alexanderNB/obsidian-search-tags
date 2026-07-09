import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	FuzzySuggestModal,
	FuzzyMatch,
	renderResults,
	Notice,
	Plugin,
    Vault,
	TFile,
    getAllTags,
    MetadataCache,
    Instruction,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	MyPluginSettings,
	SampleSettingTab,
} from './settings';
import { title } from 'node:process';

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings!: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'open-suggest-modal',
			name: 'Open suggest modal',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new MainSuggestModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}



class MainSuggestModal extends FuzzySuggestModal<TFile | string> {
	choosenTags: string[] = [];

    getItemText(item: TFile | string): string {
		if (typeof item == "string") {
			return item;
		} else {
			return item.name;
		}
    }
	
    getItems(): (TFile | string)[] {
		let files: TFile[] = [];
		let tags: string[] = [];
		// let tags: Set<string> = new Set();
		this.app.vault.getFiles().forEach((file: TFile) => {
			const metadataCache = this.app.metadataCache.getCache(file.path);
			if (metadataCache == null) {
				if (this.choosenTags.length == 0) files.push(file);
			} else {
				const fileTags: string[] | null = getAllTags(metadataCache);
				if (fileTags == null) {
					if (this.choosenTags.length == 0) files.push(file);
				} else {
					let isIncluded = true;
					this.choosenTags.forEach((tag: string) => {
						if (!fileTags.contains(tag)) {
							isIncluded = false;
						}
					})

					if (isIncluded) {
						files.push(file);
					}
				}
			}
		})
		files = files.sort((a, b) => b.stat.mtime - a.stat.mtime)
		files.forEach((file) => {
			const metadataCache = this.app.metadataCache.getCache(file.path);
			if (metadataCache != null) {
				const fileTags: string[] | null = getAllTags(metadataCache);
				if (fileTags != null) {
					fileTags.forEach((tag: string) => {
						if (!tags.contains(tag)) {
							tags.push(tag)
						}
					});
				}
			}
		})
		let combinedArray: (TFile | string)[] = files;
		tags.forEach((tag: string) => combinedArray.push(tag))
		console.log(combinedArray)
		return combinedArray;
    }

	renderSuggestion(match: FuzzyMatch<(TFile | string)>, el: HTMLElement) {
		const titleEl = el.createDiv();
		if (match.item instanceof TFile) {
			console.log(match.item.name)
			if (!this.inputEl.value.startsWith("#")) {
				renderResults(titleEl, match.item.name, match.match);
			} else {
				el.remove()
			}
		} else {
			console.log(match.item)
			if (this.inputEl.value.startsWith("#")) {
				if (this.choosenTags.contains(match.item)) {
					renderResults(titleEl, "\uf00d " + match.item, match.match);
				} else {
					renderResults(titleEl, match.item, match.match);
				}
			} else {
				el.remove()
			}
		}
	}

    onChooseItem(item: TFile | string, evt: MouseEvent | KeyboardEvent): void {
		if (item instanceof TFile) {
			this.app.workspace.getLeaf().openFile(item);
		} else {
			if (this.choosenTags.contains(item)) {
				this.choosenTags.remove(item);
			} else {
				this.choosenTags.push(item);
			}
			let instructions: Instruction[] = [];
			this.choosenTags.forEach((tag) => {
				instructions.push({
					command: "",
					purpose: tag
				})
			})
			this.setInstructions(instructions);
			this.open();
		}
    }
}
