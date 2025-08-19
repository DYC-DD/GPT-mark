import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/GPT-mark/",
  plugins: [react()],
});
