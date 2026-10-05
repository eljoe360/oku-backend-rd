const express = require('express');
const axios = require('axios');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.disable('x-powered-by');


// ============================================================
// CONFIGURACIÓN
// ============================================================

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

let SECRET = process.env.PROXY_SECRET;

if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');

    console.warn(
        '[AVISO] PROXY_SECRET no definido. Se generó uno temporal.'
    );
}


// ============================================================
// HOSTS TLS
// ============================================================

const INSECURE_TLS_HOSTS = (
    process.env.INSECURE_TLS_HOSTS ||
    'live2.telemicro.com.do,' +
    'live4.telemicro.com.do,' +
    'ss2.tvrdomi.com,' +
    'edge.livestreaminggroup.info,' +
    '2-fss-2.streamhoster.com,' +
    'live.eu-north-1a.cf.dmcdn.net,' +
    'dmxleo.dailymotion.com,' +
    '*.dailymotion.com,' +
    '*.dmcdn.net'
)
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);


const agenteSeguro = new https.Agent({
    keepAlive: true,
    maxSockets: 100
});


const agenteInseguro = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: 50
});


const agenteHttp = new http.Agent({
    keepAlive: true,
    maxSockets: 100
});


function agenteParaUrl(urlStr) {
    try {
        const u = new URL(urlStr);

        if (u.protocol === 'http:') {
            return agenteHttp;
        }

        const hostLower = u.hostname.toLowerCase();
        const esInseguro = INSECURE_TLS_HOSTS.some(h => {
            if (h.startsWith('*.')) {
                return hostLower.endsWith(h.slice(1));
            }
            return hostLower === h;
        });

        return esInseguro ? agenteInseguro : agenteSeguro;

    } catch {
        return agenteSeguro;
    }
}


// ============================================================
// FUENTES
// ============================================================

const CANALES_JSON =
    process.env.CANALES_JSON ||
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';


const SPORTS_M3U_URL =
    process.env.SPORTS_M3U_URL ||
    'https://iptv-org.github.io/iptv/categories/sports.m3u';


const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/122.0.0.0 Safari/537.36';


// ============================================================
// DAILY MOTION IDs (Dinámicos para evitar caducidad)
// ============================================================

const CANAL6_STREAM_URL =
    process.env.CANAL6_STREAM_URL ||
    'https://stream.elseis.do/canal6/master.m3u8';

const CANAL7_STREAM_URL =
    process.env.CANAL7_STREAM_URL ||
    'https://hls.tvabierta.net/hls/007.m3u8';

const CANAL8_STREAM_URL =
    process.env.CANAL8_STREAM_URL ||
    'http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8';

// Canal 9 -> Dailymotion (Dinámico)
const CANAL9_VIDEO_ID = process.env.CANAL9_VIDEO_ID || 'x7gy059';

const CANAL10_STREAM_URL =
    process.env.CANAL10_STREAM_URL ||
    'https://hls.tvabierta.net/hls/010.m3u8';

// Canal 11 -> Dailymotion (Dinámico)
const CANAL11_VIDEO_ID = process.env.CANAL11_VIDEO_ID || 'x80ac48';

// Canal 12 -> Dailymotion (Dinámico)
const CANAL12_VIDEO_ID = process.env.CANAL12_VIDEO_ID || 'xaio352';

const CANAL13_STREAM_URL =
    process.env.CANAL13_STREAM_URL ||
    'https://live2.telemicro.com.do/live/telecentrocast_1080p/chunks.m3u8';

const CANAL15_STREAM_URL =
    process.env.CANAL15_STREAM_URL ||
    'https://live4.telemicro.com.do/live/digital15cast_1080p/chunks.m3u8';

const CANAL18_STREAM_URL =
    process.env.CANAL18_STREAM_URL ||
    'https://ss2.tvrdomi.com:1936/ame47/ame47/playlist.m3u8';

const CANAL19_STREAM_URL =
    process.env.CANAL19_STREAM_URL ||
    'https://5790d294af2dc.streamlock.net/tvhdlive/tvhdlive/playlist.m3u8';

const CANAL21_STREAM_URL =
    process.env.CANAL21_STREAM_URL ||
    'https://hls.tvabierta.net/hls/021.m3u8';

// Canal 23 -> Dailymotion (Dinámico)
const CANAL23_VIDEO_ID = process.env.CANAL23_VIDEO_ID || 'x9imtbq';

const CANAL27_STREAM_URL =
    process.env.CANAL27_STREAM_URL ||
    'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/playlist.m3u8';

const CANAL32_STREAM_URL =
    process.env.CANAL32_STREAM_URL ||
    'https://edge.livestreaminggroup.info/vtv32live/index.m3u8';

