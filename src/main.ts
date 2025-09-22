import {
	App,
	ButtonComponent,
	Editor,
	Modal,
	Notice,
	Plugin,
	TextAreaComponent,
	ToggleComponent,
	PluginSettingTab,
	Setting
} from 'obsidian';

interface RfrPluginSettings {
	findText: string;
	replaceText: string;
	useRegEx: boolean;
	selOnly: boolean;
	caseInsensitive: boolean;
	processLineBreak: boolean;
	processTab: boolean;
	prefillFind: boolean;
	history?: Array<{ find: string, replace: string }>;
	favorites?: Array<{ find: string, replace: string }>;
}

const DEFAULT_SETTINGS: RfrPluginSettings = {
	findText: '',
	replaceText: '',
	useRegEx: true,
	selOnly: false,
	caseInsensitive: false,
	processLineBreak: false,
	processTab: false,
	prefillFind: false,
	history: [],
	favorites: []
}

// logThreshold: 0 ... only error messages
//               9 ... verbose output
const logThreshold = 9;
const logger = (logString: string, logLevel = 0): void => { if (logLevel <= logThreshold) console.log('RegexFiRe: ' + logString) };

export default class RegexFindReplacePlugin extends Plugin {
	settings: RfrPluginSettings;

	async onload() {
		logger('Loading Plugin...', 9);
		await this.loadSettings();

		this.addSettingTab(new RegexFindReplaceSettingTab(this.app, this));

		this.addCommand({
			id: 'obsidian-regex-replace',
			name: 'Find and Replace using regular expressions',
			editorCallback: (editor) => {
				new FindAndReplaceModal(this.app, editor, this.settings, this).open();
			},
		});
	}

	onunload() {
		logger('Bye!', 9);
	}

	async loadSettings() {
		logger('Loading Settings...', 6);
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		logger('   findVal:         ' + this.settings.findText, 6);
		logger('   replaceText:     ' + this.settings.replaceText, 6);
		logger('   caseInsensitive: ' + this.settings.caseInsensitive, 6);
		logger('   processLineBreak: ' + this.settings.processLineBreak, 6);

	}
	async saveSettings() {
		await this.saveData(this.settings);
	}

}

