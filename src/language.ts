import { SymbolNode } from './symbols';

export type FormatInput = { chain: SymbolNode[]; relativePath: string };

export type Language = {
    languageIds: readonly string[];
    recommendedExtensions: readonly string[];
    identifierPattern?: RegExp;
    normalizeName?(name: string): string;
    qualify?(symbols: SymbolNode[], chain: SymbolNode[]): SymbolNode[];
    format(input: FormatInput): string | undefined;
};
