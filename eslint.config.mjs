import { configs, plugins } from 'eslint-config-airbnb-extended';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'build/', 'coverage/'],
  },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
  },
  prettierConfig,
];
