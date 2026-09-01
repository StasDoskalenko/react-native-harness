import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn<(specifier: string) => string>(),
}));

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:module')>();
  return {
    ...actual,
    createRequire: () =>
      Object.assign(vi.fn(), { resolve: mocks.resolve }) as unknown,
  };
});

import enhanceMetroConfig from '../metro-config-enhancer.js';

type Ctx = { projectRoot: string };
const context: Ctx = { projectRoot: '/repo/app' };

beforeEach(() => {
  mocks.resolve.mockReset();
  mocks.resolve.mockImplementation(() => {
    throw new Error('not found');
  });
});

describe('enhanceMetroConfig', () => {
  it('adds windows and native to resolver.platforms, keeping existing entries', () => {
    const config = enhanceMetroConfig(
      { resolver: { platforms: ['ios', 'android'] } },
      context
    );

    expect(config.resolver?.platforms).toEqual([
      'ios',
      'android',
      'windows',
      'native',
    ]);
  });

  it('redirects react-native imports to react-native-windows for the windows platform', () => {
    const ctx = { resolveRequest: vi.fn() };
    const config = enhanceMetroConfig({ resolver: {} }, context);

    config.resolver?.resolveRequest?.(ctx as never, 'react-native', 'windows');
    expect(ctx.resolveRequest).toHaveBeenLastCalledWith(
      ctx,
      'react-native-windows',
      'windows'
    );

    config.resolver?.resolveRequest?.(
      ctx as never,
      'react-native/Libraries/Text/Text',
      'windows'
    );
    expect(ctx.resolveRequest).toHaveBeenLastCalledWith(
      ctx,
      'react-native-windows/Libraries/Text/Text',
      'windows'
    );
  });

  it('leaves imports untouched for other platforms and non-react-native modules', () => {
    const ctx = { resolveRequest: vi.fn() };
    const config = enhanceMetroConfig({ resolver: {} }, context);

    config.resolver?.resolveRequest?.(ctx as never, 'react-native', 'ios');
    expect(ctx.resolveRequest).toHaveBeenLastCalledWith(
      ctx,
      'react-native',
      'ios'
    );

    config.resolver?.resolveRequest?.(
      ctx as never,
      'react-native-svg',
      'windows'
    );
    expect(ctx.resolveRequest).toHaveBeenLastCalledWith(
      ctx,
      'react-native-svg',
      'windows'
    );
  });

  it('composes with an existing resolveRequest', () => {
    const existing = vi.fn();
    const config = enhanceMetroConfig(
      { resolver: { resolveRequest: existing } },
      context
    );

    const ctx = { resolveRequest: vi.fn() };
    config.resolver?.resolveRequest?.(ctx as never, 'react-native', 'windows');

    expect(existing).toHaveBeenCalledWith(ctx, 'react-native-windows', 'windows');
    expect(ctx.resolveRequest).not.toHaveBeenCalled();
  });

  it("appends react-native-windows InitializeCore after the project's own", () => {
    mocks.resolve.mockImplementation((specifier) => {
      if (specifier === 'react-native-windows/Libraries/Core/InitializeCore') {
        return '/repo/app/node_modules/react-native-windows/Libraries/Core/InitializeCore.js';
      }
      throw new Error('not found');
    });

    const config = enhanceMetroConfig(
      {
        serializer: {
          getModulesRunBeforeMainModule: () => ['/repo/rn/InitializeCore.js'],
        },
      },
      context
    );

    expect(
      config.serializer?.getModulesRunBeforeMainModule?.('index.js')
    ).toEqual([
      '/repo/rn/InitializeCore.js',
      '/repo/app/node_modules/react-native-windows/Libraries/Core/InitializeCore.js',
    ]);
  });

  it('leaves getModulesRunBeforeMainModule alone when InitializeCore cannot be resolved', () => {
    const runBefore = () => ['/repo/rn/InitializeCore.js'];
    const config = enhanceMetroConfig(
      { serializer: { getModulesRunBeforeMainModule: runBefore } },
      context
    );

    expect(config.serializer?.getModulesRunBeforeMainModule).toBe(runBefore);
  });
});
