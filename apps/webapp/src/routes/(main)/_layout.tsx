import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/shared/Header";

export const Route = createFileRoute("/(main)/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
