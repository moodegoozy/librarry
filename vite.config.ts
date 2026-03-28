import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // تحسين حجم الـ chunks
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // تقسيم الكود إلى chunks منفصلة
        manualChunks: {
          // مكتبات React الأساسية
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Firebase - أكبر مكتبة
          "vendor-firebase": [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/functions",
          ],
          // مكتبات UI
          "vendor-ui": ["lucide-react", "zustand"],
        },
        // تسمية الملفات بشكل أفضل للـ caching
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // ضغط أفضل
    minify: "esbuild",
    // تحسين CSS
    cssCodeSplit: true,
    // Source maps للإنتاج (معطل للسرعة)
    sourcemap: false,
    // تقليل الحجم
    target: "es2020",
  },
  // تحسين التطوير
  server: {
    hmr: true,
  },
  // تحسين التبعيات
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "firebase/app", "zustand"],
  },
  // إزالة console.log في الإنتاج
  esbuild: {
    drop: ["console", "debugger"],
  },
});
