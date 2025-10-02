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
    'quotes': 'off',
    '@stylistic/quotes': 'off',
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'operator-linebreak': 'off',
    '@stylistic/operator-linebreak': 'off',
    '@stylistic/member-delimiter-style': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    'quote-props': 'off',
    '@stylistic/quote-props': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'arrow-parens': 'off',
    '@stylistic/arrow-parens': 'off'
  }
})
