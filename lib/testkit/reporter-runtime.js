/** Stable JSONL reporter implementation without schema/runtime dependencies. */
import process from 'node:process';
import './events.js';
export function resolveReporterConfig(config = {}) {
    const prefix = config.prefix ?? 'DSH_TOOL_CHAOS_EVENT ';
    const includeDryRun = config.includeDryRun ?? true;
    if (prefix.length === 0 || prefix.length > 128 || /[\r\n]/.test(prefix)) {
        throw new Error('dsh-tool-chaos-reporter: prefix must contain 1..128 characters and no line breaks');
    }
    return { prefix, includeDryRun };
}
/** Register the machine-readable decision stream. */
export function applyReporter(ctx, config = {}) {
    const resolved = resolveReporterConfig(config);
    ctx.on('tool-chaos/decision', (decision) => {
        if (decision.dryRun && !resolved.includeDryRun)
            return;
        process.stderr.write(`${resolved.prefix}${JSON.stringify(decision)}\n`);
    });
}
//# sourceMappingURL=reporter-runtime.js.map