# Contributing

## Setup

- Install dependencies with `npm ci`.
- Run `npm test` before submitting changes.

## Formatting

- Keep code, comments and Markdown within 79 columns, including indentation.
- Use two spaces for JavaScript; no tabs or trailing whitespace.
- Indent Markdown bullet continuations by four spaces.
- Use short, title-case Markdown headings.
- Keep simple header constants, imports and helpers on one line.
- Wrap argument lists, object properties and method chains as needed.
- Keep strings and template literals intact, even beyond 79 columns.
- Do not move strings to JSON solely to meet the column limit.
- Keep JSON strings intact; generated files are exempt from column limits.
- Limit formatting changes to the lines being edited.

## JavaScript

- Use CommonJS `require` and `module.exports`.
- Put external imports before local imports; follow nearby ordering.
- Never reference a sibling declaration in the same variable block.
- Apply this at every scope, including closures, templates and destructuring.
- Separate dependent local declarations with a blank line.
- Use one independent constants/helpers block after imports.
- Header helpers may use imports, globals and their own parameters.
- Compose header helpers at call sites; do not add extra header blocks.
- Keep runtime setup in entry points or calling functions.
- Prefer `const`; use `let` for bindings that change.
- Use single quotes and template literals for interpolation.
- End statements with semicolons; add trailing commas to multiline literals.
- Use camelCase for locals and snake_case for files; preserve public names.
- Use descriptive parameter names in multiline closures.
- Use short parameter names only in clear, single-line closures.
- Use braces for multiline functions and conditionals; prefer early returns.
- Follow the existing function comments for arguments and results.

## Async Work

- Preserve callback and Promise interfaces.
- Declare every `asyncAuto` task dependency explicitly.
- Gate protected lookups and side effects on successful `checkAccess`.
- Use structured error arrays.
- Pass underlying errors through using the surrounding convention.

## Testing

- Apply the same style to production code, tests, fixtures and runners.
- Use `node:test` and strict assertions from `node:assert`.
- Follow nearby tests and update them when behavior changes.
- Preserve behavior and exact fixture values during formatting changes.
- Use self-contained JSON fixtures for shared or structured static data.
- Run `npm test` and `git diff --check`.
- Check added and modified lines for width, including new files.
- Remember that `git diff --check` checks whitespace, not line length.
- Review variable blocks for independence and headers for a single block.
