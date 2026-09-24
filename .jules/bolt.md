## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.

## 2024-05-24 - Code Splitting Named Exports
**Learning:** In Vite/React applications, the main bundle size can exceed 500kB quickly if all tab/route components are imported statically. Using `React.lazy()` is necessary for route-level code splitting, but since `React.lazy()` requires a default export, named exports must be handled using the promise chain pattern (`.then(m => ({ default: m.ComponentName }))`).
**Action:** Always check the Vite build output for chunk size warnings, and proactively use `React.lazy()` with Suspense for non-critical or hidden tab components, ensuring to map named exports to default in the promise chain.
