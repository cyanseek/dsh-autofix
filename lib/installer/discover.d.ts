export interface DshCommand {
    readonly command: string;
    readonly prefix: readonly string[];
    readonly source: 'environment' | 'path' | 'npx';
}
export declare function resolveDshCommand(env?: NodeJS.ProcessEnv): DshCommand;
export declare function resolveDshHome(env?: NodeJS.ProcessEnv): string;
/** Only existing built-in profiles are changed; no profile is created by discovery. */
export declare function discoverProfiles(dshHome: string): readonly ('web' | 'headless')[];
//# sourceMappingURL=discover.d.ts.map