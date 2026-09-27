## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2025-03-01 - Avoid Manual Loops for Small Array Cloning
**Learning:** Replacing native `array.slice(-N).reverse()` with manual `for` loops and `push()` calls for small arrays worsens performance. Dynamic array resizing in manual loops increases GC pressure compared to native methods that pre-allocate memory.
**Action:** Use native array methods (like `slice` and `reverse`) for small, predictable transformations instead of prematurely optimizing with manual loops.
