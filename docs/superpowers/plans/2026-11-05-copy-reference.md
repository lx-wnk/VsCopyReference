# Copy Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VS Code extension that copies a PhpStorm-style reference for the symbol under the cursor, for PHP and JS/TS, extensible to more languages.

**Architecture:** A pure core (`symbols.ts`, language formatters) works on plain data and is unit-tested without VS Code. A thin adapter (`copyReference.ts`) gets data through `vscode.executeDefinitionProvider` and `vscode.executeDocumentSymbolProvider`. `extension.ts` handles clipboard, status bar and hint.

**Tech Stack:** TypeScript compiled with `tsc`, `node:test` for unit tests, `@vscode/test-electron` for integration tests, `@vscode/vsce` for packaging. No runtime dependencies, no bundler.

**Spec:** `docs/superpowers/specs/2026-11-05-copy-reference-design.md`

## Global Constraints

- No runtime dependencies. No bundled parsers or language servers.
- PHP works with `devsense.phptools-vscode` and `bmewburn.vscode-intelephense-client`. No `extensionDependencies`.
- Never copy a guessed name or the enclosing method. When unsure, use the fallback `relative/path:line` (1-based cursor line).
- No text-based search for the enclosing class. The only text pattern is the anchored PHP `namespace` statement.
- No line number on symbol references.
- All code, comments and docs in English. Comments only where the code cannot show the reason.
- Work on branch `feat/copy-reference`, created from `docs/copy-reference-design`. Commit messages end with the session's attribution lines.

## Review Focus

1. Method inherited from a parent class: `$child->parentMethod()` copies the parent's reference, not the child's. Test in Task 5.
2. Interface method with several definitions: uses the first result and does not throw. Test in Task 5.
3. Language server not ready or missing: copies the fallback, marks it as fallback, does not throw. Test in Task 5.
4. File outside any workspace folder: fallback uses the absolute path. Test in Task 5.
5. File with several namespaces or CRLF line endings: uses the namespace nearest above the target. Test in Task 3.

---

### Task 1: Scaffold and provider spike

