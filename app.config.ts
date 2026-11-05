import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'AI Life Planner',
  slug: config.slug ?? 'ai-life-planner',
  experiments: {
    ...config.experiments,
    // Only the Pages build gets a subpath; native and local web keep their defaults.
    ...(process.env.GITHUB_PAGES === '1' ? { baseUrl: '/ai-life-planner' } : {}),
  },
});
