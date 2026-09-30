## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.

## 2023-10-31 - Route-based Code Splitting for Named Exports
**Learning:** Using React.lazy() to dynamically import large route components is a high-impact way to reduce the initial bundle size when rendering a single-page application tab. When a component is not the default export (e.g. `export const SpeedTestEngine`), `React.lazy()` expects a default export so the promise chain `.then(m => ({ default: m.SpeedTestEngine }))` pattern must be used.
**Action:** When implementing route-based code splitting to fix large chunk warnings (>500kb), check whether the components use default or named exports and apply the appropriate import wrapper syntax to avoid "element type is invalid" rendering errors.
