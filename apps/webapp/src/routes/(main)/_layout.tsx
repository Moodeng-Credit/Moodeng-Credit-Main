import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
