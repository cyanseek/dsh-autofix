import process from 'node:process';
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm';
import { createCommandProbe } from './engine/command-probe.js';
import { executionScope, recoveryFingerprint } from './engine/fingerprint.js';
import { InterventionState } from './engine/state.js';
import { boundText } from './engine/text.js';
import { resolveConfig } from './options.js';
import { createDefaultRecipes } from './recipes/index.js';
const PLUGIN_SOURCE = { kind: 'dsh-autofix', form: 'notice' };
function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    try {
        return String(error);
    }
    catch {
        return '<unprintable>';
    }
}
function optionalFileSystem(ctx) {
    const candidate = ctx.get('fs');
    if (candidate === null || typeof candidate !== 'object')
        return undefined;
    const record = candidate;
    if (typeof record.resolve !== 'function' || typeof record.stat !== 'function'
        || typeof record.readText !== 'function' || typeof record.streamText !== 'function')
        return undefined;
    return candidate;
}
function addContext(downstream, context) {
    const additionalContexts = [context, ...downstream.additionalContexts ?? []];
    if (downstream.kind === 'block')
        return { ...downstream, additionalContexts };
    return { ...downstream, additionalContexts };
}
function emitRecovery(event) {
    try {
        const emit = process.emit;
        emit.call(process, 'autofix/recovery', event);
    }
    catch {
        // Optional observers must never change the tool result or recovery path.
    }
}
async function firstMatch(recipes, input) {
    for (const recipe of recipes) {
        const match = recipe.match(input);
        if (match !== undefined)
            return { recipe, match };
    }
    return undefined;
}
/** Internal/test seam for mounting an explicit ordered recipe list. */
export function applyRuntime(ctx, config = {}, recipes = createDefaultRecipes()) {
    const resolved = resolveConfig(config);
    if (!resolved.enabled)
        return;
    const state = new InterventionState(resolved.fingerprintTtlMs, resolved.maxInterventionsPerFingerprint);
    const commandProbe = createCommandProbe({ ttlMs: resolved.commandCacheTtlMs });
    const lifetime = new AbortController();
    const logger = resolved.debug ? ctx.logger('dsh-autofix') : undefined;
    ctx.effect(() => {
        // Denials can enter post-execute with arbitrary human-readable feedback.
        // Only executions that passed the policy gate may receive recovery advice.
        const dispatched = new Set();
        const disposeDispatch = ctx.on('tools/execute', async (exec, next) => {
            dispatched.add(exec.token);
            return next();
        });
        const disposeResult = ctx.on('tools/result', (exec) => { dispatched.delete(exec.token); });
        const disposeListener = ctx.on('tools/post-execute', (exec, result, next) => {
            // The successful path delegates before doing any serialization, matching,
            // filesystem/PATH work, logging, event emission, or context construction.
            if (!result.isError) {
                const downstream = next();
                state.clearScope(executionScope(exec));
                return downstream;
            }
            if (!dispatched.has(exec.token) || exec.signal.aborted || lifetime.signal.aborted)
                return next();
            return (async () => {
                const signal = AbortSignal.any([exec.signal, lifetime.signal]);
                const fs = optionalFileSystem(ctx);
                const input = {
                    ctx,
                    exec,
                    result,
                    config: resolved,
                    services: {
                        ...(fs === undefined ? {} : { fs }),
                        commandExists: commandProbe.exists,
                        platform: process.platform,
                        now: Date.now,
                    },
                    signal,
                };
                let selected;
                try {
                    selected = await firstMatch(recipes, input);
                }
                catch (error) {
                    logger?.debug('recipe matching failed: %s', errorMessage(error));
                    return next();
                }
                if (selected === undefined || signal.aborted)
                    return next();
                const fingerprint = recoveryFingerprint(exec, selected.recipe.id, selected.match.fingerprint);
                if (!state.claim(fingerprint.key, fingerprint.scope))
                    return next();
                let decision;
                try {
                    decision = await selected.recipe.recover(input, selected.match);
                    if (decision === undefined || signal.aborted) {
                        state.release(fingerprint.key);
                        return next();
                    }
                }
                catch (error) {
                    state.release(fingerprint.key);
                    logger?.debug('recipe %s failed: %s', selected.recipe.id, errorMessage(error));
                    return next();
                }
                let context;
                try {
                    const summary = boundContextSummary(decision.summary);
                    context = createUserMessage({
                        content: [{ type: 'text', text: boundText(decision.text, resolved.maxContextChars) }],
                        source: { ...PLUGIN_SOURCE, summary },
                    });
                }
                catch (error) {
                    state.release(fingerprint.key);
                    logger?.debug('context construction failed: %s', errorMessage(error));
                    return next();
                }
                let downstream;
                try {
                    downstream = await next();
                }
                catch (error) {
                    state.release(fingerprint.key);
                    throw error;
                }
                if (downstream.kind === 'block') {
                    state.release(fingerprint.key);
                    return downstream;
                }
                emitRecovery(Object.freeze({
                    version: 1,
                    recipeId: selected.recipe.id,
                    tool: exec.name,
                    rootCallId: String(exec.rootCallId),
                    nested: exec.callId !== exec.rootCallId,
                    fingerprint: fingerprint.key,
                    summary: decision.summary,
                }));
                return addContext(downstream, context);
            })();
        });
        return () => {
            lifetime.abort(new Error('dsh-autofix disposed'));
            state.clear();
            commandProbe.clear();
            dispatched.clear();
            disposeDispatch();
            disposeResult();
            disposeListener();
        };
    }, 'dsh-autofix/runtime');
}
/** Register one transparent post-result recovery listener. */
export function apply(ctx, config = {}) {
    applyRuntime(ctx, config);
}
/** Mount one explicit Recipe set for a custom DSH bundle or plugin integration. */
export function applyRecipes(ctx, recipes, config = {}) {
    const ids = new Set();
    const ordered = recipes.slice().sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
    for (const recipe of ordered) {
        if (recipe.id.trim().length === 0)
            throw new Error('AutoFix Recipe id cannot be empty');
        if (ids.has(recipe.id))
            throw new Error(`duplicate AutoFix Recipe id ${JSON.stringify(recipe.id)}`);
        ids.add(recipe.id);
    }
    applyRuntime(ctx, config, ordered);
}
//# sourceMappingURL=runtime.js.map