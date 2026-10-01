## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2024-03-24 - React.lazy with Named Exports
**Learning:** This codebase frequently uses named exports for components. Directly using `React.lazy(() => import('./Component'))` will fail because it expects a default export.
**Action:** When implementing code splitting for named exports, use the promise chain pattern: `React.lazy(() => import('./path').then(m => ({ default: m.ComponentName })))`.
