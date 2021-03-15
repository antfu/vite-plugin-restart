import { defineConfig } from 'vite'
import VitePluginRestart from '../../src'

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
