import { describe, expect, it, vi } from 'vitest';
import type { CustomResolutionContext } from 'metro-resolver';
import {
  parseOutOfTreePlatforms,
  createPlatformPackageResolver,
} from '../out-of-tree-platforms.js';

describe('parseOutOfTreePlatforms', () => {
  it('returns platforms that declare an npmPackageName', () => {
    expect(
      parseOutOfTreePlatforms({
        platforms: {
          ios: {},
          android: {},
          windows: { npmPackageName: 'react-native-windows' },
          macos: { npmPackageName: 'react-native-macos' },
        },
      })
    ).toEqual([
      { name: 'windows', npmPackageName: 'react-native-windows' },
      { name: 'macos', npmPackageName: 'react-native-macos' },
    ]);
  });

  it('returns nothing when only in-tree platforms are registered', () => {
    expect(
      parseOutOfTreePlatforms({ platforms: { ios: {}, android: {} } })
    ).toEqual([]);
  });

  it('tolerates a missing or malformed platforms map', () => {
    expect(parseOutOfTreePlatforms(undefined)).toEqual([]);
    expect(parseOutOfTreePlatforms({})).toEqual([]);
    expect(parseOutOfTreePlatforms({ platforms: null })).toEqual([]);
  });
});

describe('createPlatformPackageResolver', () => {
  const context = {
    resolveRequest: vi.fn(),
  } as unknown as CustomResolutionContext;

  it('redirects react-native to the platform package when bundling for that platform', () => {
    const next = vi.fn();
    const resolver = createPlatformPackageResolver(
      { windows: 'react-native-windows' },
      next
    );

    resolver(context, 'react-native', 'windows');
    expect(next).toHaveBeenCalledWith(context, 'react-native-windows', 'windows');

    resolver(context, 'react-native/Libraries/Core/InitializeCore', 'windows');
    expect(next).toHaveBeenLastCalledWith(
      context,
      'react-native-windows/Libraries/Core/InitializeCore',
      'windows'
    );
  });

  it('leaves imports untouched for in-tree platforms and non-react-native modules', () => {
    const next = vi.fn();
    const resolver = createPlatformPackageResolver(
      { windows: 'react-native-windows' },
      next
    );

    resolver(context, 'react-native', 'ios');
    expect(next).toHaveBeenLastCalledWith(context, 'react-native', 'ios');

    resolver(context, 'react-native-reanimated', 'windows');
    expect(next).toHaveBeenLastCalledWith(
      context,
      'react-native-reanimated',
      'windows'
    );

    resolver(context, 'react-native', null);
    expect(next).toHaveBeenLastCalledWith(context, 'react-native', null);
  });

  it('does not rewrite a module that merely starts with the string react-native', () => {
    const next = vi.fn();
    const resolver = createPlatformPackageResolver(
      { windows: 'react-native-windows' },
      next
    );

    resolver(context, 'react-native-svg', 'windows');
    expect(next).toHaveBeenLastCalledWith(
      context,
      'react-native-svg',
      'windows'
    );
  });
});