class FindAndReplaceModal extends Modal {
	constructor(app: App, editor: Editor, settings: RfrPluginSettings, plugin: Plugin) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.plugin = plugin;
	}

	settings: RfrPluginSettings;
	editor: Editor;
	plugin: Plugin;

	onOpen() {
		const { contentEl, titleEl, editor, modalEl } = this;
		modalEl.addClass('find-replace-modal');
		titleEl.setText('Regex Find/Replace');

		const rowClass = 'row';
		const divClass = 'div';
		const noSelection = editor.getSelection() === '';
		let regexFlags = 'gm';
		if (this.settings.caseInsensitive) regexFlags = regexFlags.concat('i');

		logger('No text selected?: ' + noSelection, 9);

		// Render Center panel
		// Render Center panel Top
		const topbuttonContainerEl = document.createElement(divClass);
		topbuttonContainerEl.addClass(rowClass);

		// Add "Clean" button
		const cleanButtonTarget = document.createElement(divClass);
		cleanButtonTarget.addClass('button-wrapper')
		cleanButtonTarget.addClass(rowClass)

		// Add "Exchange" button
		const exchangeButtonTarget = document.createElement(divClass);
		exchangeButtonTarget.addClass('button-wrapper')
		exchangeButtonTarget.addClass(rowClass)

		// Add "Add to Favorite" button
		const addfavButtonTarget = document.createElement(divClass);
		addfavButtonTarget.addClass('button-wrapper');
		addfavButtonTarget.addClass(rowClass);

		const cleanButtonComponent = new ButtonComponent(cleanButtonTarget)
		const exchangeButtonComponent = new ButtonComponent(exchangeButtonTarget)
		const addfavButtonComponent = new ButtonComponent(addfavButtonTarget)

		topbuttonContainerEl.appendChild(cleanButtonTarget);
		topbuttonContainerEl.appendChild(exchangeButtonTarget);
		topbuttonContainerEl.appendChild(addfavButtonTarget);
		contentEl.appendChild(topbuttonContainerEl);

		// Render Center panel Middle
		const addTextComponent = (label: string, placeholder: string, postfix = ''): [TextAreaComponent, HTMLDivElement] => {
			const containerEl = document.createElement(divClass);
			containerEl.addClass(rowClass);

			const targetEl = document.createElement(divClass);
			targetEl.addClass('input-wrapper');

			const labelEl = document.createElement(divClass);
			labelEl.addClass('input-label');
			labelEl.setText(label);

			const labelEl2 = document.createElement(divClass);
			labelEl2.addClass('postfix-label');
			labelEl2.setText(postfix);

			containerEl.appendChild(labelEl);
			containerEl.appendChild(targetEl);
			containerEl.appendChild(labelEl2);

			const component = new TextAreaComponent(targetEl);
			component.setPlaceholder(placeholder);

			contentEl.append(containerEl);
			return [component, labelEl2];
		};

		const addToggleComponent = (label: string, tooltip: string, hide = false): ToggleComponent => {
			const containerEl = document.createElement(divClass);
			containerEl.addClass(rowClass);

			const targetEl = document.createElement(divClass);
			targetEl.addClass(rowClass);

			const component = new ToggleComponent(targetEl);
			component.setTooltip(tooltip);

			const labelEl = document.createElement(divClass);
			labelEl.addClass('check-label');
			labelEl.setText(label);

			containerEl.appendChild(labelEl);
			containerEl.appendChild(targetEl);
			if (!hide) contentEl.appendChild(containerEl);
			return component;
		};

		// Create input fields
		const findRow = addTextComponent('Find:', 'e.g. (.*)', '/' + regexFlags);
		const findInputComponent = findRow[0];
		const findRegexFlags = findRow[1];
		const replaceRow = addTextComponent('Replace:', 'e.g. $1', this.settings.processLineBreak ? '\\n=LF' : '');
		const replaceWithInputComponent = replaceRow[0];

		// Create and show regular expression toggle switch
		const regToggleComponent = addToggleComponent('Use regular expressions', 'If enabled, regular expressions in the find field are processed as such, and regex groups might be addressed in the replace field');

		// Update regex-flags label if regular expressions are enabled or disabled
		regToggleComponent.onChange(regNew => {
			if (regNew) {
				findRegexFlags.setText('/' + regexFlags);
			}
			else {
				findRegexFlags.setText('');
			}
		})

		// Create and show selection toggle switch only if any text is selected
		const selToggleComponent = addToggleComponent('Replace only in selection', 'If enabled, replaces only occurances in the currently selected text', noSelection);

		// Render Center panel Bottom
		const bottombuttonContainerEl = document.createElement(divClass);
		bottombuttonContainerEl.addClass(rowClass);

		const submitButtonTarget = document.createElement(divClass);
		submitButtonTarget.addClass('button-wrapper');
		submitButtonTarget.addClass(rowClass);

		const cancelButtonTarget = document.createElement(divClass);
		cancelButtonTarget.addClass('button-wrapper');
		cancelButtonTarget.addClass(rowClass);

		const submitButtonComponent = new ButtonComponent(submitButtonTarget);
		const cancelButtonComponent = new ButtonComponent(cancelButtonTarget);

		cancelButtonComponent.setButtonText('Cancel');
		cancelButtonComponent.onClick(() => {
			logger('Action cancelled.', 8);
			this.close();
		});

		submitButtonComponent.setButtonText('Replace All');
		submitButtonComponent.setCta();
		submitButtonComponent.onClick(async () => {
			let resultString = 'No match';
			let scope = '';
			const searchString = findInputComponent.getValue();
			let replaceString = replaceWithInputComponent.getValue();
			const selectedText = editor.getSelection();

			if (searchString === '') {
				new Notice('Nothing to search for!');
				return;
			}

			// Save to History
			if (searchString) {
				const history = this.settings.history ?? [];
				const exists = history.find(h => h.find === searchString && h.replace === replaceString);
				if (!exists) {
					history.unshift({ find: searchString, replace: replaceString });
					if (history.length > 20) history.pop();
					this.settings.history = history;
					await this.plugin.saveData(this.settings);
				}
			}

			// Replace line breaks in find-field if option is enabled
			if (this.settings.processLineBreak) {
				logger('Replacing linebreaks in replace-field', 9);
				logger('  old: ' + replaceString, 9);
				replaceString = replaceString.replace(/\\n/gm, '\n');
				logger('  new: ' + replaceString, 9);
			}

			// Replace line breaks in find-field if option is enabled
			if (this.settings.processTab) {
				logger('Replacing tabs in replace-field', 9);
				logger('  old: ' + replaceString, 9);
				replaceString = replaceString.replace(/\\t/gm, '\t');
				logger('  new: ' + replaceString, 9);
			}

			// Check if regular expressions should be used
			if (regToggleComponent.getValue()) {
				logger('USING regex with flags: ' + regexFlags, 8);

				const searchRegex = new RegExp(searchString, regexFlags);
				if (!selToggleComponent.getValue()) {
					logger('   SCOPE: Full document', 9);
					const documentText = editor.getValue();
					const rresult = documentText.match(searchRegex);
					if (rresult) {
						editor.setValue(documentText.replace(searchRegex, replaceString));
						resultString = `Made ${rresult.length} replacement(s) in document`;
					}
				}
				else {
					logger('   SCOPE: Selection', 9);
					const rresult = selectedText.match(searchRegex);
					if (rresult) {
						editor.replaceSelection(selectedText.replace(searchRegex, replaceString));
						resultString = `Made ${rresult.length} replacement(s) in selection`;
					}
				}
			}
			else {
				logger('NOT using regex', 8);
				let nrOfHits = 0;
				if (!selToggleComponent.getValue()) {
					logger('   SCOPE: Full document', 9);
					scope = 'document'
					const documentText = editor.getValue();
					const documentSplit = documentText.split(searchString);
					nrOfHits = documentSplit.length - 1;
					editor.setValue(documentSplit.join(replaceString));
				}
				else {
					logger('   SCOPE: Selection', 9);
					scope = 'selection';
					const selectedSplit = selectedText.split(searchString);
					nrOfHits = selectedSplit.length - 1;
					editor.replaceSelection(selectedSplit.join(replaceString));
				}
				resultString = `Made ${nrOfHits} replacement(s) in ${scope}`;
			}

			// Save settings (find/replace text and toggle switch states)
			this.settings.findText = searchString;
			this.settings.replaceText = replaceString;
			this.settings.useRegEx = regToggleComponent.getValue();
			this.settings.selOnly = selToggleComponent.getValue();
			this.plugin.saveData(this.settings);

			this.close();
			new Notice(resultString);
		});

		// Apply settings
		regToggleComponent.setValue(this.settings.useRegEx);
		selToggleComponent.setValue(this.settings.selOnly);
		replaceWithInputComponent.setValue(this.settings.replaceText);

		// Check if the prefill find option is enabled and the selection does not contain linebreaks
		if (this.settings.prefillFind && editor.getSelection().indexOf('\n') < 0 && !noSelection) {
			logger('Found selection without linebreaks and option is enabled -> fill', 9);
			findInputComponent.setValue(editor.getSelection());
			selToggleComponent.setValue(false);

			// Auto-focus on Find field
			setTimeout(() => {
				findInputComponent.inputEl.focus();
				findInputComponent.inputEl.select();
			}, 0);
		} else {
			logger('Restore find text', 9);
			findInputComponent.setValue(this.settings.findText);

			setTimeout(() => {
				findInputComponent.inputEl.focus();
			}, 0);
		}

		// If no text is selected, disable selection-toggle-switch
		if (noSelection) selToggleComponent.setValue(false);

		// Add button row to dialog
		bottombuttonContainerEl.appendChild(submitButtonTarget);
		bottombuttonContainerEl.appendChild(cancelButtonTarget);
		contentEl.appendChild(bottombuttonContainerEl);

		// Render Left Panel & Right Panel: Add Container for history record and favorite record
		// refreshPanels: render history panel or favorites panel
		const refreshPanels = (panel: HTMLElement, type: 'history' | 'favorites', findInputComponent: TextAreaComponent, replaceWithInputComponent: TextAreaComponent): void => {

			panel.innerHTML = '';

			const title = document.createElement('div');
			title.className = "panel-title";
			title.innerText = type.charAt(0).toUpperCase() + type.slice(1);  // 'History' 或 'Favorite'
			panel.appendChild(title);

			const items = (this.settings[type] ?? []).slice(0, 20);

			items.forEach((item, idx) => {
				const entry = document.createElement('div');
				entry.className = "item";
				entry.innerText = `${item.find} ➡ ${item.replace}`;

				// Double right click to delete one entry
				entry.onclick = (e) => {
					if (entry.classList.contains('delete-mode')) {
						// left click after right click to cancel
						entry.classList.remove('delete-mode');
						delete entry.dataset.markedIdx;
						const deleteSpan = entry.querySelector('span');
						if (deleteSpan) deleteSpan.remove();
					} else {
						// one left click to use entry
						findInputComponent.setValue(item.find);
						replaceWithInputComponent.setValue(item.replace);
					}
				};

				entry.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					const markedIdx = parseInt(entry.dataset.markedIdx || '-1');
					if (markedIdx >= 0 && markedIdx === idx) {
						// right click after right click to confirm deletion
						this.settings[type].splice(idx, 1);
						this.plugin.saveData(this.settings);
						refreshPanels(panel, type, findInputComponent, replaceWithInputComponent);
					} else {
						// one right click to enquire deletion
						entry.classList.add('delete-mode');
						entry.dataset.markedIdx = idx.toString();
						const deleteSpan = document.createElement('span');
						deleteSpan.innerText = ' DELETE IT?';
						deleteSpan.style.color = 'red';
						deleteSpan.style.fontSize = '0.9em';
						deleteSpan.style.fontWeight = 'bold';
						entry.appendChild(deleteSpan);
					}
				});

				panel.appendChild(entry);
			});
		};

		// Add left panel and right panel to modal
		const leftPanel = document.createElement(divClass);
		leftPanel.addClass("left-panel")
		refreshPanels(leftPanel, 'history', findInputComponent, replaceWithInputComponent);

		const centerPanel = document.createElement(divClass);
		centerPanel.addClass("center-panel")

		const rightPanel = document.createElement(divClass);
		rightPanel.addClass("right-panel")
		refreshPanels(rightPanel, 'favorites', findInputComponent, replaceWithInputComponent);

		centerPanel.appendChild(contentEl);
		modalEl.empty();
		modalEl.appendChild(leftPanel);
		modalEl.appendChild(centerPanel);
		modalEl.appendChild(rightPanel);

		// Add button logic
		addfavButtonComponent.setButtonText('⭐');
		addfavButtonComponent.onClick(async () => {
			const find = findInputComponent.getValue();
			const replace = replaceWithInputComponent.getValue();
			if (!find) return;
			const favs = this.settings.favorites ?? [];
			if (!favs.find(f => f.find === find && f.replace === replace)) {
				favs.unshift({ find, replace });
				if (favs.length > 20) favs.pop();
				this.settings.favorites = favs;
				await this.plugin.saveData(this.settings);
			}
			refreshPanels(rightPanel, 'favorites', findInputComponent, replaceWithInputComponent);
		});

		exchangeButtonComponent.setButtonText('🔃');
		exchangeButtonComponent.onClick(() => {
			const find = findInputComponent.getValue();
			const replace = replaceWithInputComponent.getValue();
			findInputComponent.setValue(replace);
			replaceWithInputComponent.setValue(find);
		})

		cleanButtonComponent.setButtonText('🗑');
		cleanButtonComponent.onClick(() => {
			findInputComponent.setValue("");
			replaceWithInputComponent.setValue("");
		})

	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class RegexFindReplaceSettingTab extends PluginSettingTab {
	plugin: RegexFindReplacePlugin;

	constructor(app: App, plugin: RegexFindReplacePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h4', { text: 'Regular Expression Settings' });

		new Setting(containerEl)
			.setName('Case Insensitive')
			.setDesc('When using regular expressions, apply the \'/i\' modifier for case insensitive search)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.caseInsensitive)
				.onChange(async (value) => {
					logger('Settings update: caseInsensitive: ' + value);
					this.plugin.settings.caseInsensitive = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h4', { text: 'General Settings' });


		new Setting(containerEl)
			.setName('Process \\n as line break')
			.setDesc('When \'\\n\' is used in the replace field, a \'line break\' will be inserted accordingly')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.processLineBreak)
				.onChange(async (value) => {
					logger('Settings update: processLineBreak: ' + value);
					this.plugin.settings.processLineBreak = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Prefill Find Field')
			.setDesc('Copy the currently selected text (if any) into the \'Find\' text field. This setting is only applied if the selection does not contain linebreaks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.prefillFind)
				.onChange(async (value) => {
					logger('Settings update: prefillFind: ' + value);
					this.plugin.settings.prefillFind = value;
					await this.plugin.saveSettings();
				}));
	}
}

