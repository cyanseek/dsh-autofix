import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { discoverProfiles, resolveDshCommand, resolveDshHome } from './discover.js';
function spawn(command, args, env) {
    const extension = extname(command.command).toLowerCase();
    const nodeScript = ['.js', '.mjs', '.cjs'].includes(extension);
    if (process.platform === 'win32' && !nodeScript) {
        const values = [command.command, ...command.prefix, ...args];
        for (const value of values) {
            if (/[\r\n"%]/u.test(value)) {
                throw new Error('the Windows dsh command and its arguments cannot contain quotes, percent signs, or newlines');
            }
        }
        const commandLine = values.map(value => `"${value}"`).join(' ');
        return spawnSync(env.ComSpec || 'cmd.exe', ['/d', '/v:off', '/s', '/c', `"${commandLine}"`], {
            encoding: 'utf8',
            timeout: 120_000,
            maxBuffer: 16 * 1024 * 1024,
            env,
            windowsVerbatimArguments: true,
        });
    }
    return spawnSync(nodeScript ? process.execPath : command.command, nodeScript ? [command.command, ...command.prefix, ...args] : [...command.prefix, ...args], {
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        env,
    });
}
function runDsh(command, args, env) {
    const result = spawn(command, args, env);
    if (result.error !== undefined)
        throw result.error;
    if (result.status !== 0) {
        const detail = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim().slice(0, 2_000);
        throw new Error(`dsh ${args.join(' ')} failed (${result.status ?? 1})${detail ? `: ${detail}` : ''}`);
    }
    return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}
function configHasAutoFix(text) {
    const start = /(?:^|\n)([ \t]*)-\s*id:\s*autofix\s*(?:\r?\n|$)/m.exec(text);
    if (start === null)
        return false;
    const rowStart = start.index + (text[start.index] === '\n' ? 1 : 0);
    const tail = text.slice(rowStart + start[0].trimStart().length);
    const nextRow = /(?:^|\n)[ \t]*-\s*id:\s*/m.exec(tail);
    const row = text.slice(rowStart, nextRow === null ? text.length : rowStart + start[0].trimStart().length + nextRow.index);
    return /(?:^|\n)[ \t]+name:\s*dsh-autofix\s*(?:\r?\n|$)/m.test(row)
        && !/(?:^|\n)[ \t]+disabled:\s*true\s*(?:\r?\n|$)/m.test(row);
}
function profileStatus(command, profile, env) {
    const dump = runDsh(command, ['--profile', profile, '--dump-config'], env);
    const verified = configHasAutoFix(dump);
    return { profile, installed: verified, verified, changed: false };
}
function installedVersion(dshHome, profile) {
    const manifest = join(dshHome, 'profiles', profile, 'node_modules', 'dsh-autofix', 'package.json');
    if (!existsSync(manifest))
        return undefined;
    const value = JSON.parse(readFileSync(manifest, 'utf8'));
    return value.version;
}
function packageLoadSmoke(packageRoot) {
    const target = resolve(packageRoot, 'lib/index.js');
    if (!existsSync(target))
        return false;
    const result = spawnSync(process.execPath, [
        '--input-type=module',
        '--eval',
        `await import(${JSON.stringify(pathToFileURL(target).href)})`,
    ], { encoding: 'utf8', timeout: 10_000 });
    return result.status === 0;
}
function digest(path) {
    if (!existsSync(path))
        return undefined;
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function installSkill(packageRoot, destination) {
    const source = resolve(packageRoot, 'skills/dsh-autofix');
    const sourceSkill = resolve(source, 'SKILL.md');
    if (!existsSync(sourceSkill))
        throw new Error('bundled dsh-autofix Skill is missing');
    const destinationSkill = resolve(destination, 'SKILL.md');
    if (digest(sourceSkill) === digest(destinationSkill))
        return false;
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true, force: true });
    return true;
}
function skillDestinations(dshHome, env) {
    const agentsHome = resolve(env.DSH_AGENTS_HOME?.trim() || join(homedir(), '.agents'));
    const candidates = [
        resolve(dshHome, 'skills/dsh-autofix'),
        resolve(agentsHome, 'skills/dsh-autofix'),
    ];
    return [...new Set(candidates)];
}
export function install(options) {
    const env = { ...process.env, ...options.env };
    const command = resolveDshCommand(env);
    const dshHome = resolveDshHome(env);
    const profiles = discoverProfiles(dshHome);
    if (profiles.length === 0) {
        throw new Error('no existing web or headless profile was found; start the DSH client once, then retry this command');
    }
    // Install the artifact actually running this command, including GitHub/tarball
    // consumers. A matching npm release does not necessarily exist.
    const source = env.DSH_AUTOFIX_SOURCE?.trim() || `file:${resolve(options.packageRoot)}`;
    const statuses = [];
    for (const profile of profiles) {
        const before = profileStatus(command, profile, env);
        if (before.installed && installedVersion(dshHome, profile) === options.version) {
            statuses.push(before);
            continue;
        }
        runDsh(command, ['plugin', '--profile', profile, 'add', source], env);
        const after = profileStatus(command, profile, env);
        if (!after.verified)
            throw new Error(`dsh-autofix was added to ${profile}, but its effective config could not be verified`);
        if (installedVersion(dshHome, profile) !== options.version) {
            throw new Error(`dsh-autofix in ${profile} does not match installer version ${options.version}`);
        }
        statuses.push({ ...after, changed: true });
    }
    const destinations = skillDestinations(dshHome, env);
    const skillChanged = destinations.map(destination => installSkill(options.packageRoot, destination));
    const load = packageLoadSmoke(options.packageRoot);
    if (!load)
        throw new Error('the prebuilt dsh-autofix runtime failed its package load smoke test');
    return {
        tool: 'dsh-autofix',
        version: options.version,
        dshSource: command.source,
        dshHome,
        source,
        profiles: statuses,
        skillDestinations: destinations,
        packageLoad: load,
        changed: statuses.some(item => item.changed) || skillChanged.some(Boolean),
        safeToRetry: true,
    };
}
export function uninstall(options) {
    const env = { ...process.env, ...options.env };
    const command = resolveDshCommand(env);
    const dshHome = resolveDshHome(env);
    const profiles = discoverProfiles(dshHome);
    const statuses = [];
    for (const profile of profiles) {
        const before = profileStatus(command, profile, env);
        if (!before.installed) {
            statuses.push(before);
            continue;
        }
        runDsh(command, ['plugin', '--profile', profile, 'remove', 'dsh-autofix'], env);
        const after = profileStatus(command, profile, env);
        if (after.installed)
            throw new Error(`dsh-autofix remains active in ${profile} after removal`);
        statuses.push({ ...after, changed: true });
    }
    const destinations = skillDestinations(dshHome, env);
    const removedSkills = destinations.map(destination => {
        const existed = existsSync(destination);
        rmSync(destination, { recursive: true, force: true });
        return existed;
    });
    return {
        tool: 'dsh-autofix', version: options.version, dshSource: command.source, dshHome,
        source: 'dsh-autofix', profiles: statuses, skillDestinations: destinations,
        packageLoad: packageLoadSmoke(options.packageRoot),
        changed: statuses.some(item => item.changed) || removedSkills.some(Boolean),
        safeToRetry: true,
    };
}
function nodeSupported() {
    const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
    return major >= 24 || (major === 22 && minor >= 19);
}
export function verify(options) {
    const env = { ...process.env, ...options.env };
    const artifacts = {
        runtime: existsSync(resolve(options.packageRoot, 'lib/index.js')),
        recipes: existsSync(resolve(options.packageRoot, 'lib/recipes/index.js')),
        testkit: existsSync(resolve(options.packageRoot, 'lib/testkit/index.js')),
        cli: existsSync(resolve(options.packageRoot, 'bin/dsh-autofix.mjs')),
        bundle: existsSync(resolve(options.packageRoot, 'cordis.patch.yml')),
        skill: existsSync(resolve(options.packageRoot, 'skills/dsh-autofix/SKILL.md')),
        catalog: existsSync(resolve(options.packageRoot, 'recipes/catalog.json')),
        readmeEnglish: existsSync(resolve(options.packageRoot, 'README.md')),
        readmeChinese: existsSync(resolve(options.packageRoot, 'README.zh-CN.md')),
        license: existsSync(resolve(options.packageRoot, 'LICENSE')),
    };
    const load = packageLoadSmoke(options.packageRoot);
    let dsh;
    try {
        const command = resolveDshCommand(env);
        const home = resolveDshHome(env);
        const profiles = discoverProfiles(home).map(profile => profileStatus(command, profile, env));
        dsh = { source: command.source, home, profiles };
    }
    catch {
        dsh = undefined;
    }
    return {
        tool: 'dsh-autofix', version: options.version,
        node: { version: process.versions.node, supported: nodeSupported() },
        artifacts, packageLoad: load,
        ...(dsh === undefined ? {} : { dsh }),
        publishReady: nodeSupported() && load && Object.values(artifacts).every(Boolean),
    };
}
//# sourceMappingURL=operations.js.map