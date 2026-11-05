# Copy Reference for VS Code: Design

Date: 2026-11-05. Status: approved by owner.

Decision labels: **[owner]** stated or confirmed by the owner. **[builder call]** chosen by the author of this document; the owner has not explicitly confirmed it.

## Intent

The owner wants PhpStorm's "Copy Reference" in VS Code. Trigger example: a PHP file was open and the owner wanted to copy `\Shopware\Core\Framework\Util\FloatComparator::lessThanOrEquals`. **[owner]**

The closest existing extension, `MDOQ.phpcopyreference`, is PHP-only and states that it cannot copy a constant used inside another class, because it only sees symbols the language server reports for the current file. Resolving usages to their definition, across several languages, is what separates this extension from it.

## Goals

1. Copy a fully qualified reference for the symbol under the cursor to the clipboard. **[owner]**
2. Cover functions, classes, constants and similar symbols. **[owner]**
3. First languages: PHP, then JavaScript and TypeScript. **[owner: PHP and JS; TS is a builder call]**
4. Adding a language must not require touching the core flow. **[owner]**
5. Work on the definition and on a usage. A usage yields the reference of its target, not of the enclosing method. **[owner, confirmed in playback]**
6. PHP works with both DEVSENSE PHP Tools and Intelephense. **[owner]**
7. Publishable on the VS Code Marketplace. **[owner]**

## Non-goals

- Pasting as a link or inserting imports on paste. **[owner, confirmed in playback]**
- User-configurable formats. **[owner, confirmed in playback]**
- Bundling parsers or language servers. **[owner, confirmed in playback]**
- A public API that lets other extensions register languages. Extensible means in this codebase. **[builder call]**

## Anti-goals

- Copying the enclosing method when the cursor is on a call. That silently yields a wrong reference.
- Copying a guessed name. If the target cannot be resolved, use the fallback rather than invent a qualified name.
- Regex logic that can break silently. **[owner]** See "PHP namespace" for the one narrow exception.

## Later languages

Twig, Vue, Go and HTML are wanted after the first release, not in it. **[owner: optional; ordering is a builder call]** Intended formats, to be confirmed when each is built:

- Go: `github.com/foo/bar.Baz`
- Twig: `@Storefront/storefront/base.html.twig`, plus the block name when the cursor is on a block
- Vue: file path plus component or method

## Behaviour

**Entry points** **[owner, confirmed in playback]**: editor context menu entry, keyboard shortcut, and a brief status bar confirmation showing what was copied. Command palette entry follows from registering the command.

Shortcut: `cmd+alt+shift+c` on macOS and `ctrl+alt+shift+c` elsewhere, matching PhpStorm, scoped to `editorTextFocus`. **[builder call]** Check for conflicts when building.

**Result** per language:

| Language | Symbol | Output |
|---|---|---|
| PHP | class, interface, trait, enum | `\Ns\Class` |
| PHP | method | `\Ns\Class::method` |
| PHP | class constant | `\Ns\Class::CONST` |
| PHP | property | `\Ns\Class::$prop` |
| PHP | function | `\Ns\func` |
| PHP | global constant | `\Ns\CONST` |
| JS/TS | top-level symbol | `src/utils/math.js:round` |
| JS/TS | member | `src/utils/math.js:Class.method` |

The PHP method format is confirmed by the owner's example. The other PHP rows are assumed to match PhpStorm and should be compared with it if PhpStorm is available. JS/TS is prefixed with the workspace-relative path because JavaScript has no namespaces. **[builder call]**

No line number is appended to a symbol reference. JetBrains documentation says the reference can include a line number, but the owner's target string has none. **[owner, by example]**

**Fallback** **[owner, confirmed in playback]**: `path/relative/to/workspace.php:42` (1-based line of the cursor). Used when any of these holds:

- No registered language for the file.
- Cursor is not on a symbol that resolves to a named declaration, including blank space inside a method body and local variables.
- No language extension answers, including a target in `vendor/` that returns no symbols. **[owner: acceptable for now]**

