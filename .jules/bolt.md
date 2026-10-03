## 2025-03-01 - Avoid Full Array Cloning in High-Frequency React Re-renders
**Learning:** Using `[...array].reverse()` directly inside render functions or `useMemo` blocks with large dependencies (like high-frequency `EventSource` live streams) causes unnecessary GC pressure and performance bottlenecks.
**Action:** Use native reverse `for` loops for searching, and slice only the required elements before reversing (`array.slice(-N).reverse()`) wrapped in `useMemo` to optimize rendering performance in fast-updating components.
## 2025-03-01 - Avoid Truncated Reads Before Planning
**Learning:** Standard file reading tools (`cat`, `read_file`) can truncate output on large files, leading to incorrect assumptions about the code's structure and causing Groundedness Rule violations when planning edits.
**Action:** Use targeted commands like `grep -A N 'pattern'`, `sed -n 'X,Yp'`, or `tail` to explicitly fetch and verify the exact sections of a file you intend to modify before formulating a plan.
