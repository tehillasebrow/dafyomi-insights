// scripts/import/lib/protobuf.mjs
// Minimal protobuf reader for Issuu's binary layers. There is no schema, so it
// returns raw fields; issuu.mjs knows what each field number means.

function varint(buf, pos) {
    let result = 0
    let shift = 0
    let byte
    do {
        if (pos >= buf.length) throw new Error('Truncated varint')
        byte = buf[pos++]
        result += (byte & 0x7f) * 2 ** shift
        shift += 7
    } while (byte & 0x80)
    return [result, pos]
}

// [{ field, value }]: value is a number for varint/fixed fields, a Buffer for
// length-delimited ones (strings, bytes and nested messages alike).
export function decode(buf) {
    const fields = []
    let pos = 0
    while (pos < buf.length) {
        let key
        ;[key, pos] = varint(buf, pos)
        const field = Math.floor(key / 8)
        const wire = key & 7
        let value
        if (wire === 0) {
            ;[value, pos] = varint(buf, pos)
        } else if (wire === 1) {
            value = buf.readDoubleLE(pos)
            pos += 8
        } else if (wire === 5) {
            value = buf.readFloatLE(pos)
            pos += 4
        } else if (wire === 2) {
            let length
            ;[length, pos] = varint(buf, pos)
            value = buf.subarray(pos, pos + length)
            pos += length
        } else {
            throw new Error(`Unsupported wire type ${wire}`)
        }
        fields.push({ field, value })
    }
    return fields
}

export function first(fields, n) {
    return fields.find(f => f.field === n)?.value
}

export function all(fields, n) {
    return fields.filter(f => f.field === n).map(f => f.value)
}

export function floats(buf) {
    const out = []
    for (let i = 0; i + 4 <= buf.length; i += 4) out.push(buf.readFloatLE(i))
    return out
}
