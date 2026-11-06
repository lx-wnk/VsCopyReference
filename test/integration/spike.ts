import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface UsageSpec {
    file: string;
    token: string;
    lines?: [number, number]; // 1-based, inclusive
    lineContains?: string;
}

const PHP_USAGES: UsageSpec[] = ['lessThanOrEquals', 'EPSILON', 'tolerance', 'helper', 'baseMethod', 'compare', '$local']
    .map((token) => ({ file: 'src/Caller.php', token, lines: [12, 19] as [number, number] }));

const JS_USAGES: UsageSpec[] = [
    ['round', 'round(1)'],
    ['Calc', 'new Calc()'],
    ['add', '.add()'],
    ['cfg', 'cfg.a.b'],
    ['b', 'cfg.a.b'],
    ['withLocal', 'withLocal();'],
    ['tinyFn', 'tinyFn();'],
].map(([token, lineContains]) => ({ file: 'src/use.js', token, lineContains }));

const PHP_SYMBOL_FILES = [
    'vendor/acme/util/src/FloatComparator.php',
    'vendor/acme/util/src/ComparatorBase.php',
    'src/Comparable.php',
    'src/Caller.php',
];
const JS_SYMBOL_FILES = ['src/math.js', 'node_modules/tiny/index.js'];

const POLL_INTERVAL_MS = 2000;
const POLL_LIMIT_MS = 60000;
const EXTRA_WAIT_MS = 30000;

let workspaceRoot: string;

const pos = (p: vscode.Position) => ({ line: p.line, character: p.character });
const range = (r: vscode.Range) => ({ start: pos(r.start), end: pos(r.end) });
const rel = (uri: vscode.Uri) => path.relative(workspaceRoot, uri.fsPath);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

function serializeSymbol(s: vscode.DocumentSymbol | vscode.SymbolInformation): unknown {
    if ('range' in s) {
        return {
            type: 'DocumentSymbol',
            name: s.name,
            kind: s.kind,
            kindName: vscode.SymbolKind[s.kind],
            detail: s.detail,
            range: range(s.range),
            selectionRange: range(s.selectionRange),
            children: s.children.map(serializeSymbol),
        };
    }
    return {
        type: 'SymbolInformation',
        name: s.name,
        kind: s.kind,
        kindName: vscode.SymbolKind[s.kind],
        containerName: s.containerName,
        location: { uri: rel(s.location.uri), range: range(s.location.range) },
    };
}

function serializeDefinition(d: vscode.Location | vscode.LocationLink): unknown {
    if ('targetUri' in d) {
        return {
            type: 'LocationLink',
            targetUri: rel(d.targetUri),
            targetRange: range(d.targetRange),
            targetSelectionRange: d.targetSelectionRange ? range(d.targetSelectionRange) : null,
            originSelectionRange: d.originSelectionRange ? range(d.originSelectionRange) : null,
        };
    }
    return { type: 'Location', uri: rel(d.uri), range: range(d.range) };
}

async function execute<T>(command: string, ...args: unknown[]): Promise<{ result?: T; error?: string }> {
    try {
        return { result: await vscode.commands.executeCommand<T>(command, ...args) };
    } catch (e) {
        return { error: errorMessage(e) };
    }
}

function findPosition(text: string, spec: UsageSpec): vscode.Position | undefined {
    const lines = text.split('\n');
    const [from, to] = spec.lines ?? [1, lines.length];
    for (let i = from - 1; i < Math.min(to, lines.length); i++) {
        if (spec.lineContains && !lines[i].includes(spec.lineContains)) {
            continue;
        }
        const column = spec.lineContains
            ? lines[i].indexOf(spec.lineContains) + spec.lineContains.indexOf(spec.token)
            : lines[i].indexOf(spec.token);
        if (column >= 0) {
            return new vscode.Position(i, column + (spec.token.startsWith('$') ? 1 : 0));
        }
    }
    return undefined;
}

async function measureDefinitions(specs: UsageSpec[]): Promise<unknown[]> {
    const out: unknown[] = [];
    for (const spec of specs) {
        const uri = vscode.Uri.file(path.join(workspaceRoot, spec.file));
        const text = fs.readFileSync(uri.fsPath, 'utf8');
        const position = findPosition(text, spec);
        if (!position) {
            out.push({ file: spec.file, token: spec.token, error: 'token not found' });
            continue;
        }
        const { result, error } = await execute<Array<vscode.Location | vscode.LocationLink>>(
            'vscode.executeDefinitionProvider', uri, position);
        out.push({
            file: spec.file,
            token: spec.token,
            position: pos(position),
            error,
            results: result?.map(serializeDefinition),
        });
    }
    return out;
}

async function measureSymbols(file: string): Promise<unknown> {
    const uri = vscode.Uri.file(path.join(workspaceRoot, file));
    const symbolsOnce = async () => {
        const { result, error } = await execute<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
            'vscode.executeDocumentSymbolProvider', uri);
        return { error, symbols: result?.map(serializeSymbol) ?? [] };
    };

    const started = Date.now();
    const immediate = { elapsedMs: 0, ...(await symbolsOnce()) };
    let final = immediate;
    while (final.symbols.length === 0 && Date.now() - started < POLL_LIMIT_MS) {
        await sleep(POLL_INTERVAL_MS);
        final = { elapsedMs: Date.now() - started, ...(await symbolsOnce()) };
    }
    return { file, immediate, final };
}

export async function run(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        throw new Error('No workspace folder open');
    }
    workspaceRoot = folder.uri.fsPath;
    const provider = process.env.COPY_REFERENCE_PROVIDER ?? 'unknown';
    const isJs = provider === 'js';
    const usages = isJs ? JS_USAGES : PHP_USAGES;
    const symbolFiles = isJs ? JS_SYMBOL_FILES : PHP_SYMBOL_FILES;

    const definitionsImmediate = await measureDefinitions(usages);
    const symbols = [];
    for (const file of symbolFiles) {
        symbols.push(await measureSymbols(file));
    }
    const definitionsAfterPolling = await measureDefinitions(usages);
    await sleep(EXTRA_WAIT_MS);
    const definitionsAfterWait = await measureDefinitions(usages);

    const outFile = path.resolve(__dirname, '../../spike', `${provider}.json`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({
        provider,
        vscodeVersion: vscode.version,
        definitionsImmediate,
        definitionsAfterPolling,
        definitionsAfterWait,
        symbols,
    }, null, 2));

    console.log(`spike ${provider}: wrote ${outFile}`);
    for (const s of symbols as Array<{ file: string; immediate: any; final: any }>) {
        console.log(`  ${s.file}: immediate=${s.immediate.symbols.length} final=${s.final.symbols.length} after ${s.final.elapsedMs}ms`);
    }
}
