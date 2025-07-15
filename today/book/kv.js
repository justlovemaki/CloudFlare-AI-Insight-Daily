// src/kv.js

export async function storeInKV(kvNamespace, key, value, expirationTtl = 86400 * 7) { // 7 days default
    console.log(`Storing data in KV with key: ${key}`);
    await kvNamespace.put(key, JSON.stringify(value), { expirationTtl });
}

export async function getFromKV(kvNamespace, key) {
    console.log(`Retrieving data from KV with key: ${key}`);
    const value = await kvNamespace.get(key);
    return value ? JSON.parse(value) : null;
}