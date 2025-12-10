import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(main)/_layout/profile"!</div>;
}
