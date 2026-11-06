import { FormatInput, Language } from '../language';
import { baseName, SymbolNode } from '../symbols';

function memberSuffix(member: SymbolNode): string | undefined {
    const name = baseName(member.name);
    switch (member.kind) {
        case 'method':
        case 'constant':
            return `::${name}`;
        case 'property':
            return `::$${name}`;
        case 'other':
        case 'variable':
            return member.name.includes('(') ? undefined : `::$${name}`;
        default:
            return undefined;
    }
}

function format({ chain }: FormatInput): string | undefined {
    const namespace = chain[0]?.kind === 'namespace' ? chain[0] : undefined;
    const [head, member, ...extra] = namespace ? chain.slice(1) : chain;
    if (!head || extra.length > 0) {
        return undefined;
    }
    const prefix = namespace ? `\\${namespace.name}\\` : '\\';
    if (head.kind === 'class') {
        const suffix = member ? memberSuffix(member) : '';
        return suffix === undefined ? undefined : prefix + baseName(head.name) + suffix;
    }
    if (!member && (head.kind === 'function' || head.kind === 'constant')) {
        return prefix + baseName(head.name);
    }
    return undefined;
}

export const php: Language = {
    languageIds: ['php'],
    recommendedExtensions: ['devsense.phptools-vscode', 'bmewburn.vscode-intelephense-client'],
    format,
};
