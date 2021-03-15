import fs from 'fs'
import path from 'path'
import { bold, dim, yellow } from 'chalk'
import type { Plugin } from 'vite'
import micromatch from 'micromatch'

interface Options {
  /**
   * Enable glob support for watcher (it's disabled by Vite, but add this plugin will turn it on by default)
   *
   * @default true
   */
  glob?: boolean
  /**
   * @default 500
   */
  delay?: number
  /**
   * Array of files to watch, changes to those file will trigger a server restart
   */
  restart?: string | string[]
  /**
   * Array of files to watch, changes to those file will trigger a client full page reload
   */
  reload?: string | string[]
}

function touch(path: string) {
  const time = new Date()

  try {
    fs.utimesSync(path, time, time)
  }
  catch (err) {
    fs.closeSync(fs.openSync(path, 'w'))
  }
}

let i = 0

function toArray<T>(arr: T | T[] | undefined): T[] {
  if (!arr)
    return []
  if (Array.isArray(arr))
    return arr
  return [arr]
}

function VitePluginRestart(options: Options = {}): Plugin {
  const {
    delay = 500,
    glob: enableGlob = true,
  } = options

  let root = process.cwd()
  let reloadGlobs: string[] = []
  let restartGlobs: string[] = []

  let configFile = 'vite.config.js'

  let timerState = 'reload'
  let timer: number | undefined
  function clear() {
    clearTimeout(timer)
  }
  function schedule(fn: () => void) {
    clear()
    timer = setTimeout(fn, delay) as any as number
  }

  return {
    name: `vite-plugin-restart:${i++}`,
    apply: 'serve',
    config(c) {
      if (!enableGlob)
        return
      if (!c.server)
        c.server = {}
      if (!c.server.watch)
        c.server.watch = {}
      c.server.watch.disableGlobbing = false
    },
    configResolved(config) {
      if (fs.existsSync('vite.config.ts'))
        configFile = 'vite.config.ts'
      root = config.root

      reloadGlobs = toArray(options.reload).map(i => path.posix.resolve(root, i))
      restartGlobs = toArray(options.restart).map(i => path.posix.resolve(root, i))
    },
    configureServer(server) {
      server.watcher.add([
        ...restartGlobs,
        ...reloadGlobs,
      ])
      server.watcher.on(
        'change',
        (file) => {
          if (micromatch.isMatch(file, restartGlobs)) {
            timerState = 'restart'
            schedule(() => {
              touch(configFile)
              console.log(
                dim(new Date().toLocaleTimeString())
                + bold.blue` [plugin-restart] `
                + yellow`restarting server by ${path.posix.relative(root, file)}`,
              )
              timerState = ''
            })
          }
          else if (micromatch.isMatch(file, reloadGlobs) && timerState !== 'restart') {
            timerState = 'reload'
            schedule(() => {
              server.ws.send({ type: 'full-reload' })
              timerState = ''
            })
          }
        },
      )
    },
  }
}

export default VitePluginRestart
