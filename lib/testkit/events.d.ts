/** Shared Cordis event augmentation for runtime and reporter plugins. */
import type { ChaosDecisionEvent } from './core.js';
declare module '@deepseek-ai/cordis' {
    interface Events {
        /** Emitted for both dry-run and real chaos decisions. */
        'tool-chaos/decision'(decision: ChaosDecisionEvent): void;
    }
}
export {};
//# sourceMappingURL=events.d.ts.map