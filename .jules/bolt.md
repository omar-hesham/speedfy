## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.

## 2023-10-02 - Implement route-based code splitting for tab components
**Learning:** The application was bundling all components, including large dependencies like Recharts in `SpeedTestEngine`, into a single massive chunk (>700KB).
**Action:** Use `React.lazy()` for route-based component loading (tab switching). For named exports in Vite/React, use the `.then(m => ({ default: m.Component }))` promise chain pattern.