Settles the spec's "Verify first" section. **Ends with a stop: report results to the owner before Task 2.**

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.vscodeignore`, `src/extension.ts`
- Create: `test/integration/runTests.ts`, `test/integration/spike.ts`
- Create: `test/fixtures/php/composer.json`, `test/fixtures/php/src/Caller.php`, `test/fixtures/php/src/Child.php`
- Create: `test/fixtures/php/vendor/acme/util/src/FloatComparator.php`, `test/fixtures/php/vendor/acme/util/src/ComparatorBase.php`
- Create: `test/fixtures/php/src/Comparable.php`, `test/fixtures/js/src/math.js`, `test/fixtures/js/src/use.js`, `test/fixtures/none/src/note.txt`
- Create: `docs/superpowers/specs/2026-11-05-copy-reference-spike-results.md`

**Interfaces:**
- Produces: `npm run compile`, `npm run test:unit` (`node --test out/test/unit/`), `npm run spike:phptools`, `spike:intelephense`, `spike:js`, and `npm run test:integration`, which runs the integration suites against `phptools`, `intelephense`, `js` and `none` in turn.
- Produces: `test/integration/runTests.ts` reads env `PROVIDER` (`phptools`, `intelephense`, `none`) and `SUITE` (path to compiled test module). It installs the provider into an isolated `--extensions-dir` and opens the matching fixture folder.

- [ ] **Step 1: Create the scaffold**

`engines.vscode` `^1.95.0`, command ID `copyReference.copy`, `.gitignore` entries anchored to the root (`/node_modules`, `/out`, `/.vscode-test`, `*.vsix`) so the fixture `vendor/` stays tracked. `src/extension.ts` exports empty `activate`.

- [ ] **Step 2: Create fixtures**

`FloatComparator` in namespace `Acme\Util` has `const EPSILON`, `public $tolerance`, `public static function lessThanOrEquals()`. Same namespace has `function helper()` and extends `ComparatorBase` with `baseMethod()`. `Caller.php` uses each one and has a local `$local` and a blank line inside a method. `Child.php` extends `FloatComparator`. `Comparable.php` holds an interface with `compare()` and two implementing classes, called from `Caller.php`. `test/fixtures/none/src/note.txt` holds one line. `math.js` has `export function round`, `export class Calc { add() {} }`, `export const cfg = { a: { b: 1 } }` and a function with a local.

- [ ] **Step 3: Write `spike.ts`**

For each fixture file, keep it closed where the case requires it. Print raw JSON of the definition and symbol commands: at startup, then after polling up to 60 seconds. Include a closed `vendor/` file and, for JS, a closed `node_modules/` file.

- [ ] **Step 4: Run all three spikes**

Run: `npm run compile && npm run spike:phptools && npm run spike:intelephense && npm run spike:js`
Expected: JSON output for each provider. If PHP Tools needs a licence or trial in the test host, record it and run it against the owner's normal VS Code instead.

- [ ] **Step 5: Write spike results**

Record per provider: how the namespace appears, what ranges cover, method and property naming, whether a closed `vendor/` file returns symbols, and whether it needs indexing time.

- [ ] **Step 6: Commit**

`git add` the files above. Message: `chore: scaffold extension and record provider spike`.

- [ ] **Step 7: STOP and report to owner**

Report results. If `vendor/` stays empty, say so plainly with what a hint or provider setting can do. Wait for approval. If the results contradict Tasks 2 to 5, update the plan first.

### Task 2: Symbol selection

**Files:**
- Create: `src/symbols.ts`
- Test: `test/unit/symbols.test.ts`

**Interfaces:**
- Produces in `src/symbols.ts`:
  - `type Pos = { line: number; character: number }`, `type Rng = { start: Pos; end: Pos }`
  - `type Kind = 'namespace' | 'class' | 'function' | 'method' | 'property' | 'constant' | 'variable' | 'other'`
  - `type SymbolNode = { name: string; kind: Kind; detail: string; range: Rng; selectionRange: Rng; children: SymbolNode[] }`
  - `selectChain(symbols: SymbolNode[], pos: Pos, identifier: string | undefined, fromDefinition: boolean): SymbolNode[] | undefined`
  - `baseName(name: string): string`

- [ ] **Step 1: Write failing tests with `node:assert`**

```ts
// tree: class C (lines 0-9, name on line 0) > method m (lines 2-5, name on line 2) > variable v (line 3)
selectChain(tree, { line: 2, character: 12 }, 'm', false)   // names ['C', 'm']
selectChain(tree, { line: 4, character: 0 }, undefined, false) // undefined: blank space in a method
selectChain(tree, { line: 3, character: 8 }, 'v', false)    // undefined: function ancestor
selectChain(tree, { line: 2, character: 0 }, 'public', true) // ['C', 'm']: definition at declaration start
selectChain(tree, { line: 2, character: 0 }, 'public', false) // undefined: keyword under the cursor
selectChain([], { line: 0, character: 0 }, 'x', false)      // undefined
selectChain(objectTree, pos, 'b', false)                    // ['cfg', 'a', 'b']: object keys stay chained
baseName('$prop') === 'prop'
baseName('lessThanOrEquals()') === 'lessThanOrEquals'
baseName('Acme\\Util\\Foo') === 'Foo'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run compile && npm run test:unit`
Expected: FAIL, `selectChain` not defined.

- [ ] **Step 3: Implement `selectChain` and `baseName`**

Innermost symbol whose `range` contains `pos`. Accept when `baseName(identifier) === baseName(tail.name)`, or when `fromDefinition` and `pos` equals `tail.range.start`. Reject if any ancestor kind is `function` or `method`. Adjust `baseName` to names found in the spike results.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

Message: `feat: select symbol chain at a position`.

### Task 3: Language contract and PHP formatter

**Files:**
- Create: `src/language.ts`, `src/languages/php.ts`
- Test: `test/unit/php.test.ts`

**Interfaces:**
- Consumes: `SymbolNode`, `baseName` from Task 2.
- Produces in `src/language.ts`:
  - `type FormatInput = { chain: SymbolNode[]; text: string; line: number; relativePath: string }`
  - `type Language = { languageIds: readonly string[]; recommendedExtensions: readonly string[]; format(input: FormatInput): string | undefined }`. `undefined` means use the fallback.
- Produces: `php: Language` with `languageIds: ['php']` and both PHP extension IDs from the Global Constraints.

- [ ] **Step 1: Write failing tests**

```ts
// Same output whichever way the provider reports the namespace:
// parent namespace symbol, name 'Acme\\Util\\FloatComparator', detail 'Acme\\Util', or only the text.
'\\Acme\\Util\\FloatComparator'                     // class
'\\Acme\\Util\\FloatComparator::lessThanOrEquals'   // method
'\\Acme\\Util\\FloatComparator::EPSILON'            // class constant
'\\Acme\\Util\\FloatComparator::$tolerance'         // property, from name 'tolerance' or '$tolerance'
'\\Acme\\Util\\helper'                              // function
'\\Acme\\Util\\LIMIT'                               // global constant
'\\helper'                                          // no namespace statement
// text with 'namespace A;' and later 'namespace B;', target below B: '\\B\\Foo'
// 'namespace A { ... }': '\\A\\Foo'
// CRLF line endings: '\\Acme\\Util\\Foo'
// '// namespace Old;' above the real one: not matched
// target inside '/*\nnamespace Old;\n*/' only: undefined
// chain of class > class: undefined
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run compile && npm run test:unit`
Expected: FAIL, `php` not defined.

- [ ] **Step 3: Implement `src/language.ts` and `php.format`**

Provider namespace first, then the last match above `line` of `/^[ \t]*namespace[ \t]+([A-Za-z_][\w\\]*)[ \t]*[;{]/gm`. If the match lies inside an unclosed `/*`, return `undefined`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

Message: `feat: format PHP references`.

### Task 4: JS/TS formatter and language registry

**Files:**
- Create: `src/languages/js.ts`, `src/languages/index.ts`
- Test: `test/unit/js.test.ts`

**Interfaces:**
- Consumes: `Language` from Task 3.
- Produces: `js: Language` with `languageIds: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']` and `recommendedExtensions: []`.
- Produces in `src/languages/index.ts`: `languages: readonly Language[]` and `languageFor(languageId: string): Language | undefined`.

- [ ] **Step 1: Write failing tests**

```ts
// relativePath 'src/utils/math.js'
'src/utils/math.js:round'        // chain ['round']
'src/utils/math.js:Class.method' // chain ['Class', 'method']
'src/utils/math.js:cfg.a.b'      // chain ['cfg', 'a', 'b']
languageFor('php') === php
languageFor('typescriptreact') === js
languageFor('plaintext') === undefined
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run compile && npm run test:unit`
Expected: FAIL, `js` not defined.

- [ ] **Step 3: Implement `js.format` and the registry**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

Message: `feat: format JS references and register languages`.

### Task 5: Resolve a reference through VS Code

**Files:**
- Create: `src/copyReference.ts`
- Test: `test/integration/phpSuite.ts`, `test/integration/jsSuite.ts`, `test/integration/noneSuite.ts`

**Interfaces:**
- Consumes: `selectChain`, `SymbolNode`, `Kind`, `languageFor`.
- Produces: `computeReference(document: vscode.TextDocument, position: vscode.Position): Promise<{ text: string; isFallback: boolean }>`.

- [ ] **Step 1: Write failing integration suites**

Each suite exports `run()`. It polls until the provider returns symbols, up to 60 seconds, then asserts in plain `node:assert`. No test framework.

PHP suite, run once per provider, cursor on the usage in `Caller.php` unless noted:

```ts
'\\Acme\\Util\\FloatComparator::lessThanOrEquals'
'\\Acme\\Util\\FloatComparator::EPSILON'
'\\Acme\\Util\\FloatComparator::$tolerance'
'\\Acme\\Util\\FloatComparator'                // on the use statement
'\\Acme\\Util\\helper'
'\\Acme\\Util\\ComparatorBase::baseMethod'     // inherited, called on Child
'\\Acme\\Util\\FloatComparator::lessThanOrEquals' // cursor on the declaration itself
'src/Caller.php:<line>'  // on $local, isFallback true
'src/Caller.php:<line>'  // on the blank line in the method, isFallback true
// interface method with several implementations: returns without throwing
```

JS suite: `src/math.js:round` from `use.js`, `src/math.js:Calc.add`, `src/math.js:cfg.a.b`, and `src/math.js:<line>` on a local with `isFallback` true.

None suite, no provider installed: a `.php` file and a `.txt` file give `relative/path:line` with `isFallback` true. A file outside the workspace gives its absolute path.

- [ ] **Step 2: Run suites to verify they fail**

Run: `npm run compile && npm run test:integration`
Expected: FAIL, `computeReference` not defined.

- [ ] **Step 3: Implement `computeReference`**

Follow steps 1 to 6 in the spec's "How it works". Take `targetSelectionRange` start from a `LocationLink` when present. Map `vscode.SymbolKind` to `Kind`. Use `vscode.workspace.asRelativePath(uri, false)`, which returns the absolute path outside a workspace. Use `getWordRangeAtPosition` for the identifier, widened to include `$`. Log a thrown provider error to an output channel and return the fallback.

- [ ] **Step 4: Run suites to verify they pass**

Run: `npm run compile && npm run test:integration`
Expected: PASS for `phptools`, `intelephense`, `js`, `none`. If PHP Tools cannot run in the test host per Task 1, remove it from the script, document that, and run the PHP suite against it by hand.

- [ ] **Step 5: Commit**

Message: `feat: resolve references through language providers`.

### Task 6: Command, shortcut, status bar and extension hint

**Files:**
- Modify: `src/extension.ts`, `package.json`
- Test: `test/integration/commandSuite.ts`

**Interfaces:**
- Consumes: `computeReference`, `languageFor`.
- Produces: command `copyReference.copy`, titled `Copy Reference`.

- [ ] **Step 1: Write failing test**

```ts
await vscode.commands.executeCommand('copyReference.copy');
assert.equal(await vscode.env.clipboard.readText(), 'src/note.txt:1');
```

Also assert: `missingRecommendation(php, () => false)` returns the two IDs, `missingRecommendation(php, id => id === 'bmewburn.vscode-intelephense-client')` returns `undefined`, and `missingRecommendation(js, () => false)` returns `undefined`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npm run test:integration`
Expected: FAIL, command not found.

- [ ] **Step 3: Implement in `src/extension.ts`**

Export `missingRecommendation(language: Language, isInstalled: (id: string) => boolean): readonly string[] | undefined`. The command writes to the clipboard and calls `window.setStatusBarMessage` for 3 seconds, wording the fallback case differently. If there is a fallback and a recommendation is missing, show one notification per session, per language, with a button running `workbench.extensions.search`.

- [ ] **Step 4: Add contributions to `package.json`**

`editor/context` menu entry. Keybindings `cmd+alt+shift+c` on macOS and `ctrl+alt+shift+c` elsewhere, with `when: editorTextFocus`.

- [ ] **Step 5: Check the shortcut for conflicts**

In "Preferences: Open Default Keyboard Shortcuts (JSON)", search for the chord. A conflict scoped to `editorTextFocus` or broader goes to the owner. Conflicts scoped to other focus areas are fine.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run compile && npm run test:unit && npm run test:integration`
Expected: PASS

- [ ] **Step 7: Commit**

Message: `feat: add copy reference command and extension hint`.

### Task 7: Marketplace package

Stops short of publishing, which needs the owner's publisher ID and licence.

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `media/icon.png`
- Modify: `package.json`

**Interfaces:**
- Consumes: finished extension.
- Produces: `copy-reference-<version>.vsix`.

- [ ] **Step 1: Get owner input**

Ask for publisher ID and licence. Add `publisher` and `LICENSE` from the answer. Check the display name on the Marketplace and propose an alternative if it is taken.

- [ ] **Step 2: Write README**

Why, usage, format table from the spec, required PHP extension, known limits including the `vendor/` result from Task 1. GIF placeholder is not allowed: record the GIF in Step 4 or ship without it.

- [ ] **Step 3: Package and inspect**

Run: `npx @vscode/vsce package && npx @vscode/vsce ls`
Expected: `.vsix` is created. Listing has no `test/`, `src/`, `docs/`, or `node_modules/`.

- [ ] **Step 4: Verify in the owner's real VS Code**

Run: `code --install-extension copy-reference-*.vsix --force && shasum -a 256 copy-reference-*.vsix`, then reload the window. In a real Shopware project with PHP Tools, cursor on a `FloatComparator::lessThanOrEquals` usage, press the shortcut, and paste.
Expected: `\Shopware\Core\Framework\Util\FloatComparator::lessThanOrEquals`. Report the hash and the pasted text.

- [ ] **Step 5: Commit**

Message: `docs: prepare Marketplace package`.
