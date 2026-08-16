/** Obtain bounded failure text without serializing unrelated result fields. */
export function failureText(result, maximum = 4_000) {
    const blocks = result.content
        .filter((block) => block.type === 'text')
        .map(block => block.text);
    return [result.error.message, ...blocks]
        .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
        .join('\n')
        .slice(0, maximum);
}
/** Deterministic JSON used only on failed calls when forming a fingerprint. */
export function stableStringify(value) {
    const seen = new Set();
    const visit = (candidate) => {
        if (candidate === null)
            return 'null';
        switch (typeof candidate) {
            case 'string': return JSON.stringify(candidate);
            case 'number': return Number.isFinite(candidate) ? String(candidate) : JSON.stringify(String(candidate));
            case 'boolean': return String(candidate);
            case 'undefined': return '"<undefined>"';
            case 'bigint': return JSON.stringify(`<bigint:${candidate}>`);
            case 'symbol': return JSON.stringify(`<symbol:${candidate.description ?? ''}>`);
            case 'function': return '"<function>"';
            case 'object': break;
        }
        if (seen.has(candidate))
            return '"<circular>"';
        seen.add(candidate);
        try {
            if (Array.isArray(candidate))
                return `[${candidate.map(visit).join(',')}]`;
            const record = candidate;
            return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${visit(record[key])}`).join(',')}}`;
        }
        finally {
            seen.delete(candidate);
        }
    };
    return visit(value);
}
export function boundText(value, maximum) {
    if (value.length <= maximum)
        return value;
    if (maximum <= 1)
        return value.slice(0, maximum);
    return `${value.slice(0, maximum - 1)}…`;
}
//# sourceMappingURL=text.js.map