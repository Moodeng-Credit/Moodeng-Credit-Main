import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/forgot-password")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(main)/_layout/forgot-password"!</div>;
}
