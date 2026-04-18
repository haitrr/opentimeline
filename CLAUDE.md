# Coding guideline
- Use `eslint` for linting JavaScript/TypeScript code `pmpm exec eslint <path>` or `pmpm exec eslint .` for the entire project.
- Components should be inside their own file unless they are very small (under 10 lines) and only used in one place.
- Avoid file with more than 300 lines of code. If a file exceeds this, consider breaking it into smaller components or modules.
- Don't put complex logic inside the main component body. Instead, extract it into helper functions or custom hooks to keep the component clean and focused on rendering.
- This app support mobile devices, so ensure that your components are responsive and touch-friendly. Use media queries or responsive design techniques to adapt the layout for different screen sizes. Also for input and textarea, ensure the font size is at least 16px to prevent zooming on iOS devices.
- Use test driven development (TDD) approach. Write tests before implementing the functionality to ensure that your code is testable and maintainable.