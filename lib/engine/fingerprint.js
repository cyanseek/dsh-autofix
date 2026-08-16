import { createHash } from 'node:crypto';
import { stableStringify } from './text.js';
let nextAnonymousAgent = 1;
const anonymousAgents = new WeakMap();
function agentIdentity(agent) {
    if (typeof agent !== 'object' || agent === null)
        return 'direct';
    const record = agent;
    const session = record.session;
    if (typeof session === 'object' && session !== null) {
        const header = session.header;
        if (typeof header === 'object' && header !== null) {
            const id = header.id;
            if (typeof id === 'string' || typeof id === 'number')
                return `session:${id}`;
        }
    }
    const existing = anonymousAgents.get(agent);
    if (existing !== undefined)
        return `agent:${existing}`;
    const assigned = nextAnonymousAgent++;
    anonymousAgents.set(agent, assigned);
    return `agent:${assigned}`;
}
/** Stable identity used for success cleanup without inspecting tool arguments. */
export function executionScope(exec) {
    return agentIdentity(exec.agent);
}
export function recoveryFingerprint(exec, recipeId, normalizedFailure) {
    const scope = executionScope(exec);
    const material = [scope, exec.name, stableStringify(exec.arguments), recipeId, normalizedFailure].join('\u0000');
    return {
        scope,
        key: createHash('sha256').update(material).digest('hex').slice(0, 24),
    };
}
//# sourceMappingURL=fingerprint.js.map