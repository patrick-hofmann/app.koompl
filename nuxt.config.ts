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
    '@nuxt/content',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
    // 'nuxt-security'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    mailgun: {
      key: process.env.MAILGUN_KEY || ''
    },
    feedback: {
      email: '',
      sender: ''
    },
    session: {
      maxAge: 60 * 60 * 24 * 7 // 1 week
    },
    public: {
      sessionPassword:
        process.env.NUXT_SESSION_PASSWORD || 'dev-session-password-must-be-at-least-32-characters'
    }
  },

  routeRules: {
    '/api/**': {
      cors: true
    }
    // Cache-read heavy endpoints briefly to mask storage latency
    // '/api/agents': {
    //   cache: { maxAge: 30, swr: true, staleMaxAge: 300 }
    // },
    // '/api/agents/**': {
    //   cache: { maxAge: 30, swr: true, staleMaxAge: 300 }
    // },
    // '/api/settings': {
    //   cache: { maxAge: 60, swr: true, staleMaxAge: 600 }
    // },
    // Disable SSR for agents UI to avoid blocking on server storage
    // '/agents': { ssr: false },
    // '/agents/**': { ssr: false }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    timing: true,
    storage: {
      // Fast in-memory cache storage for routeRules/response caching
      // cache: {
      //   driver: 'memory'
      // },
      // Filesystem storage for agents (Koompls)
      agents: {
        // driver: 'fs',
        // base: './.data/agents'
        driver: 's3',
        bucket: process.env.S3_BUCKET_AGENTS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Filesystem storage for app settings
      settings: {
        // driver: 'fs',
        // base: './.data/settings'
        driver: 's3',
        bucket: process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // User, team, and membership directory
      identity: {
        driver: 's3',
        bucket: process.env.S3_BUCKET_IDENTITY || process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // MCP servers storage (falls back to settings bucket if dedicated bucket not set)
      mcp: {
        driver: 's3',
        bucket: process.env.S3_BUCKET_MCPS || process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Inbound emails archive
      inbound: {
        // driver: 'fs',
        // base: './.data/inbound'
        driver: 's3',
        bucket: process.env.S3_BUCKET_INBOUND,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Persistent storage for agent activity logs
      'agent-logs': {
        // driver: 'fs',
        // base: './.data/agent-logs'
        driver: 's3',
        bucket: process.env.S3_BUCKET_AGENT_LOGS || process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Persistent unified mail storage (inbound/outbound logs and snapshots)
      mail: {
        // driver: 'fs',
        // base: './.data/mail'
        driver: 's3',
        bucket:
          process.env.S3_BUCKET_MAIL ||
          process.env.S3_BUCKET_INBOUND ||
          process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Hierarchical mount for emails grouped per team/agent with attachments
      'email-mount-point': {
        driver: 's3',
        bucket:
          process.env.S3_BUCKET_EMAILS ||
          process.env.S3_BUCKET_MAIL ||
          process.env.S3_BUCKET_INBOUND ||
          process.env.S3_BUCKET_SETTINGS,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
      },
      // Persistent storage for team datasafe vault
      datasafe: {
        // driver: 'fs',
        // base: './.data/datasafe'

        driver: 's3',
        bucket: process.env.S3_BUCKET_DATASAFE,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT
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
  },

  fonts: {
    bunny: false,
    unifont: false
  }

  // security: {
  //   headers: {
  //     contentSecurityPolicy: {
  //       'img-src': ['\'self\'', 'data:', 'https:', 'https://i.pravatar.cc']
  //     }
  //   }
  // }
})
