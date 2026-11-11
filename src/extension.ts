import * as vscode from 'vscode';
import { computeReference, logError } from './copyReference';
import { Language } from './language';
import { languageFor } from './languages';

const STATUS_BAR_MS = 3000;
const hintedLanguages = new Set<string>();
let statusMessage: vscode.Disposable | undefined;

export function missingRecommendation(
    language: Language,
    isInstalled: (id: string) => boolean,
): readonly string[] | undefined {
    const ids = language.recommendedExtensions;
    return ids.length === 0 || ids.some(isInstalled) ? undefined : ids;
}

async function showExtensionHint(languageId: string): Promise<void> {
    const language = languageFor(languageId);
    if (!language || hintedLanguages.has(languageId)) {
        return;
    }
    const ids = missingRecommendation(language, (id) => vscode.extensions.getExtension(id) !== undefined);
    if (!ids) {
        return;
    }
    hintedLanguages.add(languageId);
    const choice = await vscode.window.showInformationMessage(
        `Copy Reference needs a language extension for precise references in ${languageId} files.`,
        'Show extensions',
    );
    if (choice === 'Show extensions') {
        await vscode.commands.executeCommand('workbench.extensions.search', ids.map((id) => '@id:' + id).join(' '));
    }
}

async function copyReference(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const { text, isFallback } = await computeReference(editor.document, editor.selection.active);
    await vscode.env.clipboard.writeText(text);
    const prefix = isFallback ? 'Copied path and line (no symbol reference)' : 'Copied reference';
    statusMessage?.dispose();
    statusMessage = vscode.window.setStatusBarMessage(`${prefix}: ${text}`, STATUS_BAR_MS);
    if (isFallback) {
        showExtensionHint(editor.document.languageId).catch((e) => logError(e, editor.document));
    }
}

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('copyReference.copy', copyReference),
    );
}

export function deactivate(): void {}
