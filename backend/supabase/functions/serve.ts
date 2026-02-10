import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PORT = 8000;

console.log(`Backend server running on http://localhost:${PORT}`);

serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok", message: "Backend is running" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // API endpoint
  if (url.pathname === "/api") {
    return new Response(JSON.stringify({ message: "Moodeng Credit Backend API" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}, { port: PORT });
