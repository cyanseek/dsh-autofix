import { failureText } from '../engine/text.js';
/** Versioned local catalog. Entries only describe next actions; they mutate no profile or session. */
export const DSH_ERROR_ATLAS_VERSION = 1;
export const DSH_ERROR_ATLAS = Object.freeze([
    {
        id: 'DSH_TOOLS_RUNTIME_DUPLICATE',
        signature: /Cannot read properties of undefined \(reading ['"]prepare['"]\)/i,
        summary: 'A second physical @deepseek-ai/dsh-tools runtime may be loaded.',
        next: ['Inspect the active profile dependency graph.', 'Locate the plugin that introduced the duplicate runtime.', 'Use the existing DSH diagnostics workflow to reconcile dependencies and verify the profile.'],
    },
    {
        id: 'DSH_PLUGIN_BUILD_IGNORED',
        signature: /ERR_PNPM_IGNORED_BUILDS/i,
        summary: 'The plugin dependency build was blocked by the package manager.',
        next: ['Inspect the exact ignored package and the active profile package manager policy.', 'Prefer a prebuilt dsh-autofix tarball or published artifact.', 'Re-run profile verification after the artifact is available.'],
    },
    {
        id: 'DSH_SESSION_EVENT_INCOMPATIBLE',
        signature: /unknown event type .* not marked ignorable/i,
        summary: 'Session history contains an event unsupported by this DSH version.',
        next: ['Record the DSH version and the unknown event type.', 'Use the existing session/history compatibility diagnostics.', 'Do not edit session history in place; continue in a compatible session if available.'],
    },
    {
        id: 'DSH_SESSION_HISTORY_UNAVAILABLE',
        signature: /history unavailable for session/i,
        summary: 'The requested session history is unavailable.',
        next: ['Check whether the session store and requested session id belong to the active profile.', 'Use the existing session recovery workflow.', 'Continue from the current task context when the missing history is not required.'],
    },
    {
        id: 'DSH_PLUGIN_INJECT_MISSING',
        signature: /cannot get property ['"][^'"]+['"] without inject/i,
        summary: 'A plugin accessed a Cordis service without declaring its injection.',
        next: ['Identify the service named in the error and the plugin that reads it.', 'Add or correct the plugin inject declaration in that plugin source.', 'Rebuild the plugin artifact and verify its load in the active profile.'],
    },
    {
        id: 'DSH_PLUGIN_BUNDLE_MISSING',
        signature: /declares no dsh\.bundle/i,
        summary: 'The package has no DSH bundle declaration.',
        next: ['Inspect package.json for the dsh.bundle entry.', 'Confirm the referenced patch is included in the installed artifact.', 'Use the existing plugin installation diagnostics to verify the package.'],
    },
    {
        id: 'DSH_PLUGIN_BUILD_MISSING',
        signature: /missing (?:lib )?build artifact/i,
        summary: 'The installed plugin artifact is missing its prebuilt runtime.',
        next: ['Inspect the package contents for lib/.', 'Install a prebuilt npm or release artifact instead of a source-only dependency.', 'Verify plugin loading again.'],
    },
    {
        id: 'DSH_PROFILE_MISMATCH',
        signature: /web\/headless profile mismatch/i,
        summary: 'The plugin is installed in a different built-in profile than the active client.',
        next: ['Identify whether the active client uses web or headless.', 'Run dsh-autofix verify to compare existing built-in profiles.', 'Install only into the existing active profiles; do not rewrite session data.'],
    },
    {
        id: 'DSH_CLIENT_SLOT_MISSING',
        signature: /client slot missing/i,
        summary: 'The active profile has no client slot required by that operation.',
        next: ['Confirm which client the profile is expected to expose.', 'Use the existing DSH profile diagnostics.', 'Continue through an already configured client when possible.'],
    },
]);
export const dshErrorAtlasRecipe = {
    id: 'dsh-error-atlas',
    priority: 100,
    match(input) {
        const text = failureText(input.result);
        const entry = DSH_ERROR_ATLAS.find(candidate => candidate.signature.test(text));
        return entry === undefined ? undefined : { fingerprint: entry.id, entry };
    },
    async recover(input, match) {
        if (input.signal.aborted)
            return undefined;
        const payload = {
            id: match.entry.id,
            summary: match.entry.summary,
            next: match.entry.next,
        };
        return {
            summary: match.entry.summary,
            text: `AutoFix matched DSH Error Atlas v${DSH_ERROR_ATLAS_VERSION}. Continue diagnosis now without asking the user to copy the error.\n${JSON.stringify(payload, null, 2)}`,
        };
    },
};
//# sourceMappingURL=dsh-error-atlas.js.map