# Copy Reference (PhpStorm-style)

Copy a fully qualified reference to the symbol under the cursor, like PhpStorm's Copy Reference, for PHP, JavaScript and TypeScript.

With the cursor on a call of `FloatComparator::lessThanOrEquals`, the clipboard gets:

```
\Shopware\Core\Framework\Util\FloatComparator::lessThanOrEquals
```

Works on definitions and on usages: a usage copies the reference of its target, not of the enclosing method.

## Usage

- Shortcut: `Cmd+Alt+Shift+C` (macOS), `Ctrl+Alt+Shift+C` (Windows, Linux)
- Editor context menu: **Copy Reference**
- Command Palette: **Copy Reference**

The status bar shows what was copied and says when the fallback (path and line) was used instead of a symbol reference.

## Formats

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

## Requirements

- PHP: [DEVSENSE PHP Tools](https://marketplace.visualstudio.com/items?itemName=devsense.phptools-vscode) or [Intelephense](https://marketplace.visualstudio.com/items?itemName=bmewburn.vscode-intelephense-client). Either one is enough.
- JavaScript and TypeScript: VS Code's built-in TypeScript support.

Each language works on its own; installing only one language's extension is fine. Without a provider you get `path:line`. For PHP, a hint to install a provider is shown once per VS Code session (JavaScript and TypeScript need no extra extension).

## Fallback

When no symbol reference can be produced, the clipboard gets `path:line`:

- The path is relative to the workspace folder, the line is 1-based. Files outside a workspace use their absolute path.
- The fallback applies to local variables, blank space, unresolved symbols and files in a language without a provider.

## Known limitations

- Right after startup the language server needs time to index. PHP Tools needed up to about 30 seconds after startup in tests (exact time unmeasured) to resolve targets in other files; until then the path and line fallback is copied.
- With PHP Tools, targets in `vendor/` rely on Composer metadata (`vendor/composer/installed.json`), which is present in normal Composer projects.
- A call on an interface method copies the interface method.
- In multi-root workspaces, paths omit the folder name.
- A symbol nested inside a function (for example an inner function) gives the fallback.
