/** Optional internal tuning. The default installation uses an empty config. */
export interface Config {
    enabled?: boolean;
    maxInterventionsPerFingerprint?: number;
    fingerprintTtlMs?: number;
    maxContextChars?: number;
    commandCacheTtlMs?: number;
    debug?: boolean;
}
export interface ResolvedConfig {
    enabled: boolean;
    maxInterventionsPerFingerprint: number;
    fingerprintTtlMs: number;
    maxContextChars: number;
    commandCacheTtlMs: number;
    debug: boolean;
}
export declare function resolveConfig(input?: Config): ResolvedConfig;
//# sourceMappingURL=options.d.ts.map