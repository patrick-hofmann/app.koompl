// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['eslint.config.mjs'],
  rules: {
    'vue/no-multiple-template-root': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/html-indent': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
    '@stylistic/member-delimiter-style': ['error', {
      multiline: { delimiter: 'semi', requireLast: false },
      singleline: { delimiter: 'semi', requireLast: false }
    }],
    '@typescript-eslint/no-explicit-any': 'off',
    'arrow-parens': ['error', 'as-needed', { requireForBlockBody: false }],
    '@stylistic/arrow-parens': ['error', 'as-needed', { requireForBlockBody: false }]
  }
})
