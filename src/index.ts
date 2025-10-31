import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import micromatch from 'micromatch'

export interface VitePluginRestartOptions {
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
  /**
   * Enable content-based change detection to prevent unnecessary restarts
   * when file metadata changes but content remains the same
   *
   * @default true
   */
  contentCheck?: boolean
}

let i = 0

// Store file content hashes globally to persist across server restarts
const globalFileHashes = new Map<string, Map<string, string>>()

function toArray<T>(arr: T | T[] | undefined): T[] {
  if (!arr)
    return []
  if (Array.isArray(arr))
    return arr
  return [arr]
}

function VitePluginRestart(options: VitePluginRestartOptions = {}): Plugin {
  const {
    delay = 500,
    glob: enableGlob = true,
    contentCheck = true,
  } = options

  let root = process.cwd()
  let reloadGlobs: string[] = []
  let restartGlobs: string[] = []

  let timerState = 'reload'
  let timer: ReturnType<typeof setTimeout> | undefined

  // Will be set in configResolved based on root directory
  let fileHashes: Map<string, string>

  function clear() {
    clearTimeout(timer)
  }
  function schedule(fn: () => void) {
    clear()
    timer = setTimeout(fn, delay)
  }

  function getFileHash(filePath: string): string | null {
    try {
      if (!existsSync(filePath)) {
        return null
      }
      const content = readFileSync(filePath)
      return createHash('sha256').update(content).digest('hex')
    }
    catch {
      // If we can't read the file, return null
      return null
    }
  }

  function hasContentChanged(filePath: string): boolean {
    if (!contentCheck) {
      // Content check disabled, always return true
      return true
    }

    const currentHash = getFileHash(filePath)
    const previousHash = fileHashes.get(filePath)

    // If we don't have a previous hash, this is a new file or first time seeing it
    if (previousHash === undefined) {
      // Update the stored hash for new files
      if (currentHash !== null) {
        fileHashes.set(filePath, currentHash)
      }
      return currentHash !== null
    }

    // Compare hashes
    const hasChanged = currentHash !== previousHash

    // Update the stored hash after comparison
    if (currentHash !== null) {
      fileHashes.set(filePath, currentHash)
    }
    else {
      // File was deleted
      fileHashes.delete(filePath)
    }

    return hasChanged
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
      // famous last words, but this *appears* to always be an absolute path
      // with all slashes normalized to forward slashes `/`. this is compatible
      // with path.posix.join, so we can use it to make an absolute path glob
      root = config.root

      // Get or create file hashes map for this root directory
      if (!globalFileHashes.has(root)) {
        globalFileHashes.set(root, new Map<string, string>())
      }
      fileHashes = globalFileHashes.get(root)!

      restartGlobs = toArray(options.restart).map(i => path.posix.join(root, i))
      reloadGlobs = toArray(options.reload).map(i => path.posix.join(root, i))
    },
    configureServer(server) {
      server.watcher.add([
        ...restartGlobs,
        ...reloadGlobs,
      ])
      server.watcher.on('add', handleFileChange)
      server.watcher.on('change', handleFileChange)
      server.watcher.on('unlink', handleFileChange)

      function handleFileChange(file: string) {
        // Check if content actually changed
        if (!hasContentChanged(file)) {
          return
        }

        if (micromatch.isMatch(file, restartGlobs)) {
          timerState = 'restart'
          schedule(() => {
            server.restart()
          })
        }
        else if (micromatch.isMatch(file, reloadGlobs) && timerState !== 'restart') {
          timerState = 'reload'
          schedule(() => {
            server.ws.send({ type: 'full-reload' })
            timerState = ''
          })
        }
      }
    },
  }
}

export default VitePluginRestart
