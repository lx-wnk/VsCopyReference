import { FormatInput, Language } from '../language';

function format({ chain, relativePath }: FormatInput): string | undefined {
    if (chain.length === 0) {
        return undefined;
    }
    return `${relativePath}:${chain.map(node => node.name).join('.')}`;
}

export const js: Language = {
    languageIds: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
    recommendedExtensions: [],
    format,
};
