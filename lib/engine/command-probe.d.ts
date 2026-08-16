export interface CommandProbe {
    exists(command: string, signal: AbortSignal): Promise<boolean>;
    clear(): void;
}
export interface CommandProbeOptions {
    readonly platform?: NodeJS.Platform;
    readonly path?: string;
    readonly pathExt?: string;
    readonly ttlMs: number;
    readonly now?: () => number;
    readonly fileExists?: (path: string, executable: boolean) => boolean;
}
export declare function createCommandProbe(options: CommandProbeOptions): CommandProbe;
//# sourceMappingURL=command-probe.d.ts.map