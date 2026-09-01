import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/customers/")({
  component: () => <Navigate to="/admin/customers/customer-manager" replace />,
});
