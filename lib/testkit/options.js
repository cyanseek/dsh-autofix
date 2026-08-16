function assertSafeInteger(name, value, minimum) {
    if (!Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`dsh-tool-chaos: ${name} must be a safe integer >= ${minimum}`);
    }
}
/** Validate direct calls as strictly as Loader-resolved configuration. */
export function resolveConfig(input = {}) {
    const enabled = input.enabled ?? false;
    const dryRun = input.dryRun ?? true;
    const seed = input.seed ?? 'dsh-tool-chaos';
    const allowGlobalWildcard = input.allowGlobalWildcard ?? false;
    if (typeof enabled !== 'boolean')
        throw new Error('dsh-tool-chaos: enabled must be a boolean');
    if (typeof dryRun !== 'boolean')
        throw new Error('dsh-tool-chaos: dryRun must be a boolean');
    if (typeof allowGlobalWildcard !== 'boolean') {
        throw new Error('dsh-tool-chaos: allowGlobalWildcard must be a boolean');
    }
    if (typeof seed !== 'string')
        throw new Error('dsh-tool-chaos: seed must be a string');
    if (seed.length === 0 || seed.length > 256) {
        throw new Error('dsh-tool-chaos: seed must contain 1..256 characters');
    }
    if (input.rules !== undefined && !Array.isArray(input.rules)) {
        throw new Error('dsh-tool-chaos: rules must be an array');
    }
    const ids = new Set();
    const rules = (input.rules ?? []).map((rule, index) => {
        const label = `rules[${index}]`;
        if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
            throw new Error(`dsh-tool-chaos: ${label} must be an object`);
        }
        if (!['deny', 'error', 'delay', 'abort', 'block'].includes(rule.action)) {
            throw new Error(`dsh-tool-chaos: ${label}.action is invalid`);
        }
        if (rule.scope !== undefined && !['all', 'root', 'nested'].includes(rule.scope)) {
            throw new Error(`dsh-tool-chaos: ${label}.scope is invalid`);
        }
        if (typeof rule.id !== 'string')
            throw new Error(`dsh-tool-chaos: ${label}.id must be a string`);
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(rule.id)) {
            throw new Error(`dsh-tool-chaos: ${label}.id must match ^[A-Za-z0-9._-]{1,64}$`);
        }
        if (ids.has(rule.id))
            throw new Error(`dsh-tool-chaos: duplicate rule id "${rule.id}"`);
        ids.add(rule.id);
        if (typeof rule.tool !== 'string')
            throw new Error(`dsh-tool-chaos: ${label}.tool must be a string`);
        if (rule.tool.length === 0 || rule.tool.length > 256) {
            throw new Error(`dsh-tool-chaos: ${label}.tool must contain 1..256 characters`);
        }
        if (rule.tool === '*' && !allowGlobalWildcard) {
            throw new Error('dsh-tool-chaos: an exact `*` tool glob requires allowGlobalWildcard: true');
        }
        const probability = rule.probability ?? 1;
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new Error(`dsh-tool-chaos: ${label}.probability must be between 0 and 1`);
        }
        const afterMatches = rule.afterMatches ?? 0;
        const every = rule.every ?? 1;
        const maxInjections = rule.maxInjections ?? 1;
        const delayMs = rule.delayMs ?? 1_000;
        assertSafeInteger(`${label}.afterMatches`, afterMatches, 0);
        assertSafeInteger(`${label}.every`, every, 1);
        assertSafeInteger(`${label}.maxInjections`, maxInjections, 1);
        assertSafeInteger(`${label}.delayMs`, delayMs, 1);
        const argumentsPattern = rule.argumentsPattern ?? '';
        if (typeof argumentsPattern !== 'string') {
            throw new Error(`dsh-tool-chaos: ${label}.argumentsPattern must be a string`);
        }
        if (argumentsPattern.length > 1_024) {
            throw new Error(`dsh-tool-chaos: ${label}.argumentsPattern exceeds 1024 characters`);
        }
        if (argumentsPattern !== '') {
            try {
                new RegExp(argumentsPattern);
            }
            catch (error) {
                throw new Error(`dsh-tool-chaos: ${label}.argumentsPattern is invalid: ${String(error)}`);
            }
        }
        const message = rule.message ?? '';
        if (typeof message !== 'string')
            throw new Error(`dsh-tool-chaos: ${label}.message must be a string`);
        if (message.length > 1_024) {
            throw new Error(`dsh-tool-chaos: ${label}.message exceeds 1024 characters`);
        }
        return {
            id: rule.id,
            tool: rule.tool,
            action: rule.action,
            scope: rule.scope ?? 'all',
            argumentsPattern,
            probability,
            afterMatches,
            every,
            maxInjections,
            delayMs,
            message,
        };
    });
    return { enabled, dryRun, seed, allowGlobalWildcard, rules };
}
//# sourceMappingURL=options.js.map