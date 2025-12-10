import { test } from "@repo/moodeng";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(main)/_layout/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <div>Hello "/(main)/_layout/dashboard"!</div>
      <div>{test}</div>
    </div>
  );
}
