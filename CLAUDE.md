# Coding guideline
- Use `eslint` for linting JavaScript/TypeScript code `pmpm exec eslint <path>` or `pmpm exec eslint .` for the entire project.
- Components should be inside their own file unless they are very small (under 10 lines) and only used in one place.
- Avoid file with more than 300 lines of code. If a file exceeds this, consider breaking it into smaller components or modules.