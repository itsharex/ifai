
export function parsePartialJson(jsonStr: string): Record<string, any> {
    const result: Record<string, any> = {};

    const extractString = (key: string) => {
        // Simple search for "key"
        const keyIdx = jsonStr.indexOf(`"${key}"`);
        if (keyIdx === -1) return undefined;

        // Find the colon :
        let colonIdx = jsonStr.indexOf(':', keyIdx);
        if (colonIdx === -1) return undefined;

        // Find the opening quote "
        let startQuoteIdx = jsonStr.indexOf('"', colonIdx + 1);
        if (startQuoteIdx === -1) return undefined;

        // Scan for value
        let value = "";
        let isEscaped = false;
        
        for (let i = startQuoteIdx + 1; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            
            if (isEscaped) {
                // Simple unescape map for common JSON escapes
                switch (char) {
                    case '"': value += '"'; break;
                    case '\\': value += '\\'; break;
                    case '/': value += '/'; break;
                    case 'b': value += '\b'; break;
                    case 'f': value += '\f'; break;
                    case 'n': value += '\n'; break;
                    case 'r': value += '\r'; break;
                    case 't': value += '\t'; break;
                    default: value += char; // Handle others loosely
                }
                isEscaped = false;
            } else {
                if (char === '\\') {
                    isEscaped = true;
                } else if (char === '"') {
                    // End of string found
                    break; 
                } else {
                    value += char;
                }
            }
        }
        
        return value;
    };

    const relPath = extractString("rel_path");
    if (relPath !== undefined) result.rel_path = relPath;

    const content = extractString("content");
    if (content !== undefined) result.content = content;

    return result;
}