Files outside any workspace folder use their absolute path. **[builder call]** The status bar text must make clear that the fallback was used, so a wrong result is noticed before pasting. **[builder call]**

**Extension hint** **[owner: suggest other extensions instead of regex; the behaviour below is a builder call]**: when a fallback happens in a registered language and none of that language's recommended extensions is installed, show a notification offering to open them in the Extensions view. Do not repeat it in the same session. PHP recommends `devsense.phptools-vscode` and `bmewburn.vscode-intelephense-client`. No hard `extensionDependencies`, because either PHP extension is enough.

## How it works

Use the language extensions already installed, through VS Code's built-in commands. **[owner, confirmed in playback]** No runtime dependencies, written in TypeScript. **[builder call]**

1. Ask `vscode.executeDefinitionProvider` for the cursor position. It returns `Location[]` or `LocationLink[]`, or nothing. Use the first result as the target. On no result, the target is the cursor position itself.
2. Ask `vscode.executeDocumentSymbolProvider` for the target URI. It takes only a URI, so the target file does not have to be open.
3. Find the innermost symbol whose range contains the target position, and collect its ancestors into a chain. If none matches, use the fallback.
4. Require that the identifier at the target position equals the symbol's name. **[builder call]** This rejects blank space inside a method even when a provider's name range covers the whole declaration. Providers that return a whole declaration as the definition target need the check to look at the symbol's name instead of the start position; the spike settles which case applies.
5. Reject symbols nested in a function or method: any function or method ancestor means fallback. **[builder call]** TS reports locals as nested symbols, so step 4 alone would produce `outer.local`. Consequence: `outer.inner` also falls back. Nested object keys stay chained, so `cfg.a.b` is a valid reference.
6. Pass the chain and the target document to the language's formatter.

Providers may return nested or flat symbols. VS Code converts flat results to a tree before the extension sees them, setting the name range to the provider's `location.range`, which is why step 4 is needed.

**PHP namespace:** it is unknown whether PHP Tools or Intelephense report the namespace as a parent symbol, as part of the name, or in `detail`. The formatter must produce the same output in each case. If a provider does not report it, read it from the target file with one anchored pattern for the `namespace` statement, taking the nearest one above the target. **[builder call]** If no statement is found in a file that has one per the provider, or the match is ambiguous, use the fallback. No text-based search for the enclosing class. **[owner]**

## Extensibility

One file per language in `src/languages/`, each exporting an object with the VS Code language IDs it handles, its recommended extension IDs, and a pure function from symbol chain and document to a reference string. A single array in `src/languages/index.ts` registers them. Adding a language means adding one file, one array entry, and its tests. **[owner asked for this; the shape is a builder call]**

## Verify first

These are unverified and can change the implementation, so settle them before building formatters. Run steps 1 and 2 once for each PHP extension.

1. Dump the raw symbol and definition JSON for a namespaced PHP class. Settles how namespaces appear and what the ranges cover.
2. Call the symbol command on a closed `vendor/` file right after startup and again after indexing. Settles whether targets in `vendor/` resolve.
3. Do the same on a closed `node_modules/` file with the built-in TS server.

If `vendor/` stays empty, the owner's own trigger example gets only the fallback. Report that result to the owner before continuing, along with what the extension hint or a provider setting can do about it. No retry logic for indexing delay unless real use shows a need. **[builder call]**

## Constraints

- PHP depends on a PHP language extension. Without one, PHP gets only the fallback and the extension hint.
- Tests: unit tests for symbol chain lookup and each formatter using plain data; integration tests running in a VS Code test host against fixture files, with PHP Tools and Intelephense as separate runs. PHP Tools may need a licence or trial in the test host; if that blocks automation, run it locally only and say so in the test docs. **[builder call]**
- Marketplace needs: publisher ID, licence, README with GIF, icon, unique display name. Publisher ID and licence are the owner's to choose before the first publish; the rest is the builder's.
- All code, comments and docs in English. Comments only where the code cannot show the reason.

## Left to the builder

File layout beyond `src/languages/`, bundling, test runner choice, status bar and notification wording, and how long the confirmation stays visible.
