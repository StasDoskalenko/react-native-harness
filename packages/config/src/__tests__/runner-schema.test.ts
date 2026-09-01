import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../types.js';

const baseConfig = {
  entryPoint: './index.js',
  appRegistryComponentName: 'App',
};

const runner = {
  name: 'ios',
  config: {},
  runner: 'file:///runner.js',
  platformId: 'ios',
};

describe('ConfigSchema runner', () => {
  it('preserves a platform-provided metroConfigEnhancer path', () => {
    const parsed = ConfigSchema.parse({
      ...baseConfig,
      runners: [
        {
          ...runner,
          metroConfigEnhancer: 'file:///pkg/dist/metro-config-enhancer.js',
        },
      ],
    });

    expect(parsed.runners[0]?.metroConfigEnhancer).toBe(
      'file:///pkg/dist/metro-config-enhancer.js'
    );
  });

  it('leaves metroConfigEnhancer undefined when a runner does not set one', () => {
    const parsed = ConfigSchema.parse({ ...baseConfig, runners: [runner] });

    expect(parsed.runners[0]?.metroConfigEnhancer).toBeUndefined();
  });

  it('rejects a non-string metroConfigEnhancer', () => {
    expect(() =>
      ConfigSchema.parse({
        ...baseConfig,
        runners: [{ ...runner, metroConfigEnhancer: 42 }],
      })
    ).toThrow();
  });
});
