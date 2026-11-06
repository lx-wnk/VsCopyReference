# Copy Reference: provider spike results

Source data: `out/spike/{phptools,intelephense,js}.json` (not committed), produced by `npm run spike:<provider>` against VS Code 1.145.1 in the test host. Fixtures: `test/fixtures/php`, `test/fixtures/js`. All line/character values are 0-based as emitted. `php` is not installed on the machine; PHP Tools ran without any licence or trial prompt in the test host (no message appeared in stdout or JSON). Versions: devsense.phptools-vscode 1.76.19502, Intelephense from the marketplace (latest at run time).

Each JSON holds `definitionsImmediate` (before any symbol request), `definitionsAfterPolling` (after the symbol polling phase), and, added in this unit, `definitionsAfterWait` (an extra 30 s later). Notation: `range` = `a:b-c:d`, `sel` = `selectionRange`.

## 1. Namespace representation

| Provider | Namespace appears as |
|---|---|
| PHP Tools | Parent `DocumentSymbol`, kind Namespace (2), name `Acme\Util`, children nested under it. `detail` is empty. |
| Intelephense | Sibling top-level `DocumentSymbol`, kind Namespace (2), name `Acme\Util`. It is NOT a parent: `FloatComparator` is a separate top-level entry. `range` covers only the `namespace ...;` line. |
| TS built-in | Not applicable (JS fixture has no namespaces; ES modules are not symbols). |

VERIFIED, PHP Tools `vendor/.../FloatComparator.php`: `'Acme\\Util' k=Namespace range=2:0-18:1` with children `FloatComparator`, `helper()`.
VERIFIED, Intelephense same file: `'Acme\\Util' k=Namespace range=2:0-2:20` followed by top-level `'FloatComparator' k=Class` and `'helper' k=Function`.
Neither provider puts the namespace into the class name or into `detail`.

## 2. Symbol names

| Item | PHP Tools | Intelephense | TS built-in (JS) |
|---|---|---|---|
| Class | `FloatComparator` | `FloatComparator` | `Calc` |
| Method | `lessThanOrEquals()` (with `()`), detail `public` | `lessThanOrEquals` (bare), detail `static` | `add` |
| Class constant | `EPSILON`, kind Constant | `EPSILON`, kind Constant | n/a |
| Property | `tolerance` (NO `$`), kind **Null** (odd), detail `public` | `$tolerance` (WITH `$`), kind Property | `a`, `b` (object-literal members, kind Property) |
| Function | `helper()` (with `()`) | `helper` (bare) | `round` |
| Interface | `Comparable`, detail `interface` | `Comparable` | n/a |
| Interface method | `compare()` | `compare` | n/a |
| Method parameters | not emitted | emitted as kind Variable children (`$a`, `$b`) | not emitted |
| Local variables | not emitted | emitted as kind Variable children of the method (`$instance`, `$comparable`, `$local`) | emitted (`inner` under `withLocal`, kind Variable) |

PHP Tools names carry `()` for methods and functions but no signature or parameter list. Intelephense names are bare except for the `$` prefix on properties and variables. Any name normalisation must therefore strip a trailing `()` (PHP Tools) and treat a leading `$` on properties as provider-dependent.
VERIFIED: PHP Tools `'tolerance' k=Null det='public' range=8:11-8:27 sel=8:11-8:27`; Intelephense `'$tolerance' k=Property range=8:11-8:27 sel=8:11-8:21`.

## 3. `range` vs `selectionRange`

| Provider | Symbol | range | selectionRange |
|---|---|---|---|
| PHP Tools | Method `lessThanOrEquals()` | `10:4-13:5` whole declaration (incl. body) | `10:27-10:43` name only |
| PHP Tools | Class | `4:0-14:1` whole | `4:6-4:21` name only |
| PHP Tools | Namespace | `2:0-18:1` to end of file | `2:0-2:20` whole `namespace ...;` statement incl. keyword |
| PHP Tools | Property `tolerance` / const `EPSILON` | `8:11-8:27` / `6:17-6:33` | identical to range (whole declaration, not name only) |
| Intelephense | Method | `10:4-13:5` whole | `10:27-10:43` name only |
| Intelephense | Class | `4:0-14:1` whole | `4:6-4:21` name only |
| Intelephense | Namespace | `2:0-2:20` the statement only (does not enclose classes) | `2:10-2:19` name only |
| Intelephense | Property `$tolerance` / const `EPSILON` | `8:11-8:27` / `6:17-6:33` | `8:11-8:21` / `6:17-6:24` name only |
| TS | Function `round` | `0:0-2:1` whole | `0:16-0:21` name only |
| TS | Method `add` | `5:2-5:10` | `5:2-5:5` name only |
| TS | `cfg` variable | `8:13-8:34` (declarator) | `8:13-8:16` |

