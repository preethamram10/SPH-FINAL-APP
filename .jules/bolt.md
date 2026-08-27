## 2025-02-26 - Pre-index Array Scans and Memoize Slot Sorting for Multi-App Speed Boost
**Learning:**
1. In `SuperAdminDashboard.jsx`, performing `patients.find()` inside iterated transactions created an $O(N \times M)$ complexity bottleneck with millions of regex/string operations per re-render.
2. In Patient app (`BookAppointment.js`), re-parsing time slot strings with regexes inside `Array.prototype.sort()` and `isSlotBlockedByNoShow()` caused redundant operations on every slot generation.
3. In Staff app (`DoctorConsultationHistory.js`), `branches.find()` was executed inside `patients.filter()`, running array searches for every patient item.

**Action:**
1. Pre-build a memoized index Map (`useMemo`) by candidate keys (IDs, registration numbers, clean phone numbers, normalized names) before processing large transaction arrays in web dashboards.
2. Memoize time string parsing with a top-level cache Map for instant $O(1)$ sorting and filtering in mobile booking screens.
3. Hoist filter target lookups outside array iteration loops in mobile screens.
