// https://nuxt.com/docs/api/configuration/nuxt-config

/*
order is important

export const OFFICIAL_MODULES = {
  client: [
    'site', // SEO module
    'colorMode',
    'content',
    'mdc',
    'ui',
  ],

  server: [
    'hub',
  ],
}

export const ORDER_KEYS = [
  // Ids
  'appId',
  'buildId',

  // Extends
  'extends',
  'theme',

  // Extensions
  'modules',
  'plugins',

  // Env ($production, $development, $test)
  /^\$/,

  // Nuxt Core Features
  'ssr',
  'pages',
  'components',
  'imports',
  'devtools',

  // Client-side Integrations
  'app',
  'css',
  'vue',
  'router',
  'unhead',
  ...OFFICIAL_MODULES.client,
  'spaLoadingTemplate',

  // Runtime Configs
  'appConfig',
  'runtimeConfig',

  // Dirs
  'dir',
  'rootDir',
  'srcDir',
  'appDir',
  'workspaceDir',
  'serverDir',
  'buildDir',
  'modulesDir',
  'analyzeDir',

  // Resultions
  'alias',
  'extensions',
  'ignore',
  'ignoreOptions',
  'ignorePrefix',

  // Build Pipeline Configs
  'builder',
  'build',
  'generate',
  'routeRules',
  'sourcemap',
  'optimization',

  // Development
  'dev',
  'devServer',
  'watch',
  'watchers',

  // Feature flags
  'future',
  'features',
  'experimental',
  'compatibilityDate',

  // Nitro
  'nitro',
  ...OFFICIAL_MODULES.server,
  'serverHandlers',
  'devServerHandlers',

  // Tooling Integrations
  'vite',
  'webpack',
  'typescript',
  'postcss',

  // Other Integrations
  'test',
  'telemetry',

  // Logging
  'debug',
  'logLevel',

  // Hooks
  'hooks',
]
*/

export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
    // 'nuxt-security'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    storage: {
      // Filesystem storage for agents (Koompls)
      agents: {
        driver: 'fs',
        base: './.data/agents'
      },
      // Filesystem storage for app settings
      settings: {
        driver: 'fs',
        base: './.data/settings'
      },
      // Inbound emails archive
      inbound: {
        driver: 'fs',
        base: './.data/inbound'
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }

  // security: {
  //   headers: {
  //     contentSecurityPolicy: {
  //       'img-src': ['\'self\'', 'data:', 'https:', 'https://i.pravatar.cc']
  //     }
  //   }
  // }
})