const CANAL33_STREAM_URL =
    process.env.CANAL33_STREAM_URL ||
    'https://cnn.hostlagarto.com/supercanalhd/playlist.m3u8';

// Canal 36 -> Dailymotion (Dinámico)
const CANAL36_VIDEO_ID = process.env.CANAL36_VIDEO_ID || 'xar1qcu';

// Canal 37 -> Dailymotion (Dinámico)
const CANAL37_VIDEO_ID = process.env.CANAL37_VIDEO_ID || 'x9lincs';

const CANAL63_STREAM_URL =
    process.env.CANAL63_STREAM_URL ||
    'https://ss2.tvrdomi.com:1936/digitalvision/digitalvision/playlist.m3u8';


// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});


// ============================================================
// RATE LIMIT
// ============================================================

const rateMap = new Map();

function rateLimit(req, res, next) {
    const ip =
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        'unknown';

    const ahora = Date.now();
    const datos = rateMap.get(ip);

    if (!datos || ahora - datos.time > 60000) {
        rateMap.set(ip, {
            count: 1,
            time: ahora
        });
        return next();
    }

    datos.count++;

    if (datos.count > 300) {
        return res.status(429).send('Demasiadas solicitudes');
    }

    next();
}

app.use(rateLimit);


// ============================================================
// FIRMAS
// ============================================================

function crearFirma(url, ref = '') {
    return crypto
        .createHmac('sha256', SECRET)
        .update(`${url}|${ref}`)
        .digest('hex');
}


function comprobarFirma(url, ref, sig) {
    if (!url || !sig) {
        return false;
    }

    const esperada = crearFirma(url, ref);

    try {
        return crypto.timingSafeEqual(
            Buffer.from(esperada),
            Buffer.from(sig)
        );
    } catch {
        return false;
    }
}


// ============================================================
// COMPROBAR M3U8
// ============================================================

function esM3U8(url) {
    return (
        typeof url === 'string' &&
        url &&
        (
            url.includes('.m3u8') ||
            url.includes('/manifest/')
        )
    );
}


async function comprobarM3U8(streamUrl, videoId = '') {
    if (!esM3U8(streamUrl)) {
        return false;
    }

    try {
        const respuesta = await axios.get(streamUrl, {
            httpAgent: agenteParaUrl(streamUrl),
            httpsAgent: agenteParaUrl(streamUrl),
            timeout: 7000,
            responseType: 'text',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': videoId ? `https://www.dailymotion.com/video/${videoId}` : undefined
            },
            validateStatus: status => status >= 200 && status < 400
        });

        const contenido = String(respuesta.data || '');
        return contenido.includes('#EXTM3U');

    } catch (e) {
        console.warn('[M3U8] Error verificando:', e.message);
        return false;
    }
}


// ============================================================
// CACHE DAILY MOTION
// ============================================================

const DM_CACHE_MS = 30 * 1000;
const dmCache = new Map();

function guardarDailymotionCache(videoId, url) {
    dmCache.set(`dm_${videoId}`, {
        url,
        expires: Date.now() + DM_CACHE_MS
    });
}


function obtenerDailymotionCache(videoId) {
    const dato = dmCache.get(`dm_${videoId}`);

    if (!dato) {
        return null;
    }

    if (Date.now() > dato.expires) {
        dmCache.delete(`dm_${videoId}`);
        return null;
    }

    return dato.url;
}


// ============================================================
// EXTRAER DAILY MOTION
// ============================================================

async function extraerStreamDailymotion(videoId) {
    const cache = obtenerDailymotionCache(videoId);

    if (cache) {
        return cache;
    }

    // 1. METADATA
    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `https://www.dailymotion.com/video/${videoId}`,
                'Accept': 'application/json,text/plain,*/*'
            }
        });

        const data = respuesta.data;
        const candidatos = [];

        if (data && data.qualities && data.qualities.auto) {
            const auto = data.qualities.auto;
            if (Array.isArray(auto)) {
                for (const item of auto) {
                    if (typeof item === 'string') {
                        candidatos.push(item);
                    } else if (item && typeof item.url === 'string') {
                        candidatos.push(item.url);
                    }
                }
            }
        }

        if (data && data.qualities) {
            for (const calidad of Object.values(data.qualities)) {
                if (!Array.isArray(calidad)) continue;
                for (const item of calidad) {
                    if (typeof item === 'string') {
                        candidatos.push(item);
                    } else if (item && typeof item.url === 'string') {
                        candidatos.push(item.url);
                    }
                }
            }
        }

        const unicos = [...new Set(candidatos)].filter(esM3U8);

        for (const url of unicos) {
            if (await comprobarM3U8(url, videoId)) {
                guardarDailymotionCache(videoId, url);
                return url;
            }
        }
    } catch (e) {
        console.warn(`[Dailymotion] Metadata falló para ${videoId}: ${e.message}`);
    }

    // 2. API LIVE
    try {
        const apiUrl = `https://api.dailymotion.com/video/${videoId}?fields=stream_live_hls_url`;
        const respuesta = await axios.get(apiUrl, {
            timeout: 10000,
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
        });

        const url = respuesta.data && respuesta.data.stream_live_hls_url;
        if (esM3U8(url) && (await comprobarM3U8(url, videoId))) {
            guardarDailymotionCache(videoId, url);
            return url;
        }
    } catch (e) {}

    // 3. API HLS
    try {
        const apiUrl = `https://api.dailymotion.com/video/${videoId}?fields=stream_hls_url`;
        const respuesta = await axios.get(apiUrl, {
            timeout: 10000,
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
        });

        const url = respuesta.data && respuesta.data.stream_hls_url;
        if (esM3U8(url) && (await comprobarM3U8(url, videoId))) {
            guardarDailymotionCache(videoId, url);
            return url;
        }
    } catch (e) {}

    return null;
}


