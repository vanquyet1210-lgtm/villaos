// FIXED VERSION: Only fix totalExpense formula + single source of truth

// BEFORE (buggy):
// const perVillaExpTotal = ...
// const allocatedShared = ...
// const effectiveTotalExp = perVillaExpTotal + allocatedShared ❌

// AFTER (correct):
const effectiveTotalExp = report.totalExpense;

// IMPORTANT:
// - Do NOT recompute totalExpense anywhere in UI
// - Do NOT sum perVillaExpTotal + allocatedShared again
// - UI must only read from backend (single source of truth)

// If you still need breakdown display, KEEP it separate but NEVER use it for total:
const perVillaExpTotal = /* keep for UI breakdown only */ null;
const allocatedShared = /* keep for UI breakdown only */ null;

// ❌ DO NOT DO THIS ANYMORE:
// const total = perVillaExpTotal + allocatedShared;

// ✅ ALWAYS USE:
// report.totalExpense

// Profit also must follow single source:
const effectiveNetProfit = report.netProfit;

// ❌ DO NOT recompute:
// const net = totalRevenue - totalExpense;

// ✅ ALWAYS USE:
// report.netProfit

// ---- SUMMARY ----
// totalExpense = report.totalExpense (from backend)
// netProfit    = report.netProfit (from backend)

// UI = read-only for financial totals
