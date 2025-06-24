import { App, MarkdownView, Plugin, TFile, WorkspaceWindow } from 'obsidian';
import { Util } from './src/util';

export default class MouseWheelZoomPlugin extends Plugin {
    hoveredImage: Element | null = null;

    async onload() {
        this.registerEvent(
            this.app.workspace.on('window-open', (newWindow: WorkspaceWindow) =>
                this.registerEvents(newWindow.win)
            )
        );
        this.registerEvents(window);

        this.addCommand({
            id: 'stack-adjacent-images',
            name: 'Stack adjacent images',
            hotkeys: [{ modifiers: ['Mod', 'Alt'], key: 's' }],
            checkCallback: (checking: boolean) => {
                if (!this.hoveredImage) return false;
                if (checking) return true;
                this.stackImages(this.hoveredImage);
                return true;
            },
        });

        console.log('Loaded: Image stacker');
    }

    private registerEvents(currentWindow: Window) {
        const doc: Document = currentWindow.document;
        this.registerDomEvent(doc, 'mouseover', (evt) => {
            const target = evt.target as Element;
            if (target.nodeName === 'IMG') {
                this.hoveredImage = target;
            }
        });
        this.registerDomEvent(doc, 'mouseout', (evt) => {
            if (evt.target === this.hoveredImage) {
                this.hoveredImage = null;
            }
        });
    }

    private async stackImages(eventTarget: Element) {
        const imageUri = eventTarget.getAttribute('src');
        if (!imageUri) return;
        const activeFile: TFile = await this.getActivePaneWithImage(eventTarget);

        await this.app.vault.process(activeFile, (fileText) => {
            let frontmatter = '';
            let body = fileText;
            const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\n*/;
            const match = fileText.match(frontmatterRegex);

            if (match) {
                frontmatter = match[0];
                body = fileText.slice(frontmatter.length);
            }

            const searchString = this.getSearchStringForImage(imageUri, eventTarget);
            const lines = body.split(/\r?\n/);

            const obsidianImagePattern = /^!\[\[[^\]]+\]\](\|\d+)?\s*$/;
            const markdownImagePattern = /^!\[[^\]]*]\([^\)]+\)\s*$/;

            const isImageLine = (line: string) => {
                const trimmed = line.trim();
                return obsidianImagePattern.test(trimmed) || markdownImagePattern.test(trimmed);
            };

            const isIgnorable = (line: string) => !/[A-Za-z0-9]/.test(line.trim());

            let index = lines.findIndex((line) => line.includes(searchString) && isImageLine(line));
            if (index === -1) return fileText;

            let start = index;
            let end = index;

            while (start > 0 && (isImageLine(lines[start - 1]) || isIgnorable(lines[start - 1]))) start--;
            while (end < lines.length - 1 && (isImageLine(lines[end + 1]) || isIgnorable(lines[end + 1]))) end++;

            const images: string[] = [];
            for (let i = start; i <= end; i++) {
                const trimmed = lines[i].trim();
                if (isImageLine(trimmed)) {
                    images.push(trimmed);
                }
            }

            lines.splice(start, end - start + 1, images.join(' '));
            const modifiedBody = lines.join('\n');

            return frontmatter + modifiedBody;
        });
    }

    private async getActivePaneWithImage(imageElement: Element): Promise<TFile> {
        return new Promise((resolve, reject) => {
            this.app.workspace.iterateAllLeaves((leaf) => {
                if (leaf.view.containerEl.contains(imageElement) && leaf.view instanceof MarkdownView) {
                    resolve(leaf.view.file);
                }
            });
            reject(new Error('No file belonging to the image found'));
        });
    }

    private getSearchStringForImage(imageUri: string, target: Element): string {
        if (imageUri.contains('http') || imageUri.startsWith('data:image/')) {
            return imageUri;
        } else if (target.classList.value.match('excalidraw-svg.*')) {
            const src = target.getAttribute('filesource');
            if (!src) return imageUri;
            const imageName = src.substring(0, src.length - 3);
            return imageName.substring(imageName.lastIndexOf('/') + 1);
        } else if (imageUri.contains('app://')) {
            return Util.getLocalImageNameFromUri(imageUri);
        }
        return imageUri;
    }
}

