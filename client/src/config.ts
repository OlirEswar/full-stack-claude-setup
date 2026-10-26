/**
 * Runtime configuration. `EXPO_PUBLIC_*` variables are inlined by Metro at
 * build time, so this must reference `process.env.EXPO_PUBLIC_API_URL`
 * directly (no destructuring / dynamic access).
 */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
