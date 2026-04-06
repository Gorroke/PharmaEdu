import nextConfig from 'eslint-config-next';

// eslint-config-next v16+ returns a flat config array directly.
// Do NOT wrap with FlatCompat — that causes a circular JSON error.
const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // localStorage hydration 패턴은 SSR-safe 초기화를 위해 useEffect 내 setState가 필요함.
      // (useLearningProgress, CourseMapIslandWrapper, LearnHeroIsland 등)
      // warn으로 낮춰 빌드/lint pass를 허용.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
