import { constants, accessSync, statSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import process from 'node:process';
function defaultFileExists(path, executable) {
    try {
        accessSync(path, executable ? constants.X_OK : constants.F_OK);
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
export function createCommandProbe(options) {
    const platform = options.platform ?? process.platform;
    const path = options.path ?? process.env.PATH ?? '';
    const pathExt = options.pathExt ?? process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
    const now = options.now ?? Date.now;
    const fileExists = options.fileExists ?? defaultFileExists;
    const cache = new Map();
    const scan = (command) => {
        const windows = platform === 'win32';
        const pathApi = windows ? win32 : posix;
        const executable = !windows;
        const suffixes = windows
            ? ['', ...pathExt.split(';').filter(Boolean).map(value => value.toLowerCase())]
            : [''];
        const direct = pathApi.isAbsolute(command) || command.includes('/') || command.includes('\\');
        const pathDelimiter = platform === 'win32' ? ';' : ':';
        const directories = direct ? [''] : path.split(pathDelimiter).filter(Boolean);
        for (const directory of directories) {
            for (const suffix of suffixes) {
                const candidate = direct ? `${command}${suffix}` : pathApi.join(directory, `${command}${suffix}`);
                if (fileExists(candidate, executable))
                    return true;
            }
        }
        return false;
    };
    const exists = async (command, signal) => {
        if (signal.aborted)
            return false;
        const key = `${platform}\u0000${path}\u0000${command.toLowerCase()}`;
        const cached = cache.get(key);
        const timestamp = now();
        if (cached !== undefined && cached.expiresAt > timestamp)
            return cached.available;
        let available;
        if (command === 'Select-String')
            available = platform === 'win32' && (scan('pwsh') || scan('powershell'));
        else if (command === 'start')
            available = platform === 'win32' && (scan('cmd') || scan('cmd.exe'));
        else
            available = scan(command);
        if (signal.aborted)
            return false;
        cache.set(key, { available, expiresAt: timestamp + options.ttlMs });
        return available;
    };
    return { exists, clear: () => cache.clear() };
}
//# sourceMappingURL=command-probe.js.map