import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // 도메인 경계 강제:
      //   app/, features/는 인프라(lib/supabase, lib/storage, lib/redis, lib/resend)
      //   직접 import 금지 — services/* 를 통해 접근.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/supabase/admin',
                '@/lib/storage',
                '@/lib/redis',
                '@/lib/resend',
              ],
              message:
                'app/features 레이어에서는 services/ 를 통해 인프라에 접근하세요. services/*는 lib을 직접 import 해도 됩니다.',
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // services/, lib/, worker/는 인프라 import 허용
    files: ['src/services/**/*.ts', 'src/lib/**/*.ts', 'worker/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default eslintConfig;
