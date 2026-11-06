import { SymbolNode } from './symbols';

export type FormatInput = { chain: SymbolNode[]; relativePath: string };

export type Language = {
    languageIds: readonly string[];
    recommendedExtensions: readonly string[];
    format(input: FormatInput): string | undefined;
};
