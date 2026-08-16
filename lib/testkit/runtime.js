import './events.js';
import { resolveConfig } from './options.js';
import { ChaosEngine } from './core.js';
function executionView(exec) {
    return {
        callId: String(exec.callId),
        rootCallId: String(exec.rootCallId),
        name: exec.name,
        arguments: exec.arguments,
    };
}
function chaosFailure(decision, code) {
    return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${decision.message}` }],
        error: {
            message: decision.message,
            info: { name: 'ChaosInjectedError', code },
        },
    };
}
function abortReason(signal) {
    return signal.reason ?? new Error('tool call aborted during injected delay');
}
async function abortableDelay(milliseconds, signal) {
    if (signal.aborted)
        throw abortReason(signal);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(abortReason(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
async function executeInjectedAbort(exec, next, decision, report) {
    const upstream = exec.signal;
    const controller = new AbortController();
    let chaosFired = false;
    const onUpstreamAbort = () => controller.abort(abortReason(upstream));
    if (upstream.aborted)
        onUpstreamAbort();
    else
        upstream.addEventListener('abort', onUpstreamAbort, { once: true });
    const timer = setTimeout(() => {
        chaosFired = true;
        report();
        controller.abort(new Error(decision.message));
    }, decision.delayMs ?? 1_000);
    exec.signal = controller.signal;
    try {
        try {
            const result = await next();
            return chaosFired ? chaosFailure(decision, 'CHAOS_ABORTED') : result;
        }
        catch (error) {
            if (chaosFired)
                return chaosFailure(decision, 'CHAOS_ABORTED');
            throw error;
        }
    }
    finally {
        clearTimeout(timer);
        upstream.removeEventListener('abort', onUpstreamAbort);
        exec.signal = upstream;
    }
}
/** Register deterministic policy, around-dispatch, and post-result faults. */
export function apply(ctx, config = {}) {
    const engine = new ChaosEngine(resolveConfig(config));
    const report = (decision) => {
        ctx.emit('tool-chaos/decision', decision);
    };
    ctx.on('tools/pre-execute', async (exec, next) => {
        const decision = engine.decide('pre', executionView(exec));
        if (decision === undefined)
            return next();
        report(decision);
        if (!decision.injected)
            return next();
        return { kind: 'deny', reason: decision.message };
    });
    ctx.on('tools/execute', async (exec, next) => {
        const decision = engine.decide('execute', executionView(exec));
        if (decision === undefined)
            return next();
        if (!decision.injected) {
            report(decision);
            return next();
        }
        if (decision.action === 'abort') {
            return executeInjectedAbort(exec, next, decision, () => report(decision));
        }
        report(decision);
        if (decision.action === 'delay') {
            await abortableDelay(decision.delayMs ?? 1_000, exec.signal);
            return next();
        }
        if (decision.action === 'error') {
            return chaosFailure(decision, 'CHAOS_INJECTED');
        }
        // Action/phase mapping is closed in ChaosEngine. This branch protects a
        // future action from silently delegating if the adapter is not updated.
        return chaosFailure(decision, 'CHAOS_ADAPTER_MISMATCH');
    });
    ctx.on('tools/post-execute', async (exec, _result, next) => {
        const decision = engine.decide('post', executionView(exec));
        if (decision === undefined)
            return next();
        report(decision);
        if (!decision.injected)
            return next();
        return {
            kind: 'block',
            feedback: [{ type: 'text', text: decision.message }],
        };
    });
}
//# sourceMappingURL=runtime.js.map