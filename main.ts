import {App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, WorkspaceWindow, View, Notice} from 'obsidian';
import { Util } from  "./src/util";
 

interface MouseWheelZoomSettings {
    initialSize: number;
    modifierKey: ModifierKey;
    stepSize: number;
    resizeInCanvas: boolean;
}

enum ModifierKey {
    ALT = "AltLeft",
    CTRL = "ControlLeft",
    SHIFT = "ShiftLeft",
    ALT_RIGHT = "AltRight",
    CTRL_RIGHT = "ControlRight",
    SHIFT_RIGHT = "ShiftRight"
}

const DEFAULT_SETTINGS: MouseWheelZoomSettings = {
    modifierKey: ModifierKey.ALT,
    stepSize: 25,
    initialSize: 500,
    resizeInCanvas: true,
}

const CtrlCanvasConflictWarning = "Warning: Using Ctrl as the modifier key conflicts with default canvas zooming behavior when 'Resize in canvas' is enabled. Consider using another modifier key or disabling 'Resize in canvas'.";
 

export default class MouseWheelZoomPlugin extends Plugin {
    settings: MouseWheelZoomSettings;
    isKeyHeldDown = false;

    async onload() {
        await this.loadSettings();
        this.registerEvent(
            this.app.workspace.on("window-open", (newWindow: WorkspaceWindow) => this.registerEvents(newWindow.win))
        );
        this.registerEvents(window);

        this.addSettingTab(new MouseWheelZoomSettingsTab(this.app, this));

        console.log("Loaded: Mousewheel image zoom")

        this.checkExistingUserConflict();
    }

    checkExistingUserConflict() {
        const noticeShownKey = 'mousewheel-zoom-ctrl-warning-shown'; // Key for localStorage flag
        const isCtrl = this.settings.modifierKey === ModifierKey.CTRL || this.settings.modifierKey === ModifierKey.CTRL_RIGHT;


        // Only show the notice if the conflict exists AND the user hasn't dismissed it before (using localStorage flag)
        if (isCtrl && this.settings.resizeInCanvas && !localStorage.getItem(noticeShownKey)) {
                const fragment = document.createDocumentFragment();

                const titleEl = document.createElement('strong');
                titleEl.textContent = "Mousewheel Image Zoom";
                fragment.appendChild(titleEl);

                fragment.appendChild(document.createElement('br'));

                const messageEl = document.createElement('span');
                messageEl.textContent = CtrlCanvasConflictWarning;
                fragment.appendChild(messageEl);

                fragment.appendChild(document.createElement('br'));

                const settingsButton = document.createElement('button');
                settingsButton.textContent = "Open Settings";
                settingsButton.style.marginTop = "5px";
                settingsButton.onclick = () => {
                    // settings is a private property of the app object, so we need to cast it to any to access it
                    // See https://forum.obsidian.md/t/open-settings-for-my-plugin-community-plugin-settings-deeplink/61563/4
                    const setting = (this.app as any).setting;
                    setting.open();
                    setting.openTabById(this.manifest.id);
                };
                fragment.appendChild(settingsButton);


                const notice = new Notice(fragment, 0);

                 // Set the flag in localStorage so the notice doesn't appear again
                 // unless the user clears their localStorage or the key changes.
                 localStorage.setItem(noticeShownKey, 'true');
        }
    }


    /**
     * When the config key is released, we enable the scroll again and reset the key held down flag.
     */
    onConfigKeyUp(currentWindow: Window) {
        this.isKeyHeldDown = false;
        this.enableScroll(currentWindow);
    }

    onunload(currentWindow: Window = window) {
        // Re-enable the normal scrolling behavior when the plugin unloads
        this.enableScroll(currentWindow);
    }

