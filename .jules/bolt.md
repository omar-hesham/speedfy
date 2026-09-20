## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2024-05-24 - Vite Chunk Size Warning & React.lazy Named Exports
**Learning:** The initial vite build produced a `> 500 kB` chunk warning because all major tab components were bundled synchronously. Furthermore, most components in this codebase use named exports rather than default exports.
**Action:** Always verify chunk sizes using `npm run build` as part of the measurement process. Use `React.lazy(() => import('...').then(m => ({ default: m.NamedExport })))` to cleanly code-split components that use named exports without having to refactor the components themselves.
