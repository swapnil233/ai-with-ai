export default {
  // Format all supported files with prettier
  "*.{ts,tsx,js,jsx,json,md}": ["prettier --write"],

  // Lint web app files (run eslint from web directory)
  "apps/web/**/*.{ts,tsx}": (filenames) => {
    const files = filenames.map((f) => f.replace(/^.*apps\/web\//, "")).join(" ");
    return `pnpm --filter @ai-app-builder/web exec eslint --fix ${files}`;
  },

  // Lint API files (run eslint from api directory)
  "apps/api/**/*.ts": (filenames) => {
    const files = filenames.map((f) => f.replace(/^.*apps\/api\//, "")).join(" ");
    return `pnpm --filter @ai-app-builder/api exec eslint --fix ${files}`;
  },
};
