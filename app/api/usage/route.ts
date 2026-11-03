import { serverConfig } from "@/lib/server/config";
import { startOfMonthIso } from "@/lib/server/costs";
import { withAuth } from "@/lib/server/http";

/** GET /api/usage — consumo do mês e orçamento operacional. */
export const GET = withAuth(async (_request, ctx) => {
  const since = startOfMonthIso();
  const events = await ctx.store.listUsage(ctx.user.id, { since });
  const spentCents = events.reduce((total, event) => total + event.costCents, 0);
  return Response.json({
    since,
    spentCents,
    budgetCents: serverConfig().operationalBudgetCents,
    events,
  });
});
