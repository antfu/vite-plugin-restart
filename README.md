<h2 align='center'><samp>vite-plugin-restart</samp></h2>

<p align='center'>Custom files/globs to restart Vite server</p>

<p align='center'>
<a href='https://www.npmjs.com/package/vite-plugin-restart'>
<img src='https://img.shields.io/npm/v/vite-plugin-restart?color=222&style=flat-square'>
</a>
</p>

<br>

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

<br>

## Usage

Install

```bash
npm i vite-plugin-restart -D # yarn add vite-plugin-restart -D
```

Add it to `vite.config.js`

```ts
// vite.config.js
import ViteRestart from 'vite-plugin-restart'

export default {
  plugins: [
    ViteRestart({
      restart: [
        'my.config.[jt]s',
      ]
    })
  ],
};
```

Changes to `my.config.js` or `my.config.ts` will now restart the server automatically.

## Motivation

Byebye `nodemon -w my.config.js -x 'vite'`

## License

MIT License © 2021 [Anthony Fu](https://github.com/antfu)