     /**
     * Registers image resizing events for the specified window
     * @param currentWindow window in which to register events
     * @private
     */
    private registerEvents(currentWindow: Window) {
        const doc: Document = currentWindow.document;
        this.registerDomEvent(doc, "keydown", (evt) => {
            if (evt.code === this.settings.modifierKey.toString()) {
                // When canvas mode is enabled we just ignore the keydown event if the canvas is active
                const isActiveViewCanvas = this.app.workspace.getActiveViewOfType(View)?.getViewType() === "canvas";
                if (isActiveViewCanvas && !this.settings.resizeInCanvas) {
                    return;
                }

                this.isKeyHeldDown = true;

                if (this.settings.modifierKey !== ModifierKey.SHIFT && this.settings.modifierKey !== ModifierKey.SHIFT_RIGHT) { // Ignore shift to allow horizontal scrolling
                    // Disable the normal scrolling behavior when the key is held down
                    this.disableScroll(currentWindow);
                }
            }
        });
        this.registerDomEvent(doc, "keyup", (evt) => {
            if (evt.code === this.settings.modifierKey.toString()) {
                this.onConfigKeyUp(currentWindow);
            }
        });
        this.registerDomEvent(doc, "wheel", (evt) => {
            if (this.isKeyHeldDown) {
                // When for example using Alt + Tab to switch between windows, the key is still recognized as held down.
                // We check if the key is really held down by checking if the key is still pressed in the event when the
                // wheel event is triggered.
                if (!this.isConfiguredKeyDown(evt)) {
                    this.onConfigKeyUp(currentWindow);
                    return;
                }

                const eventTarget = evt.target as Element;
                
                const targetIsCanvas: boolean = eventTarget.hasClass("canvas-node-content-blocker")
                const targetIsCanvasNode: boolean = eventTarget.closest(".canvas-node-content") !== null;
                const targetIsImage: boolean = eventTarget.nodeName === "IMG";

                if (targetIsCanvas || targetIsCanvasNode || targetIsImage) {
                    this.disableScroll(currentWindow);
                }

                if (targetIsCanvas && this.settings.resizeInCanvas){                  
                    // seems we're trying to zoom on some canvas node.                    
                    this.handleZoomForCanvas(evt, eventTarget);
                } 
                else if (targetIsCanvasNode) {
                    // we trying to resize focused canvas node.
                    // i think here can be implementation of zoom images in embded markdown files on canvas. 
                }
                else if (targetIsImage) {
                    // Stack consecutive image lines instead of resizing
                    this.handleStack(evt, eventTarget);
                }
            }
        });
         this.registerDomEvent(currentWindow, "blur", () => {
             // When the window loses focus, ensure scrolling is re-enabled for this window
             // and reset the key held state defensively, although the keyup should ideally handle it.
             this.isKeyHeldDown = false;
             this.enableScroll(currentWindow);
         });
    }

     /**
     * Handles zooming with the mousewheel on canvas node 
     * @param evt wheel event
     * @param eventTarget targeted canvas node element
     * @private
     */
    handleZoomForCanvas(evt: WheelEvent, eventTarget: Element) {
        // get active canvas
        const isCanvas: boolean = this.app.workspace.getActiveViewOfType(View).getViewType() === "canvas";
        if (!isCanvas) {
            throw new Error("Can't find canvas");
        };
        // Unfortunately the current type definitions don't include any canvas functionality...
        const canvas = (this.app.workspace.getActiveViewOfType(View) as any).canvas;
        
        // get triggered canvasNode
        const canvasNode = 
            Array.from(canvas.nodes.values())
            .find(node => (node as any).contentBlockerEl == eventTarget) as any;
                
        // Adjust delta based on the direction of the resize
        let delta = evt.deltaY > 0 ? this.settings.stepSize : this.settings.stepSize * -1;

        // Calculate new dimensions directly using the delta and aspectRatio
        const aspectRatio = canvasNode.width / canvasNode.height;
        const newWidth = canvasNode.width + delta;
        const newHeight = newWidth / aspectRatio;

        // Resize the canvas node using the new dimensions
        canvasNode.resize({width: newWidth, height: newHeight});
    }


