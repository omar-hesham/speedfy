## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2025-03-01 - Avoid full component tree re-renders from high frequency state updates
**Learning:** High-frequency state updates in parent components (e.g., from EventSource/WebSocket streams during a speed test) cause massive unnecessary re-renders in complex, pure sibling/child components if they aren't memoized.
**Action:** Use `React.memo()` to wrap heavy, complex child components whose props do not change during the high-frequency state updates of their parents.
