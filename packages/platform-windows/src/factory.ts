import { HarnessPlatform } from '@react-native-harness/platforms';
import type { WindowsPlatformConfigInput } from './config.js';

export const windowsPlatform = (
  config: WindowsPlatformConfigInput
): HarnessPlatform<WindowsPlatformConfigInput> => ({
  name: config.name,
  config,
  runner: import.meta.resolve('./runner.js'),
  platformId: 'windows',
  getResourceLockKey: () => `windows:${config.packageName}`,
});
