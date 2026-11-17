/**
 * Pure time-budget check so a long run (hundreds of sponsors) stops itself cleanly
 * before Apps Script's ~6-minute execution limit kills it mid-sponsor, which could leave
 * a draft created but its master-list row never marked "Drafted" (see runDailyOutreach in
 * OutreachWorkflow.js) -- and so draft the same sponsor again next run. No GAS globals:
 * pure math, easy to unit test, reusable anywhere a run needs to self-stop before a budget.
 */
function hasTimeBudgetRemaining_(startMs, nowMs, budgetMs) {
  return (nowMs - startMs) < budgetMs;
}

// Apps Script kills a trigger-run execution at 6 minutes. Stop well before that so the
// sponsor in progress can finish its draft-then-mark pair cleanly, leaving any remaining
// sponsors untouched (still "Brainstormed") for the next run to pick up.
var OUTREACH_RUN_TIME_BUDGET_MS = 4.5 * 60 * 1000;