    /**
     * Handles zooming with the mousewheel on an image
     * @param evt wheel event
     * @param eventTarget targeted image element
     * @private
     */
    private async handleStack(evt: WheelEvent, eventTarget: Element) {
        const imageUri = eventTarget.attributes.getNamedItem("src").textContent;

        const activeFile: TFile = await this.getActivePaneWithImage(eventTarget);

        await this.app.vault.process(activeFile, (fileText) => {
            let frontmatter = "";
            let body = fileText;
            const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\n*/;
            const match = fileText.match(frontmatterRegex);

            if (match) {
                frontmatter = match[0]; // Keep the full matched frontmatter block including delimiters and trailing newline
                body = fileText.slice(frontmatter.length); // The rest is the body
            }


            const searchString = this.getSearchStringForImage(imageUri, eventTarget);
            const lines = body.split(/\r?\n/);

            const obsidianImagePattern = /^!\[\[[^\]]+\]\](\|\d+)?\s*$/;
            const markdownImagePattern = /^!\[[^\]]*]\([^\)]+\)\s*$/;

            const isImageLine = (line: string) => {
                const trimmed = line.trim();
                return obsidianImagePattern.test(trimmed) || markdownImagePattern.test(trimmed);
            };

            let index = lines.findIndex(line => line.includes(searchString) && isImageLine(line));
            if (index === -1) {
                return fileText;
            }

            let start = index;
            let end = index;

            while (start > 0 && isImageLine(lines[start - 1])) start--;
            while (end < lines.length - 1 && isImageLine(lines[end + 1])) end++;

            const images = [] as string[];
            for (let i = start; i <= end; i++) {
                const trimmed = lines[i].trim();
                if (trimmed.length > 0) images.push(trimmed);
            }

            lines.splice(start, end - start + 1, images.join(' '));
            const modifiedBody = lines.join('\n');

            return frontmatter + modifiedBody;
        });
    }


    /**
     * Loop through all panes and get the pane that hosts a markdown file with the image to zoom
     * @param imageElement The HTML Element of the image
     * @private
     */
    private async getActivePaneWithImage(imageElement: Element): Promise<TFile> {
        return new Promise(((resolve, reject) => {
            this.app.workspace.iterateAllLeaves(leaf => {
                if (leaf.view.containerEl.contains(imageElement) && leaf.view instanceof MarkdownView) {
                    resolve(leaf.view.file);
                }
            })

            reject(new Error("No file belonging to the image found"))
        }))
    }


    private getZoomParams(imageUri: string, fileText: string, target: Element) {
        if (imageUri.contains("http")) {
            return Util.getRemoteImageZoomParams(imageUri, fileText)
        } else if (target.classList.value.match("excalidraw-svg.*")) {
            const src = target.attributes.getNamedItem("filesource").textContent;
            // remove ".md" from the end of the src
            const imageName = src.substring(0, src.length - 3);
            // Only get text after "/"
            const imageNameAfterSlash = imageName.substring(imageName.lastIndexOf("/") + 1);
            return Util.getLocalImageZoomParams(imageNameAfterSlash, fileText)
        } else if (imageUri.contains("app://")) {
            const imageName = Util.getLocalImageNameFromUri(imageUri);
            return Util.getLocalImageZoomParams(imageName, fileText)
        } else if (imageUri.contains("data:image/")) { // for image generated by PDF++ extension
            // example: data:image/png;base64,iVB...
            const imageName = Util.getLocalImageNameFromUri(target.parentElement.getAttribute("src"));
            return Util.getLocalImageZoomParams(imageName, fileText)
        }

       throw new Error("Image is not zoomable")
    }

    private getSearchStringForImage(imageUri: string, target: Element): string {
        if (imageUri.contains("http") || imageUri.startsWith("data:image/")) {
            return imageUri;
        } else if (target.classList.value.match("excalidraw-svg.*")) {
            const src = target.attributes.getNamedItem("filesource").textContent;
            const imageName = src.substring(0, src.length - 3);
            return imageName.substring(imageName.lastIndexOf("/") + 1);
        } else if (imageUri.contains("app://")) {
            return Util.getLocalImageNameFromUri(imageUri);
        }
        return imageUri;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Utilities to disable and enable scrolling //


    preventDefault(ev: WheelEvent) {
        ev.preventDefault();
    }

    wheelOpt: AddEventListenerOptions = {passive: false, capture: true }
    wheelEvent = 'wheel' as keyof WindowEventMap;

    /**
     * Disables the normal scroll event
     */
    disableScroll(currentWindow: Window) {
        currentWindow.addEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt);
    }
 
    /**
     * Enables the normal scroll event
     */
    enableScroll(currentWindow: Window) {
        currentWindow.removeEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt);
    }

    private isConfiguredKeyDown(evt: WheelEvent): boolean {
        switch (this.settings.modifierKey) {
            case ModifierKey.ALT:
            case ModifierKey.ALT_RIGHT:
                return evt.altKey;
            case ModifierKey.CTRL:
            case ModifierKey.CTRL_RIGHT:
                return evt.ctrlKey;
            case ModifierKey.SHIFT:
            case ModifierKey.SHIFT_RIGHT:
                return evt.shiftKey;
        }
    }


}