Consequence: containment of a definition position in `range` selects the enclosing chain only for PHP Tools namespaces (which enclose children). For Intelephense the namespace must be derived by a separate rule (the closest preceding Namespace sibling), because its `range` does not contain the class.

## 4. Definitions

All Intelephense and TS results are `LocationLink`. PHP Tools returned `Location` (with `uri` and `range` only) in the cases where it returned anything.

### Intelephense (after polling; all 1 result, all `LocationLink`)

| Token | Target | targetRange | targetSelectionRange |
|---|---|---|---|
| `lessThanOrEquals` | `vendor/.../FloatComparator.php` | `10:4-13:5` whole method | `10:27-10:43` name |
| `EPSILON` | same file | `6:17-6:33` | `6:17-6:24` name |
| `tolerance` (accessed as `$instance->tolerance`) | same file | `8:11-8:27` | `8:11-8:21` (name incl. `$`) |
| `helper` | same file | `16:0-18:1` | `16:9-16:15` |
| `baseMethod` (called on `Child`) | `vendor/.../ComparatorBase.php` | `6:4-8:5` | `6:20-6:30` |
| `compare` (interface, 2 implementations) | `src/Comparable.php` interface method | `6:4-6:30` | `6:20-6:27` |
| `$local` | `src/Caller.php` own assignment | `17:8-17:14` | `17:8-17:14` |

- `baseMethod` resolves to the declaring class `ComparatorBase`, not to `Child`. Inheritance is followed by the provider. VERIFIED.
- `compare` returns exactly 1 result (the interface method), not the two implementations, because the receiver is typed `Comparable`. VERIFIED.
- `$local` points at the first assignment inside the same method; the target range equals the token. No Variable parent is derivable from `range`.

### PHP Tools

| Token | immediate | after polling | after +30 s |
|---|---|---|---|
| `lessThanOrEquals` | 0 | 0 | 0 |
| `EPSILON` | 0 | 0 | 0 |
| `tolerance` | 0 | 0 | 0 |
| `helper` | 0 | 0 | 0 |
| `baseMethod` | 0 | 0 | 0 |
| `compare` | 0 | 1 `Location` `src/Comparable.php` range `6:20-6:27` (name only) | 1 |
| `$local` | 0 | 1 `Location` `src/Caller.php` range `17:8-17:14` | 1 |

PHP Tools resolves only same-file or same-namespace-sibling targets in this environment and nothing across `use` imports, `vendor/`, or `Child` inheritance. Its `Location` range for `compare` is the name only (`6:20-6:27`), not the declaration.

### TS built-in (after polling; all 1 result, all `LocationLink`)

`round` -> `math.js` targetRange `0:0-2:1`, selection `0:16-0:21`. `Calc` -> `4:0-6:1`, selection `4:13-4:17`. `add` -> `5:2-5:10`, selection `5:2-5:5`. `cfg` -> `8:0-8:35` (whole statement), selection `8:13-8:16`. `b` in `cfg.a.b` -> targetRange `8:26-8:30`, selection `8:26-8:27` (the nested property). `tinyFn` -> `node_modules/tiny/index.js` `0:0-0:27`, selection `0:16-0:22`.

## 5. Closed `vendor/` and `node_modules/` files (documentSymbol)

