// scripts/generate-public-images.ts
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = path.join(import.meta.dirname, "..");
const PUBLIC_IMG_DIR = path.join(ROOT_DIR, "public", "img");
const OUTPUT_FILE = path.join(ROOT_DIR, "src", "types", "publicImages.ts");

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function generateTypes(files: string[]) {
  const publicPaths = files.map((file) => {
    const rel = file.replace(path.resolve(ROOT_DIR, "public"), "");
    return rel.startsWith("/") ? rel : `/${rel}`;
  });

  const typeUnion = publicPaths.map((p) => `"${p}"`).join(" | ");

  const mapObject = publicPaths.map((p) => `  "${p}": "${p}",`).join("\n");

  return `/* AUTO-GENERATED FILE — DO NOT EDIT MANUALLY */

export type PublicImagePath =
  ${typeUnion};

export const publicImages = {
${mapObject}
} as const;
`;
}

async function main() {
  const files = (await walk(PUBLIC_IMG_DIR)).filter((file) =>
    /\.(png|jpe?g|svg|webp|gif|bmp|tiff)$/i.test(file),
  );

  const types = generateTypes(files);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, types, "utf8");

  console.log(`√ Generated: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