class MouseWheelZoomSettingsTab extends PluginSettingTab {
    plugin: MouseWheelZoomPlugin;
    warningEl: HTMLDivElement;

    constructor(app: App, plugin: MouseWheelZoomPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Helper function to update the warning message
    updateWarningMessage(modifierKey: ModifierKey, resizeInCanvas: boolean): void {
        if (!this.warningEl) return;

        const isCtrl = modifierKey === ModifierKey.CTRL || modifierKey === ModifierKey.CTRL_RIGHT;
        const conflict = isCtrl && resizeInCanvas;

        if (conflict) {
            this.warningEl.setText(CtrlCanvasConflictWarning);
            this.warningEl.style.display = 'block'; 
            this.warningEl.style.color = 'var(--text-warning)';
             this.warningEl.style.marginTop = '10px'; 
        } else {
            this.warningEl.setText(""); 
            this.warningEl.style.display = 'none'; 
        }
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for mousewheel zoom'});

        new Setting(containerEl)
            .setName('Trigger Key')
            .setDesc('Key that needs to be pressed down for mousewheel zoom to work.')
            .addDropdown(dropdown => dropdown
                .addOption(ModifierKey.CTRL, "Ctrl")
                .addOption(ModifierKey.ALT, "Alt")
                .addOption(ModifierKey.SHIFT, "Shift")
                .addOption(ModifierKey.CTRL_RIGHT, "Right Ctrl")
                .addOption(ModifierKey.ALT_RIGHT, "Right Alt")
                .addOption(ModifierKey.SHIFT_RIGHT, "Right Shift")
                .setValue(this.plugin.settings.modifierKey)
                .onChange(async (value) => {
                    this.plugin.settings.modifierKey = value as ModifierKey;
                    this.updateWarningMessage(this.plugin.settings.modifierKey , this.plugin.settings.resizeInCanvas);
                    await this.plugin.saveSettings()
                })
            );

        new Setting(containerEl)
            .setName('Step size')
            .setDesc('Step value by which the size of the image should be increased/decreased')
            .addSlider(slider => {
                slider
                    .setValue(25)
                    .setLimits(0, 100, 1)
                    .setDynamicTooltip()
                    .setValue(this.plugin.settings.stepSize)
                    .onChange(async (value) => {
                        this.plugin.settings.stepSize = value
                        await this.plugin.saveSettings()
                    })
            })

        new Setting(containerEl)
            .setName('Initial Size')
            .setDesc('Initial image size if no size was defined beforehand')
            .addSlider(slider => {
                slider
                    .setValue(500)
                    .setLimits(0, 1000, 25)
                    .setDynamicTooltip()
                    .setValue(this.plugin.settings.initialSize)
                    .onChange(async (value) => {
                        this.plugin.settings.initialSize = value
                        await this.plugin.saveSettings()
                    })
            })

        new Setting(containerEl)
            .setName('Resize in canvas')
            .setDesc('When enabled, all nodes on the Obsidian canvas can also be resized using the Modifier key')
            .addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.resizeInCanvas)
					.onChange(async (value) => {
						this.plugin.settings.resizeInCanvas = value;
                        this.updateWarningMessage(this.plugin.settings.modifierKey, value);
						await this.plugin.saveSettings();
					});
			});

        this.warningEl = containerEl.createDiv({ cls: 'mousewheel-zoom-warning' });
        this.warningEl.style.display = 'none';
        this.updateWarningMessage(this.plugin.settings.modifierKey, this.plugin.settings.resizeInCanvas);
    
    }
}




