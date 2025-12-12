import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";
import circularDependency from "vite-plugin-circular-dependency";
import webfontDownload from "vite-plugin-webfont-dl";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact(),
    tailwindcss(),
    circularDependency({
      outputFilePath: "./.circularDependency.json",
      circleImportThrowErr: true,
    }),
    webfontDownload([
      // 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
      // 'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap'
    ]),
    AutoImport({
      imports: [
        "react",
        "date-fns",
        "react-dom",
        "ahooks",
        {
          nanoid: ["nanoid"], // auto-import nanoid
          "class-variance-authority": ["cva"],
          "@/lib/utils": ["cn"],
        },
      ],

      biomelintrc: { enabled: true },
      dts: join(import.meta.dirname, "./src/types/auto-import.d.ts"),
    }),
  ],
  resolve: {
    alias: {
      "@": join(import.meta.dirname, "./src"),
    },
  },
});
