import { createRequire } from 'node:module';
import { logger } from '@react-native-harness/tools';
import type { MetroConfigEnhancerContext } from '@react-native-harness/platforms';
import type { MetroConfig } from 'metro-config';
import type { CustomResolutionContext, Resolution } from 'metro-resolver';

const require = createRequire(import.meta.url);
const log = logger.child('platform-windows');

const RNW_PACKAGE = 'react-native-windows';

type MetroResolveRequest = (
  context: CustomResolutionContext,
  moduleName: string,
  platform: string | null
) => Resolution;

/**
 * Redirects `react-native` / `react-native/*` imports to `react-native-windows`
 * when Metro is bundling for the `windows` platform, composing with whatever
 * `resolveRequest` is already set. This is what
 * `@react-native/community-cli-plugin`'s `reactNativePlatformResolver` does for
 * an out-of-tree platform; the harness bypasses that plugin, so the platform
 * package supplies it.
 */
const withWindowsPackageRedirect = (
  next: MetroResolveRequest | undefined
): MetroResolveRequest => {
  const passThrough: MetroResolveRequest =
    next ?? ((ctx, name, plat) => ctx.resolveRequest(ctx, name, plat));

  return (context, moduleName, platform) => {
    let redirected = moduleName;

    if (platform === 'windows') {
      if (moduleName === 'react-native') {
        redirected = RNW_PACKAGE;
      } else if (moduleName.startsWith('react-native/')) {
        redirected = `${RNW_PACKAGE}/${moduleName.slice('react-native/'.length)}`;
      }
    }

    return passThrough(context, redirected, platform);
  };
};

/**
 * Resolves `react-native-windows/Libraries/Core/InitializeCore` from the
 * project. Without it in `getModulesRunBeforeMainModule` a `windows` bundle
 * never runs `setUpBatchedBridge`, so `HMRClient` is not a registered callable
 * module and React Native Windows redboxes the instance before the harness can
 * attach. Metro only emits a `require()` for run-before modules that end up in
 * a bundle's graph, so this is inert for any non-Windows bundle.
 */
const resolveInitializeCore = (projectRoot: string): string | null => {
  const specifier = `${RNW_PACKAGE}/Libraries/Core/InitializeCore`;
  try {
    return require.resolve(specifier, { paths: [projectRoot] });
  } catch {
    log.warn(
      'could not resolve %s from %s; Windows bundles may fail to initialize',
      specifier,
      projectRoot
    );
    return null;
  }
};

const enhanceMetroConfig = (
  metroConfig: MetroConfig,
  { projectRoot }: MetroConfigEnhancerContext
): MetroConfig => {
  const initializeCore = resolveInitializeCore(projectRoot);
  const existingRunBeforeMainModule =
    metroConfig.serializer?.getModulesRunBeforeMainModule;

  return {
    ...metroConfig,
    resolver: {
      ...metroConfig.resolver,
      platforms: [
        ...new Set([
          ...(metroConfig.resolver?.platforms ?? ['ios', 'android']),
          'windows',
          'native',
        ]),
      ],
      resolveRequest: withWindowsPackageRedirect(
        metroConfig.resolver?.resolveRequest ?? undefined
      ),
    },
    serializer: {
      ...metroConfig.serializer,
      ...(initializeCore
        ? {
            getModulesRunBeforeMainModule: (entryPoint: string) => [
              ...(existingRunBeforeMainModule?.(entryPoint) ?? []),
              initializeCore,
            ],
          }
        : {}),
    },
  };
};

export default enhanceMetroConfig;
