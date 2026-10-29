const ALLOWED_CATEGORIES = new Set(["us", "dates", "special-days", "videos"]);
const MAX_FILE_BYTES = 95 * 1024 * 1024;

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "").split(",").map(value => value.trim()).filter(Boolean);
    const headers = { Vary: "Origin", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
    if (allowed.includes("*") || allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = allowed.includes("*") ? "*" : origin;
    return headers;
}

function base64url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signToken(payload, secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
    return `${encodedPayload}.${base64url(new Uint8Array(signature))}`;
}

async function verifyToken(token, secret) {
    try {
        const [encodedPayload, encodedSignature] = token.split(".");
        if (!encodedPayload || !encodedSignature) return false;
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        const valid = await crypto.subtle.verify("HMAC", key, decodeBase64url(encodedSignature), new TextEncoder().encode(encodedPayload));
        if (!valid) return false;
        const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(encodedPayload)));
        return payload.role === "gallery-admin" && payload.exp > Math.floor(Date.now() / 1000);
    } catch (_) { return false; }
}

async function requireAdmin(request, env) {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    return Boolean(token && env.SESSION_SECRET && await verifyToken(token, env.SESSION_SECRET));
}

function publicUrl(request, key) {
    const root = new URL(request.url).origin;
    return `${root}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function route(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });

    if (pathname === "/api/admin/login" && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch (_) { return json({ error: "Envie a senha da galeria." }, 400); }
        if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Configure ADMIN_PASSWORD e SESSION_SECRET nos secrets do Worker." }, 503);
        const encoder = new TextEncoder();
        const given = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(body.password || ""))));
        const expected = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_PASSWORD)));
        let difference = 0;
        for (let index = 0; index < given.length; index++) difference |= given[index] ^ expected[index];
        if (difference !== 0) return json({ error: "Senha incorreta." }, 401);
        const token = await signToken({ role: "gallery-admin", exp: Math.floor(Date.now() / 1000) + 43200 }, env.SESSION_SECRET);
        return json({ token });
    }

    if (pathname === "/api/admin/session" && request.method === "GET") {
        return await requireAdmin(request, env) ? json({ ok: true }) : json({ error: "Sessão expirada. Entre novamente." }, 401);
    }

    if (pathname.startsWith("/media/") && (request.method === "GET" || request.method === "HEAD")) {
        const key = pathname.slice("/media/".length).split("/").map(part => decodeURIComponent(part)).join("/");
        if (!key.startsWith("memories/") || key.includes("..")) return json({ error: "Arquivo inválido." }, 400);
        const object = await env.MEDIA.get(key, { onlyIf: request.headers, range: request.headers });
        if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        if (object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
        return new Response(request.method === "HEAD" ? null : object.body, { status: object.range ? 206 : 200, headers });
    }

    if (pathname === "/api/memories" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT id, title, subtitle, category, media_type, file_key, created_at FROM memories ORDER BY created_at ASC").all();
        return json({ memories: results.map(row => ({ ...row, url: publicUrl(request, row.file_key) })) });
    }

    if (pathname === "/api/memories" && request.method === "POST") {
        if (!await requireAdmin(request, env)) return json({ error: "Entre na administração da galeria para enviar arquivos." }, 401);
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (!request.body || !contentLength) return json({ error: "Envie o arquivo selecionado." }, 400);
        if (contentLength > MAX_FILE_BYTES) return json({ error: "O arquivo pode ter no máximo 95 MB." }, 413);
        const title = String(url.searchParams.get("title") || "").trim().slice(0, 100);
        const subtitle = String(url.searchParams.get("subtitle") || "").trim().slice(0, 300);
        const filename = String(url.searchParams.get("filename") || "upload");
        const category = String(url.searchParams.get("category") || "us");
        const contentType = request.headers.get("Content-Type") || "";
        if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) return json({ error: "Envie uma imagem ou vídeo válido." }, 415);
        if (!ALLOWED_CATEGORIES.has(category)) return json({ error: "Categoria inválida." }, 400);
        const id = crypto.randomUUID();
        const mediaType = contentType.startsWith("video/") ? "video" : "image";
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "upload";
        const fileKey = `memories/${id}/${safeName}`;
        const createdAt = new Date().toISOString();
        await env.MEDIA.put(fileKey, request.body, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
        try {
            await env.DB.prepare("INSERT INTO memories (id, title, subtitle, category, media_type, file_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(id, title, subtitle, category, mediaType, fileKey, createdAt).run();
        } catch (error) {
            await env.MEDIA.delete(fileKey);
            console.error("D1 insert failed after R2 upload", error);
            return json({ error: "O arquivo chegou ao R2, mas o registro da galeria não foi salvo." }, 500);
        }
        const memory = { id, title, subtitle, category, media_type: mediaType, file_key: fileKey, created_at: createdAt, url: publicUrl(request, fileKey) };
        return json({ memory }, 201);
    }

    const match = pathname.match(/^\/api\/memories\/([0-9a-f-]+)$/i);
    if (match && request.method === "DELETE") {
        if (!await requireAdmin(request, env)) return json({ error: "Entre novamente na administração da galeria." }, 401);
        const id = match[1];
        const row = await env.DB.prepare("SELECT file_key FROM memories WHERE id = ?").bind(id).first();
        if (!row) return json({ error: "Essa lembrança não existe mais." }, 404);
        await env.MEDIA.delete(row.file_key);
        await env.DB.prepare("DELETE FROM memories WHERE id = ?").bind(id).run();
        return json({ ok: true });
    }

    return json({ error: "Rota não encontrada." }, 404);
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        try {
            const response = await route(request, env);
            const headers = new Headers(response.headers);
            for (const [key, value] of Object.entries(cors)) headers.set(key, value);
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        } catch (error) {
            console.error("Cloudflare media Worker error", error);
            return json({ error: "Falha interna no serviço de mídia." }, 500, cors);
        }
    }
};
