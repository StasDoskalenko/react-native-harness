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
  it('preserves a platform-provided getResourceLockKey', () => {
    const getResourceLockKey = () => 'ios:iPhone 16 Pro:18.0';

    const parsed = ConfigSchema.parse({
      ...baseConfig,
      runners: [{ ...runner, getResourceLockKey }],
    });

    expect(parsed.runners[0]?.getResourceLockKey?.()).toBe(
      'ios:iPhone 16 Pro:18.0'
    );
  });

  it('accepts an async getResourceLockKey', async () => {
    const parsed = ConfigSchema.parse({
      ...baseConfig,
      runners: [
        { ...runner, getResourceLockKey: async () => 'android:Pixel_8' },
      ],
    });

    await expect(parsed.runners[0]?.getResourceLockKey?.()).resolves.toBe(
      'android:Pixel_8'
    );
  });

  it('is optional', () => {
    const parsed = ConfigSchema.parse({ ...baseConfig, runners: [runner] });

    expect(parsed.runners[0]?.getResourceLockKey).toBeUndefined();
  });

  it('rejects a non-function getResourceLockKey', () => {
    expect(() =>
      ConfigSchema.parse({
        ...baseConfig,
        runners: [{ ...runner, getResourceLockKey: 'ios:lock' }],
      })
    ).toThrow();
  });
});
