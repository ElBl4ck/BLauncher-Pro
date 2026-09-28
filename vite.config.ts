import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), 
    tailwindcss(),
  ],
  base: './', // Establece la ruta base para producción
  server: {
    port: 5173, // Puerto del servidor de desarrollo
    strictPort: true, // Usa el puerto especificado o falla
  },
  build: {
    outDir: 'dist', // Directorio de salida para la compilación
  },
})
