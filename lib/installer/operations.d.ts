import { type DshCommand } from './discover.js';
export interface ProfileStatus {
    readonly profile: 'web' | 'headless';
    readonly installed: boolean;
    readonly verified: boolean;
    readonly changed: boolean;
}
export interface InstallReport {
    readonly tool: 'dsh-autofix';
    readonly version: string;
    readonly dshSource: DshCommand['source'];
    readonly dshHome: string;
    readonly source: string;
    readonly profiles: readonly ProfileStatus[];
    readonly skillDestinations: readonly string[];
    readonly packageLoad: boolean;
    readonly changed: boolean;
    readonly safeToRetry: boolean;
}
export interface VerifyReport {
    readonly tool: 'dsh-autofix';
    readonly version: string;
    readonly node: {
        readonly version: string;
        readonly supported: boolean;
    };
    readonly artifacts: Readonly<Record<string, boolean>>;
    readonly packageLoad: boolean;
    readonly dsh?: {
        readonly source: string;
        readonly home: string;
        readonly profiles: readonly ProfileStatus[];
    };
    readonly publishReady: boolean;
}
export interface OperationOptions {
    readonly packageRoot: string;
    readonly version: string;
    readonly env?: NodeJS.ProcessEnv;
}
export declare function install(options: OperationOptions): InstallReport;
export declare function uninstall(options: OperationOptions): InstallReport;
export declare function verify(options: OperationOptions): VerifyReport;
//# sourceMappingURL=operations.d.ts.map