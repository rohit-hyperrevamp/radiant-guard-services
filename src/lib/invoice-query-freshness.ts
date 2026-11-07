/** Refresh an open invoice after edits in another tab, without polling attendance. */
export const invoiceQueryFreshness = {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
} as const;