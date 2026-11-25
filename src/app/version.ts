declare const __APP_VERSION__: string;

/** Release version, injected from package.json at build time (vite `define`). */
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0-dev';
