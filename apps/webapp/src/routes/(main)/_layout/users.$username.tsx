import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/users/$username")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(main)/_layout/user/$username"!</div>;
}
