/// <reference types="vitest" />

import path from "path";
import { defineConfig } from "vite";

import packageJson from "./package.json";

const getPackageName = () => {
  return packageJson.name;
};

const getPackageNameCamelCase = () => {
  try {
    return getPackageName().replace(/-./g, (char) => char[1].toUpperCase());
  } catch (err) {
    throw new Error("Name property in package.json is missing.");
  }
};

const fileName = {
  es: `${getPackageName()}.mjs`,
  esMin: `${getPackageName()}.min.mjs`,
};

export default defineConfig({
  test: {
    environment: "jsdom",
    reporters: ['html']

  },
  base: "./",
  build: {
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: getPackageNameCamelCase(),
      fileName: (format) => fileName[format],
    },
    rollupOptions: {
      external: ["wobble", /@arcgis\/core\/.*/, "mini-svg-data-uri"],
      output: [
        {
          format: 'es',
          dir: `dist/${fileName.es}`,
          sourcemap: true,
        },
        {
          format: 'es',
          dir: `dist/${fileName.esMin}`,
          sourcemap: true,
          plugins: [
            {
              name: 'minify-es',
              renderChunk: async (code) => {
                const { transform } = await import('esbuild');
                const result = await transform(code, { minify: true });
                return { code: result.code };
              },
            },
          ],
        },
      ],
    }
  }
},
);
