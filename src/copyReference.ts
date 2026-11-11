import * as vscode from 'vscode';
import { languageFor } from './languages';
import { Kind, SymbolNode, selectChain } from './symbols';

export type Reference = { text: string; isFallback: boolean };

const KINDS: Partial<Record<vscode.SymbolKind, Kind>> = {
    [vscode.SymbolKind.Namespace]: 'namespace',
    [vscode.SymbolKind.Module]: 'namespace',
    [vscode.SymbolKind.Package]: 'namespace',
    [vscode.SymbolKind.Class]: 'class',
    [vscode.SymbolKind.Interface]: 'class',
    [vscode.SymbolKind.Enum]: 'class',
    [vscode.SymbolKind.Struct]: 'class',
    [vscode.SymbolKind.Function]: 'function',
    [vscode.SymbolKind.Method]: 'method',
    [vscode.SymbolKind.Constructor]: 'method',
    [vscode.SymbolKind.Property]: 'property',
    [vscode.SymbolKind.Field]: 'property',
    [vscode.SymbolKind.Constant]: 'constant',
    [vscode.SymbolKind.EnumMember]: 'constant',
    [vscode.SymbolKind.Variable]: 'variable',
};

let output: vscode.OutputChannel | undefined;

export function logError(error: unknown, document: vscode.TextDocument): void {
    output ??= vscode.window.createOutputChannel('Copy Reference');
    const cause = error instanceof Error ? error.stack ?? error.message : String(error);
    output.appendLine(`${document.uri.toString()}\n${cause}`);
}

function toNode(symbol: vscode.DocumentSymbol | vscode.SymbolInformation): SymbolNode {
    const kind = KINDS[symbol.kind] ?? 'other';
    if ('range' in symbol) {
        return {
            name: symbol.name,
            kind,
            detail: symbol.detail,
            range: symbol.range,
            selectionRange: symbol.selectionRange,
            children: symbol.children.map(toNode),
        };
    }
    return { name: symbol.name, kind, detail: '', range: symbol.location.range, selectionRange: symbol.location.range, children: [] };
}

async function resolveTarget(document: vscode.TextDocument, position: vscode.Position) {
    const definitions = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
        'vscode.executeDefinitionProvider', document.uri, position,
    );
    const first = definitions?.[0];
    if (!first) {
        return { uri: document.uri, position, fromDefinition: false };
    }
    if ('targetUri' in first) {
        return { uri: first.targetUri, position: (first.targetSelectionRange ?? first.targetRange).start, fromDefinition: true };
    }
    return { uri: first.uri, position: first.range.start, fromDefinition: true };
}

async function resolve(document: vscode.TextDocument, position: vscode.Position): Promise<string | undefined> {
    const target = await resolveTarget(document, position);
    const targetDocument = await vscode.workspace.openTextDocument(target.uri);
    const language = languageFor(targetDocument.languageId);
    if (!language) {
        return undefined;
    }
    const symbols = await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[]>(
        'vscode.executeDocumentSymbolProvider', target.uri,
    );
    const range = targetDocument.getWordRangeAtPosition(target.position, language.identifierPattern);
    const identifier = range ? targetDocument.getText(range) : undefined;
    const nodes = (symbols ?? []).map(toNode);
    const chain = selectChain(nodes, target.position, identifier, target.fromDefinition, language.normalizeName);
    return chain && language.format({ chain: language.qualify?.(nodes, chain) ?? chain, relativePath: vscode.workspace.asRelativePath(target.uri, false) });
}

export async function computeReference(document: vscode.TextDocument, position: vscode.Position): Promise<Reference> {
    try {
        const text = await resolve(document, position);
        if (text !== undefined) {
            return { text, isFallback: false };
        }
    } catch (error) {
        logError(error, document);
    }
    return { text: `${vscode.workspace.asRelativePath(document.uri, false)}:${position.line + 1}`, isFallback: true };
}
