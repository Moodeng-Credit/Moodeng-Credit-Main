import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/pages/LandingPage/LandingPage";

export const Route = createFileRoute("/(main)/_layout/")({
  component: LandingPage,
});
