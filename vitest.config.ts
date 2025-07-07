import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts",
        "api/**/*.ts"
      ],
      exclude: [
        "src/utils/types.ts",  // Pure type definition files
        "reference/**/*",      // Old project reference files
        "lib/**/*",           // Generated files
        "**/*.d.ts",          // TypeScript declaration files
        "**/node_modules/**", 
        "**/dist/**",
        "**/*.config.*",
        "**/coverage/**"
      ]
    },
  },
});
