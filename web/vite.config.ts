import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],

  // Al publicar, la app vivirá en luisch57.github.io/reservas-canchas/.
  // En desarrollo (npm run dev) sigue en la raíz: localhost:5173/
  base: command === 'build' ? '/reservas-canchas/' : '/',

  server: {
    // PROXY: en desarrollo, las peticiones a "/api/..." se reenvían
    // a la API que corre en el puerto 3000.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}))
