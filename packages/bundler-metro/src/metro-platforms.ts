import { createRequire } from 'node:module';
import { logger } from '@react-native-harness/tools';
import type { CustomResolutionContext, Resolution } from 'metro-resolver';
import type { MetroResolver } from './resolvers/types.js';

const require = createRequire(import.meta.url);
const log = logger.child('metro-platforms');

export type OutOfTreePlatform = {
  /** The platform name, e.g. `windows` — the value of Metro's `platform` param. */
  name: string;
  /** The package `react-native` imports are redirected to, e.g. `react-native-windows`. */
  npmPackageName: string;
};

type CliConfigModule = {
  loadConfig?: (options: unknown) => unknown;
  default?: (options: unknown) => unknown;
};

/**
 * Reads the React Native CLI config (`react-native.config.js` plus every
 * dependency's `react-native.config.js`) and returns the out-of-tree platforms
 * registered there — the ones with an `npmPackageName`, such as
 * `react-native-windows` or `react-native-macos`.
 *
 * The Harness loads Metro's config with a bare `Metro.loadConfig`, bypassing
 * `@react-native/community-cli-plugin`, so none of the out-of-tree wiring that
 * `react-native start` installs is applied. This is the first half of putting
 * it back; see `applyOutOfTreePlatformConfig`.
 *
 * Returns `[]` (and the caller leaves Metro's config untouched) when the CLI
 * config cannot be read — e.g. a project without `@react-native-community/cli`.
 */
export const resolveOutOfTreePlatforms = (
  projectRoot: string
): OutOfTreePlatform[] => {
  let cliConfigModule: CliConfigModule;
  try {
    const cliConfigPath = require.resolve('@react-native-community/cli-config', {
      paths: [projectRoot],
    });
    cliConfigModule = require(cliConfigPath) as CliConfigModule;
  } catch {
    log.debug(
      '@react-native-community/cli-config is not resolvable from %s; assuming no out-of-tree platforms',
      projectRoot
    );
    return [];
  }

  const loadConfig = cliConfigModule.loadConfig ?? cliConfigModule.default;
  if (typeof loadConfig !== 'function') {
    return [];
  }

  let cliConfig: unknown;
  try {
    // CLI >= 14 takes an options object; older releases took a positional
    // projectRoot string.
    cliConfig = loadConfig({ projectRoot });
  } catch {
    try {
      cliConfig = (loadConfig as (root: string) => unknown)(projectRoot);
    } catch (error) {
      log.debug(
        'could not load the React Native CLI config: %s',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  const outOfTree = parseOutOfTreePlatforms(cliConfig);

  if (outOfTree.length > 0) {
    log.debug(
      'detected out-of-tree platform(s): %s',
      outOfTree.map((p) => `${p.name} -> ${p.npmPackageName}`).join(', ')
    );
  }

  return outOfTree;
};

/**
 * Extracts the out-of-tree platforms from a loaded React Native CLI config —
 * the entries of `config.platforms` that carry an `npmPackageName`.
 */
export const parseOutOfTreePlatforms = (
  cliConfig: unknown
): OutOfTreePlatform[] => {
  const platforms =
    (cliConfig as { platforms?: Record<string, { npmPackageName?: string }> })
      ?.platforms ?? {};

  return Object.entries(platforms)
    .filter(([, config]) => Boolean(config?.npmPackageName))
    .map(([name, config]) => ({
      name,
      npmPackageName: config.npmPackageName as string,
    }));
};

/**
 * Wraps a Metro `resolveRequest` so that, when bundling for an out-of-tree
 * platform, `react-native` / `react-native/*` imports resolve against that
 * platform's package instead.
 *
 * Mirrors `reactNativePlatformResolver` from
 * `@react-native/community-cli-plugin` (`utils/metroPlatformResolver`), which
 * the package does not export. Kept in sync deliberately.
 */
export const createPlatformPackageResolver = (
  platformImplementations: Record<string, string>,
  next: MetroResolver
): MetroResolver => {
  return (
    context: CustomResolutionContext,
    moduleName: string,
    platform: string | null
  ): Resolution => {
    let redirected = moduleName;
    const implementation =
      platform != null ? platformImplementations[platform] : undefined;

    if (implementation != null) {
      if (moduleName === 'react-native') {
        redirected = implementation;
      } else if (moduleName.startsWith('react-native/')) {
        redirected = `${implementation}/${moduleName.slice('react-native/'.length)}`;
      }
    }

    return next(context, redirected, platform);
  };
};

/**
 * Resolves an out-of-tree platform's `Libraries/Core/InitializeCore` entry, so
 * it can be added to `getModulesRunBeforeMainModule` the way the CLI plugin
 * does. Metro only emits a `require()` for run-before modules that are actually
 * in a bundle's graph, so this is a no-op for in-tree (iOS/Android) bundles.
 */
export const resolveOutOfTreeInitializeCore = (
  npmPackageName: string,
  projectRoot: string
): string | null => {
  const specifier = `${npmPackageName}/Libraries/Core/InitializeCore`;
  try {
    return require.resolve(specifier, { paths: [projectRoot] });
  } catch {
    log.warn(
      'could not resolve %s; %s bundles may fail to register HMRClient and other core modules',
      specifier,
      npmPackageName
    );
    return null;
  }
};
