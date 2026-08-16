import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
function available(command, args) {
    const useShell = process.platform === 'win32' && !['.js', '.mjs', '.cjs'].includes(extname(command).toLowerCase());
    // These probes are fixed internal commands. Supplying a complete command
    // string avoids Node 24's unsafe "args + shell" path on Windows.
    const result = useShell
        ? spawnSync([command, ...args].join(' '), {
            encoding: 'utf8', timeout: 5_000, shell: true,
        })
        : spawnSync(command, args, { encoding: 'utf8', timeout: 5_000 });
    return result.status === 0;
}
export function resolveDshCommand(env = process.env) {
    const override = env.DSH_AUTOFIX_DSH_BIN;
    if (override !== undefined && override.length > 0) {
        return { command: override, prefix: [], source: 'environment' };
    }
    if (available('dsh', ['--help']))
        return { command: 'dsh', prefix: [], source: 'path' };
    if (available('npx', ['--version']))
        return { command: 'npx', prefix: ['-y', '@deepseek-ai/dsh'], source: 'npx' };
    throw new Error('DeepSeek Harness was not found on PATH and npx is unavailable');
}
export function resolveDshHome(env = process.env) {
    const configured = env.DSH_HOME?.trim();
    return configured ? resolve(configured) : resolve(homedir(), '.dsh');
}
/** Only existing built-in profiles are changed; no profile is created by discovery. */
export function discoverProfiles(dshHome) {
    const root = resolve(dshHome, 'profiles');
    if (!existsSync(root))
        return [];
    const names = new Set(readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name));
    return ['web', 'headless'].filter(name => names.has(name));
}
//# sourceMappingURL=discover.js.map