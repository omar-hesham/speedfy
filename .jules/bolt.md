## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2025-03-01 - Avoid Manual Loops for Small Array Cloning
**Learning:** Replacing native `array.slice(-N).reverse()` with manual `for` loops and `push()` calls for small arrays worsens performance. Dynamic array resizing in manual loops increases GC pressure compared to native methods that pre-allocate memory.
**Action:** Use native array methods (like `slice` and `reverse`) for small, predictable transformations instead of prematurely optimizing with manual loops.
## 2025-03-01 - Avoid Type Mismatch with React.memo and React.FC
**Learning:** When applying `React.memo()` to functional components typed with `React.FC<Props>`, you might encounter `NamedExoticComponent` type mismatch issues depending on the TypeScript setup, specifically when components are later imported or used inside lazily loaded components.
**Action:** When refactoring to use `React.memo()`, strip the explicit `React.FC` wrapper and instead type the destructured props argument directly: `const MyComponent = React.memo(({ ... }: Props) => { ... })`.