// ============================================================
// PROPROXY PLAYLIST
// ============================================================

async function procesarPlaylistProxy(streamUrl, req, res, referer = '') {
    try {
        const headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain,*/*'
        };

        if (referer) {
            headers.Referer = referer;
            try {
                headers.Origin = new URL(referer).origin;
            } catch {}
        }

        const respuesta = await axios.get(streamUrl, {
            httpAgent: agenteParaUrl(streamUrl),
            httpsAgent: agenteParaUrl(streamUrl),
            timeout: 15000,
            responseType: 'text',
            headers,
            validateStatus: status => status >= 200 && status < 400
        });

        let contenido = String(respuesta.data || '');

        if (!contenido.includes('#EXTM3U')) {
            console.error(`[PROXY] No es M3U8: ${streamUrl}`);
            return false;
        }

        const baseUrl = new URL(streamUrl);
        const lineas = contenido.split(/\r?\n/);
        const resultado = [];

        for (let linea of lineas) {
            const texto = linea.trim();

            if (!texto || texto.startsWith('#')) {
                resultado.push(linea);
                continue;
            }

            let urlFinal;
            try {
                urlFinal = new URL(texto, baseUrl).href;
            } catch {
                resultado.push(linea);
                continue;
            }

            const ref = referer || '';
            const sig = crearFirma(urlFinal, ref);
            const base = PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

            if (urlFinal.includes('.m3u8') || urlFinal.includes('/manifest/')) {
                resultado.push(
                    `${base}/api/proxy/subplaylist` +
                    `?url=${encodeURIComponent(urlFinal)}` +
                    `&ref=${encodeURIComponent(ref)}` +
                    `&sig=${sig}`
                );
            } else {
                resultado.push(
                    `${base}/api/proxy/segment` +
                    `?url=${encodeURIComponent(urlFinal)}` +
                    `&ref=${encodeURIComponent(ref)}` +
                    `&sig=${sig}`
                );
            }
        }

        contenido = resultado.join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(contenido);

        return true;

    } catch (e) {
        console.error('[PROXY] Error:', e.message);
        return false;
    }
}


// ============================================================
// RUTAS DE PROXY / SUBPLAYLIST / SEGMENT
// ============================================================

app.get('/api/proxy/subplaylist', async (req, res) => {
    const { url, ref = '', sig } = req.query;

    if (!url || !sig || !comprobarFirma(url, ref, sig)) {
        return res.status(403).send('Firma inválida');
    }

    const ok = await procesarPlaylistProxy(url, req, res, ref);

    if (!ok) {
        res.status(502).send('Error obteniendo subplaylist');
    }
});


app.get('/api/proxy/segment', async (req, res) => {
    const { url, ref = '', sig } = req.query;

    if (!url || !sig || !comprobarFirma(url, ref, sig)) {
        return res.status(403).send('Firma inválida');
    }

    try {
        const headers = { 'User-Agent': USER_AGENT };

        if (ref) {
            headers.Referer = ref;
            try {
                headers.Origin = new URL(ref).origin;
            } catch {}
        }

        const respuesta = await axios.get(url, {
            httpAgent: agenteParaUrl(url),
            httpsAgent: agenteParaUrl(url),
            timeout: 15000,
            responseType: 'stream',
            headers,
            validateStatus: status => status >= 200 && status < 400
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        respuesta.data.pipe(res);

    } catch (e) {
        res.status(502).send('Error obteniendo segmento');
    }
});


// ============================================================
// INICIO DEL SERVIDOR
// ============================================================

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
