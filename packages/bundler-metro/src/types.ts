import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { RunServerOptions } from 'metro';
import type { Reporter } from './reporter.js';
import type { Config as HarnessConfig } from '@react-native-harness/config';

export type MetroWebSocketEndpoints = NonNullable<
  RunServerOptions['websocketEndpoints']
>;
export type MetroWebSocketEndpoint = MetroWebSocketEndpoints[string];

export type MetroOptions = {
  projectRoot: string;
  harnessConfig: HarnessConfig;
  websocketEndpoints?: MetroWebSocketEndpoints;
  /**
   * `HarnessPlatform.metroConfigEnhancer` for the selected runner, if it sets
   * one: a module specifier the bundler imports and runs against the composed
   * Metro config so the platform can apply the wiring its runtime needs.
   */
  metroConfigEnhancer?: string;
  /**
   * Whether Jest is running in watch mode (`--watch` / `--watchAll`). Only
   * then does Metro need a file watcher; a one-shot run bundles once and
   * exits, so watching just costs a watchman subscription and the file-map
   * auto-save timer.
   */
  watchMode?: boolean;
};

export type WaitForMetroHealthOptions = {
  timeoutMs: number;
  signal: AbortSignal;
};

export type PrewarmMetroBundleOptions = {
  platform: string;
  signal: AbortSignal;
};

export type PrewarmState = 'idle' | 'pending' | 'succeeded' | 'failed';

export type MetroInstance = {
  events: Reporter;
  httpServer: HttpServer | HttpsServer;
  websocketEndpoints: MetroWebSocketEndpoints;
  waitUntilHealthy: (options: WaitForMetroHealthOptions) => Promise<string>;
  prewarm: (options: PrewarmMetroBundleOptions) => Promise<boolean>;
  getPrewarmState: () => PrewarmState;
  isBuildInFlight: () => boolean;
  dispose: () => Promise<void>;
};

export type MetroFactory = () => Promise<MetroInstance>;
