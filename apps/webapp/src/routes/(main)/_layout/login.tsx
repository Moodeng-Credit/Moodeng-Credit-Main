import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(main)/_layout/login"!</div>;
}
