import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/reset-password")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(main)/_layout/reset-password"!</div>;
}
