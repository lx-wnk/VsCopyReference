# Changelog

## 0.1.0

- Copy Reference command: copies a fully qualified reference to the symbol under the cursor, on a definition or on a usage.
- PHP support through DEVSENSE PHP Tools or Intelephense, e.g. `\Ns\Class::method`.
- JavaScript and TypeScript support through the built-in TypeScript support, e.g. `src/utils/math.js:Class.method`.
- Keyboard shortcut, editor context menu entry and Command Palette command, with a status bar confirmation.
- Fallback to `path:line` when no symbol can be resolved, plus, for PHP, a hint (once per session) to install a language extension.
