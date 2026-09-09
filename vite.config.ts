import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 每次构建生成唯一版本号:一份通过 define 注入应用代码(__APP_VERSION__),
// 一份输出为 version.json 供客户端轮询比对,从而检测服务器是否已部署新版本
const appVersion = Date.now().toString(36)
const buildTime = new Date().toISOString()

/** 构建时额外输出 version.json 到站点根目录(客户端版本检测的数据源) */
function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion, buildTime }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // 产物按类型分包:JS 统一入 assets/js/(入口与异步 chunk)
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // 静态资源按扩展名分目录:css / img / fonts / media,其余归 assets/misc/
        // 注意:所有产物仍在 assets/ 前缀下,nginx 的 /assets/ 长缓存规则不受影响
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.names[0] ?? ''
          const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
          if (ext === 'css') {
            return 'assets/css/[name]-[hash][extname]'
          }
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(ext)) {
            return 'assets/img/[name]-[hash][extname]'
          }
          if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          if (['mp4', 'webm', 'ogg', 'mp3', 'wav', 'flac', 'aac'].includes(ext)) {
            return 'assets/media/[name]-[hash][extname]'
          }
          return 'assets/misc/[name]-[hash][extname]'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 把真实客户端 IP 以 X-Forwarded-For 等头转发给后端,否则后端日志
        // 记录的永远是本 Node 代理的地址(vite preview 默认继承此配置)
        xfwd: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
})
