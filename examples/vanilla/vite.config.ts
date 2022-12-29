import { defineConfig } from 'vite'
import VitePluginRestart from 'vite-plugin-restart'

export default defineConfig({
  plugins: [
    VitePluginRestart({
      restart: [
        'trigger.txt',
        '../../dist/*.*',
      ],
    }),
  ],
})