| Provider | File | immediate | final |
|---|---|---|---|
| PHP Tools | `vendor/acme/util/src/FloatComparator.php` | 0 symbols at 0 ms | 1 top-level symbol after **2018 ms** |
| PHP Tools | `vendor/acme/util/src/ComparatorBase.php` | 1 at 0 ms | 1 |
| Intelephense | `vendor/.../FloatComparator.php` | 0 symbols at 0 ms | 3 top-level after **2024 ms** |
| Intelephense | `vendor/.../ComparatorBase.php` | 2 at 0 ms | 2 |
| TS | `node_modules/tiny/index.js` | 1 at 0 ms | 1 |

VERIFIED: closed `vendor/` files do return symbols, but the first file touched can return an empty result at 0 ms and needs one poll cycle (poll interval 2000 ms, so true latency is between 0 and about 2 s). Files requested after the first one were immediately ready, which fits a one-time indexing cost per provider, not per file. A retry loop with a short interval is required. The 2018/2024 ms values are quantised by the 2000 ms poll interval.

## 6. Cold-start behaviour of definitions

- Intelephense: 0 of 7 results `immediate`, 7 of 7 `afterPolling`. Needs warm-up; the first request after open returns empty arrays without error.
- TS (JS): `immediate` was partly wrong, not just empty. `round`, `Calc`, `add` returned `[]`; `cfg`, `b`, `withLocal`, `tinyFn` already resolved correctly. After polling all 7 are correct. VERIFIED from `definitionsImmediate` vs `definitionsAfterPolling`.
- PHP Tools: 0 of 7 immediate, 2 of 7 after polling and after +30 s. Waiting does not help for the 5 cross-file tokens.

Callers must therefore retry definitions (empty result is not final) for a bounded time before falling back.

## 7. Impact on the plan

Task 2 `baseName` / `selectChain`:
- VERIFIED: `baseName` must strip a trailing `()` (PHP Tools: `lessThanOrEquals()`, `helper()`, `baseMethod()`). Intelephense and TS do not emit it.
- VERIFIED: PHP property names differ per provider (`$tolerance` vs `tolerance`); normalise to one form before comparing with the token at the cursor. Note PHP Tools reports the property with kind Null, so a kind filter on Property will drop it.
- VERIFIED: match the target by `targetSelectionRange` (name only) from the definition against symbol `selectionRange`, not `range`. Exception: PHP Tools `Location.range` is already name-only for `compare`; for classes/consts/properties its `selectionRange` equals `range`.
- VERIFIED: `selectChain` by range containment works for PHP Tools (namespace encloses class) and TS, but does NOT yield the namespace for Intelephense (the Namespace symbol is a one-line sibling). Needs a second rule.
- VERIFIED: parameters and locals appear as Variable symbols in Intelephense and TS; chain selection must ignore kind Variable children when the target is a method.

Task 3 PHP namespace handling:
- VERIFIED: namespace is never part of the class name or `detail`; it is a Namespace-kind symbol (name `Acme\Util`, already with backslashes). Build `\Acme\Util\FloatComparator::lessThanOrEquals` by joining Namespace name, class name and member name.
- VERIFIED: for Intelephense take the nearest preceding top-level Namespace symbol in the same document; for PHP Tools take the enclosing parent. Multiple namespaces per file are not covered by the fixtures. HYPOTHESIS for multi-namespace files; cheapest check: add a two-namespace fixture and rerun the spike.
- VERIFIED: global functions in a namespace (`helper`) appear under the namespace (PHP Tools child, Intelephense sibling), so `\Acme\Util\helper` is derivable.

`vendor/` support:
- VERIFIED: documentSymbol on closed `vendor/` files works for both PHP providers, with up to ~2 s warm-up on first touch; use a retry loop.
- VERIFIED: Intelephense definitions into `vendor/` (including inherited `baseMethod`) work after warm-up.
- VERIFIED: PHP Tools definitions into `vendor/` returned nothing in the test host, immediately, after polling and after 30 s. HYPOTHESIS: caused by the test environment (no `php` binary, no licence, indexing disabled in a fresh profile) and not by PHP Tools itself. Cheapest check: run the same fixture in the owner's normal VS Code with PHP Tools installed and licensed, F12 on `lessThanOrEquals` in `Caller.php`.
- HYPOTHESIS: `compare` on a typed receiver yields only the interface method; the plan's "implementations" case would need `vscode.executeImplementationProvider`. Cheapest check: call it at the same position in the spike.
