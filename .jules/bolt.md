## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2024-05-19 - [Code Splitting Eager Load]
**Learning:** The previous implementation eagerly loaded all tab components in App.tsx (even those inactive), leading to a massive main bundle of >700kB, due to the inclusion of charting libraries like Recharts in `SpeedTestEngine`.
**Action:** Use `React.lazy` with `<Suspense>` for dynamic imports of tab components. This immediately reduces the main bundle by over 500kB. Be careful to ensure any variables used within the `<Suspense>` fallback (like `isAr`) are defined within the component's scope to prevent crashes.
