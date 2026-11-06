import { Language } from '../language';
import { js } from './js';
import { php } from './php';

export const languages: readonly Language[] = [php, js];

export function languageFor(languageId: string): Language | undefined {
    return languages.find(language => language.languageIds.includes(languageId));
}
