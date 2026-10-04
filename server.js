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
// CONFIGURACIÓN GENERAL
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
// HOSTS QUE NECESITAN TLS INSEGURO
// ============================================================

const INSECURE_TLS_HOSTS = (
    process.env.INSECURE_TLS_HOSTS ||
    'live2.telemicro.com.do,' +
    'live4.telemicro.com.do,' +
    'ss2.tvrdomi.com,' +
    'edge.livestreaminggroup.info,' +
    '2-fss-2.streamhoster.com,' +
    'live.eu-north-1a.cf.dmcdn.net'
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

        return INSECURE_TLS_HOSTS.includes(
            u.hostname.toLowerCase()
        )
            ? agenteInseguro
            : agenteSeguro;

    } catch {

        return agenteSeguro;
    }
}


// ============================================================
// CONFIGURACIÓN DE FUENTES
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
// CANALES
// ============================================================

const TELEMICRO_PLAYLIST =
    process.env.TELEMICRO_PLAYLIST ||
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';


const CANAL6_STREAM_URL =
    process.env.CANAL6_STREAM_URL ||
    'https://stream.elseis.do/canal6/master.m3u8';


const CANAL7_STREAM_URL =
    process.env.CANAL7_STREAM_URL ||
    'https://hls.tvabierta.net/hls/007.m3u8';


const CANAL8_STREAM_URL =
    process.env.CANAL8_STREAM_URL ||
    'http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8';


const CANAL9_STREAM_URL =
    process.env.CANAL9_STREAM_URL ||
    'https://hls.tvabierta.net/hls/009.m3u8';


const CANAL10_STREAM_URL =
    process.env.CANAL10_STREAM_URL ||
    'https://hls.tvabierta.net/hls/010.m3u8';


const CANAL11_STREAM_URL =
    process.env.CANAL11_STREAM_URL ||
    'https://hls.tvabierta.net/hls/011.m3u8';


const CANAL12_STREAM_URL =
    process.env.CANAL12_STREAM_URL ||
    'https://hls.tvabierta.net/hls/012.m3u8';


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


const CANAL23_STREAM_URL =
    process.env.CANAL23_STREAM_URL ||
    'https://hls.tvabierta.net/hls/023.m3u8';


const CANAL27_STREAM_URL =
    process.env.CANAL27_STREAM_URL ||
    'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/playlist.m3u8';


const CANAL27_CHUNK_URL =
    process.env.CANAL27_CHUNK_URL ||
    'https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/chunklist.m3u8';


const CANAL32_STREAM_URL =
    process.env.CANAL32_STREAM_URL ||
    'https://edge.livestreaminggroup.info/vtv32live/index.m3u8';


// ============================================================
// CANAL 33 - SUPER CANAL
// ============================================================

const CANAL33_STREAM_URL =
    process.env.CANAL33_STREAM_URL ||
    'https://cnn.hostlagarto.com/supercanalhd/playlist.m3u8';


// ============================================================
// CANAL 36 - DAILY MOTION
// NO SE GUARDA NINGÚN sec2(...) CADUCABLE
// ============================================================

const CANAL36_VIDEO_ID =
    process.env.CANAL36_VIDEO_ID ||
    'xar1qcu';


// ============================================================
// CANAL 37
// ============================================================

const CANAL37_STREAM_URL =
    process.env.CANAL37_STREAM_URL ||
    'https://dmxleo.dailymotion.com/cdn/manifest/video/x9lincs.m3u8';


// ============================================================
// IDs DAILY MOTION
// ============================================================

const CANAL9_VIDEO_ID =
    process.env.CANAL9_VIDEO_ID ||
    'x7gy059';


const CANAL11_VIDEO_ID =
    process.env.CANAL11_VIDEO_ID ||
    'x80ac48';


const CANAL12_VIDEO_ID =
    process.env.CANAL12_VIDEO_ID ||
    'xaio352';


const CANAL23_VIDEO_ID =
    process.env.CANAL23_VIDEO_ID ||
    'x9imtbq';


const CANAL37_VIDEO_ID =
    process.env.CANAL37_VIDEO_ID ||
    'x9lincs';


// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {

    res.header(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.header(
        'Access-Control-Allow-Headers',
        '*'
    );

    res.header(
        'Access-Control-Allow-Methods',
        'GET,HEAD,OPTIONS'
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});


// ============================================================
// RATE LIMIT SIMPLE
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

        return res
            .status(429)
            .send('Demasiadas solicitudes');
    }

    next();
}

app.use(rateLimit);


// ============================================================
// HMAC
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
// AYUDAS M3U8
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


async function comprobarM3U8(
    streamUrl,
    videoId = ''
) {

    if (!esM3U8(streamUrl)) {
        return false;
    }

    try {

        const respuesta = await axios.get(
            streamUrl,
            {
                httpAgent: agenteParaUrl(streamUrl),
                httpsAgent: agenteParaUrl(streamUrl),

                timeout: 7000,

                responseType: 'text',

                headers: {
                    'User-Agent': USER_AGENT,

                    'Referer':
                        videoId
                            ? `https://www.dailymotion.com/video/${videoId}`
                            : undefined
                },

                validateStatus:
                    status =>
                        status >= 200 &&
                        status < 400
            }
        );


        const contenido =
            String(respuesta.data || '');


        if (contenido.includes('#EXTM3U')) {
            return true;
        }


        console.warn(
            `[M3U8] ${streamUrl} respondió sin #EXTM3U`
        );

        return false;

    } catch (e) {

        console.warn(
            `[M3U8] No se pudo verificar: ${e.message}`
        );

        return false;
    }
}


// ============================================================
// CACHE DAILY MOTION
// ============================================================

const DM_CACHE_MS =
    30 * 1000;


const dmCache = new Map();


function guardarDailymotionCache(
    videoId,
    url
) {

    dmCache.set(
        `dm_${videoId}`,
        {
            url,
            expires:
                Date.now() + DM_CACHE_MS
        }
    );
}


function obtenerDailymotionCache(
    videoId
) {

    const dato =
        dmCache.get(`dm_${videoId}`);

    if (!dato) {
        return null;
    }


    if (Date.now() > dato.expires) {

        dmCache.delete(
            `dm_${videoId}`
        );

        return null;
    }


    return dato.url;
}


// ============================================================
// EXTRACTOR DAILY MOTION
// ============================================================

async function extraerStreamDailymotion(
    videoId
) {

    const cache =
        obtenerDailymotionCache(videoId);


    if (cache) {

        console.log(
            `[Dailymotion] Usando cache para ${videoId}`
        );

        return cache;
    }


    console.log(
        `[Dailymotion] Buscando URL nueva para ${videoId}...`
    );


    // --------------------------------------------------------
    // 1. PLAYER METADATA
    // --------------------------------------------------------

    try {

        const metadataUrl =
            `https://www.dailymotion.com/player/metadata/video/${videoId}`;


        const respuesta =
            await axios.get(
                metadataUrl,
                {
                    timeout: 10000,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Referer':
                            `https://www.dailymotion.com/video/${videoId}`,

                        'Accept':
                            'application/json,text/plain,*/*'
                    },

                    validateStatus:
                        status =>
                            status >= 200 &&
                            status < 400
                }
            );


        const data =
            respuesta.data;


        const candidatos = [];


        // qualities.auto
        if (
            data &&
            data.qualities &&
            data.qualities.auto
        ) {

            const auto =
                data.qualities.auto;


            if (Array.isArray(auto)) {

                for (const item of auto) {

                    if (
                        typeof item === 'string'
                    ) {

                        candidatos.push(item);

                    } else if (
                        item &&
                        typeof item.url === 'string'
                    ) {

                        candidatos.push(
                            item.url
                        );
                    }
                }
            }
        }


        // Todas las qualities
        if (
            data &&
            data.qualities
        ) {

            for (
                const calidad of Object.values(
                    data.qualities
                )
            ) {

                if (!Array.isArray(calidad)) {
                    continue;
                }

                for (const item of calidad) {

                    if (
                        typeof item === 'string'
                    ) {

                        candidatos.push(item);

                    } else if (
                        item &&
                        typeof item.url === 'string'
                    ) {

                        candidatos.push(
                            item.url
                        );
                    }
                }
            }
        }


        const unicos =
            [...new Set(candidatos)]
                .filter(esM3U8);


        // Preferir 480p
        const ordenados =
            unicos.sort((a, b) => {

                const a480 =
                    a.includes('480');

                const b480 =
                    b.includes('480');

                if (a480 && !b480) {
                    return -1;
                }

                if (!a480 && b480) {
                    return 1;
                }

                return 0;
            });


        for (const url of ordenados) {

            console.log(
                `[Dailymotion] Probando: ${url}`
            );


            const valido =
                await comprobarM3U8(
                    url,
                    videoId
                );


            if (valido) {

                guardarDailymotionCache(
                    videoId,
                    url
                );

                console.log(
                    `[Dailymotion] M3U8 válido encontrado para ${videoId}`
                );

                return url;
            }
        }

    } catch (e) {

        console.warn(
            `[Dailymotion] Metadata falló para ${videoId}:`,
            e.message
        );
    }


    // --------------------------------------------------------
    // 2. API LIVE
    // --------------------------------------------------------

    try {

        const apiUrl =
            `https://api.dailymotion.com/video/${videoId}` +
            `?fields=stream_live_hls_url`;


        const respuesta =
            await axios.get(
                apiUrl,
                {
                    timeout: 10000,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'application/json'
                    }
                }
            );


        const url =
            respuesta.data &&
            respuesta.data
                .stream_live_hls_url;


        if (
            esM3U8(url) &&
            await comprobarM3U8(
                url,
                videoId
            )
        ) {

            guardarDailymotionCache(
                videoId,
                url
            );

            return url;
        }

    } catch (e) {

        console.warn(
            `[Dailymotion] API live falló para ${videoId}:`,
            e.message
        );
    }


    // --------------------------------------------------------
    // 3. API HLS NORMAL
    // --------------------------------------------------------

    try {

        const apiUrl =
            `https://api.dailymotion.com/video/${videoId}` +
            `?fields=stream_hls_url`;


        const respuesta =
            await axios.get(
                apiUrl,
                {
                    timeout: 10000,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'application/json'
                    }
                }
            );


        const url =
            respuesta.data &&
            respuesta.data.stream_hls_url;


        if (
            esM3U8(url) &&
            await comprobarM3U8(
                url,
                videoId
            )
        ) {

            guardarDailymotionCache(
                videoId,
                url
            );

            return url;
        }

    } catch (e) {

        console.warn(
            `[Dailymotion] API HLS falló para ${videoId}:`,
            e.message
        );
    }


    console.error(
        `[Dailymotion] No se encontró M3U8 válido para ${videoId}`
    );

    return null;
}


// ============================================================
// PROXY DE PLAYLIST
// ============================================================

async function procesarPlaylistProxy(
    streamUrl,
    req,
    res,
    referer = ''
) {

    try {

        const headers = {
            'User-Agent': USER_AGENT,
            'Accept':
                'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*'
        };


        if (referer) {
            headers.Referer = referer;
        }


        const origen =
            referer
                ? new URL(referer).origin
                : '';


        if (origen) {
            headers.Origin = origen;
        }


        const respuesta =
            await axios.get(
                streamUrl,
                {
                    httpAgent:
                        agenteParaUrl(streamUrl),

                    httpsAgent:
                        agenteParaUrl(streamUrl),

                    timeout: 15000,

                    responseType: 'text',

                    headers,

                    validateStatus:
                        status =>
                            status >= 200 &&
                            status < 400
                }
            );


        let contenido =
            String(respuesta.data || '');


        if (
            !contenido.includes('#EXTM3U')
        ) {

            console.error(
                `[PROXY] La respuesta no es M3U8: ${streamUrl}`
            );

            return false;
        }


        const baseUrl =
            new URL(
                streamUrl
            );


        const lineas =
            contenido.split(/\r?\n/);


        const resultado = [];


        for (let linea of lineas) {

            const texto =
                linea.trim();


            if (
                !texto ||
                texto.startsWith('#')
            ) {

                resultado.push(linea);
                continue;
            }


            let urlFinal;


            try {

                urlFinal =
                    new URL(
                        texto,
                        baseUrl
                    ).href;

            } catch {

                resultado.push(linea);
                continue;
            }


            const ref =
                referer || '';


            const sig =
                crearFirma(
                    urlFinal,
                    ref
                );


            if (
                urlFinal.includes('.m3u8') ||
                urlFinal.includes('/manifest/')
            ) {

                const proxyUrl =
                    `${PUBLIC_URL || `${req.protocol}://${req.get('host')}`}` +
                    `/api/proxy/subplaylist` +
                    `?url=${encodeURIComponent(urlFinal)}` +
                    `&ref=${encodeURIComponent(ref)}` +
                    `&sig=${sig}`;


                resultado.push(
                    proxyUrl
                );

            } else {

                const proxyUrl =
                    `${PUBLIC_URL || `${req.protocol}://${req.get('host')}`}` +
                    `/api/proxy/segment` +
                    `?url=${encodeURIComponent(urlFinal)}` +
                    `&ref=${encodeURIComponent(ref)}` +
                    `&sig=${sig}`;


                resultado.push(
                    proxyUrl
                );
            }
        }


        contenido =
            resultado.join('\n');


        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        res.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );


        res.send(contenido);

        return true;

    } catch (e) {

        console.error(
            `[PROXY] Error procesando playlist:`,
            e.message
        );

        return false;
    }
}


// ============================================================
// PROXY SUBPLAYLIST
// ============================================================

app.get(
    '/api/proxy/subplaylist',
    async (req, res) => {

        const {
            url,
            ref = '',
            sig
        } = req.query;


        if (
            !url ||
            !sig ||
            !comprobarFirma(
                url,
                ref,
                sig
            )
        ) {

            return res
                .status(403)
                .send('Firma inválida');
        }


        const ok =
            await procesarPlaylistProxy(
                url,
                req,
                res,
                ref
            );


        if (!ok) {

            return res
                .status(502)
                .send(
                    'Error obteniendo subplaylist'
                );
        }
    }
);


// ============================================================
// PROXY SEGMENT
// ============================================================

app.get(
    '/api/proxy/segment',
    async (req, res) => {

        const {
            url,
            ref = '',
            sig
        } = req.query;


        if (
            !url ||
            !sig ||
            !comprobarFirma(
                url,
                ref,
                sig
            )
        ) {

            return res
                .status(403)
                .send('Firma inválida');
        }


        try {

            const headers = {
                'User-Agent':
                    USER_AGENT
            };


            if (ref) {

                headers.Referer =
                    ref;


                try {

                    headers.Origin =
                        new URL(ref).origin;

                } catch {}
            }


            const respuesta =
                await axios.get(
                    url,
                    {
                        httpAgent:
                            agenteParaUrl(url),

                        httpsAgent:
                            agenteParaUrl(url),

                        timeout: 15000,

                        responseType:
                            'stream',

                        headers,

                        validateStatus:
                            status =>
                                status >= 200 &&
                                status < 400
                    }
                );


            if (
                respuesta.headers[
                    'content-type'
                ]
            ) {

                res.setHeader(
                    'Content-Type',
                    respuesta.headers[
                        'content-type'
                    ]
                );
            }


            res.setHeader(
                'Access-Control-Allow-Origin',
                '*'
            );


            respuesta.data.pipe(res);

        } catch (e) {

            console.error(
                '[SEGMENT] Error:',
                e.message
            );


            if (!res.headersSent) {

                res
                    .status(502)
                    .send(
                        'Error obteniendo segmento'
                    );
            }
        }
    }
);


// ============================================================
// CANAL 6
// ============================================================

app.get(
    '/api/canal6',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL6_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 6'
                );
        }
    }
);


// ============================================================
// CANAL 7
// ============================================================

app.get(
    '/api/canal7',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL7_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 7'
                );
        }
    }
);


// ============================================================
// CANAL 8
// ============================================================

app.get(
    '/api/canal8',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL8_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 8'
                );
        }
    }
);


// ============================================================
// CANAL 9 - DAILY MOTION
// ============================================================

app.get(
    '/api/canal9',
    async (req, res) => {

        const url =
            await extraerStreamDailymotion(
                CANAL9_VIDEO_ID
            );


        if (!url) {

            return res
                .status(503)
                .send(
                    'Señal no disponible para Canal 9'
                );
        }


        const ok =
            await procesarPlaylistProxy(
                url,
                req,
                res,
                'https://www.dailymotion.com/'
            );


        if (!ok) {

            dmCache.delete(
                `dm_${CANAL9_VIDEO_ID}`
            );

            res
                .status(503)
                .send(
                    'Error en la señal del Canal 9'
                );
        }
    }
);


// ============================================================
// CANAL 10
// ============================================================

app.get(
    '/api/canal10',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL10_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 10'
                );
        }
    }
);


// ============================================================
// CANAL 11 - DAILY MOTION
// ============================================================

app.get(
    '/api/canal11',
    async (req, res) => {

        const url =
            await extraerStreamDailymotion(
                CANAL11_VIDEO_ID
            );


        if (!url) {

            return res
                .status(503)
                .send(
                    'Señal no disponible para Canal 11'
                );
        }


        const ok =
            await procesarPlaylistProxy(
                url,
                req,
                res,
                'https://www.dailymotion.com/'
            );


        if (!ok) {

            dmCache.delete(
                `dm_${CANAL11_VIDEO_ID}`
            );

            res
                .status(503)
                .send(
                    'Error en la señal del Canal 11'
                );
        }
    }
);


// ============================================================
// CANAL 12 - DAILY MOTION
// ============================================================

app.get(
    '/api/canal12',
    async (req, res) => {

        const url =
            await extraerStreamDailymotion(
                CANAL12_VIDEO_ID
            );


        if (!url) {

            return res
                .status(503)
                .send(
                    'Señal no disponible para Canal 12'
                );
        }


        const ok =
            await procesarPlaylistProxy(
                url,
                req,
                res,
                'https://www.dailymotion.com/'
            );


        if (!ok) {

            dmCache.delete(
                `dm_${CANAL12_VIDEO_ID}`
            );

            res
                .status(503)
                .send(
                    'Error en la señal del Canal 12'
                );
        }
    }
);


// ============================================================
// CANAL 13
// ============================================================

app.get(
    '/api/canal13',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL13_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 13'
                );
        }
    }
);


// ============================================================
// CANAL 15
// ============================================================

app.get(
    '/api/canal15',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL15_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 15'
                );
        }
    }
);


// ============================================================
// CANAL 18
// ============================================================

app.get(
    '/api/canal18',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL18_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 18'
                );
        }
    }
);


// ============================================================
// CANAL 19
// ============================================================

app.get(
    '/api/canal19',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL19_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 19'
                );
        }
    }
);


// ============================================================
// CANAL 21
// ============================================================

app.get(
    '/api/canal21',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL21_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 21'
                );
        }
    }
);


// ============================================================
// CANAL 23 - DAILY MOTION
// ============================================================

app.get(
    '/api/canal23',
    async (req, res) => {

        const url =
            await extraerStreamDailymotion(
                CANAL23_VIDEO_ID
            );


        if (!url) {

            return res
                .status(503)
                .send(
                    'Señal no disponible para Canal 23'
                );
        }


        const ok =
            await procesarPlaylistProxy(
                url,
                req,
                res,
                'https://www.dailymotion.com/'
            );


        if (!ok) {

            dmCache.delete(
                `dm_${CANAL23_VIDEO_ID}`
            );

            res
                .status(503)
                .send(
                    'Error en la señal del Canal 23'
                );
        }
    }
);


// ============================================================
// CANAL 27
// ============================================================

app.get(
    '/api/canal27',
    async (req, res) => {

        let ok =
            await procesarPlaylistProxy(
                CANAL27_STREAM_URL,
                req,
                res
            );


        if (ok) {
            return;
        }


        console.warn(
            '[CANAL 27] Playlist principal falló.'
        );


        ok =
            await procesarPlaylistProxy(
                CANAL27_CHUNK_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(503)
                .send(
                    'Señal no disponible para Canal 27'
                );
        }
    }
);


// ============================================================
// CANAL 32
// ============================================================

app.get(
    '/api/canal32',
    async (req, res) => {

        const ok =
            await procesarPlaylistProxy(
                CANAL32_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(500)
                .send(
                    'Error en la señal del Canal 32'
                );
        }
    }
);


// ============================================================
// CANAL 33 - SUPER CANAL
// ============================================================

app.get(
    '/api/canal33',
    async (req, res) => {

        console.log(
            '[CANAL 33] Cargando Super Canal...'
        );


        const ok =
            await procesarPlaylistProxy(
                CANAL33_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            console.error(
                '[CANAL 33] No se pudo cargar Super Canal.'
            );


            res
                .status(500)
                .send(
                    'Error en la señal del Canal 33'
                );
        }
    }
);


// ============================================================
// CANAL 36 - DAILY MOTION
// SIN BACKUP sec2 CADUCABLE
// ============================================================

app.get(
    '/api/canal36',
    async (req, res) => {

        console.log(
            '[CANAL 36] Buscando enlace Dailymotion actualizado...'
        );


        // PRIMER INTENTO
        let streamUrlDm =
            await extraerStreamDailymotion(
                CANAL36_VIDEO_ID
            );


        if (streamUrlDm) {

            const dinamicoOK =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (dinamicoOK) {
                return;
            }


            dmCache.delete(
                `dm_${CANAL36_VIDEO_ID}`
            );


            console.warn(
                '[CANAL 36] La URL dinámica falló.'
            );
        }


        // SEGUNDO INTENTO
        console.log(
            '[CANAL 36] Segundo intento de obtener URL nueva...'
        );


        streamUrlDm =
            await extraerStreamDailymotion(
                CANAL36_VIDEO_ID
            );


        if (streamUrlDm) {

            const segundoIntento =
                await procesarPlaylistProxy(
                    streamUrlDm,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (segundoIntento) {
                return;
            }


            dmCache.delete(
                `dm_${CANAL36_VIDEO_ID}`
            );
        }


        console.error(
            '[CANAL 36] No se pudo obtener un M3U8 válido de Dailymotion.'
        );


        res
            .status(503)
            .send(
                'Señal no disponible para Canal 36'
            );
    }
);


// ============================================================
// CANAL 37
// ============================================================

app.get(
    '/api/canal37',
    async (req, res) => {

        // PRIMERO intenta Dailymotion dinámico
        const dinamico =
            await extraerStreamDailymotion(
                CANAL37_VIDEO_ID
            );


        if (dinamico) {

            const ok =
                await procesarPlaylistProxy(
                    dinamico,
                    req,
                    res,
                    'https://www.dailymotion.com/'
                );


            if (ok) {
                return;
            }


            dmCache.delete(
                `dm_${CANAL37_VIDEO_ID}`
            );
        }


        // FALLBACK AL MANIFEST
        console.warn(
            '[CANAL 37] Usando manifest de respaldo.'
        );


        const ok =
            await procesarPlaylistProxy(
                CANAL37_STREAM_URL,
                req,
                res
            );


        if (!ok) {

            res
                .status(503)
                .send(
                    'Señal no disponible para Canal 37'
                );
        }
    }
);


// ============================================================
// OBTENER CANALES DEL JSON
// ============================================================

async function obtenerListaCanalesProcesada(
    req
) {

    try {

        const respuesta =
            await axios.get(
                CANALES_JSON,
                {
                    timeout: 15000,
                    headers: {
                        'User-Agent':
                            USER_AGENT
                    }
                }
            );


        const canales =
            respuesta.data;


        if (!Array.isArray(canales)) {

            return canales;
        }


        const base =
            PUBLIC_URL ||
            `${req.protocol}://${req.get('host')}`;


        return canales.map(canal => {

            const nuevo = {
                ...canal
            };


            for (
                const [clave, valor]
                of Object.entries(canal)
            ) {

                if (
                    clave.endsWith('_web') &&
                    valor === true
                ) {

                    const numero =
                        clave
                            .replace(
                                '_web',
                                ''
                            );


                    nuevo.url =
                        `${base}/api/${numero}`;
                }
            }


            return nuevo;
        });


    } catch (e) {

        console.error(
            '[CANALES] Error:',
            e.message
        );


        throw e;
    }
}


// ============================================================
// API CANALES
// ============================================================

app.get(
    '/api/canales',
    async (req, res) => {

        try {

            const canales =
                await obtenerListaCanalesProcesada(
                    req
                );


            res.json(canales);

        } catch {

            res
                .status(500)
                .json({
                    error:
                        'No se pudo obtener la lista de canales'
                });
        }
    }
);


// ============================================================
// SPORTS
// ============================================================

app.get(
    '/api/sports',
    async (req, res) => {

        try {

            const respuesta =
                await axios.get(
                    SPORTS_M3U_URL,
                    {
                        timeout: 20000,

                        headers: {
                            'User-Agent':
                                USER_AGENT
                        },

                        responseType:
                            'text'
                    }
                );


            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );


            res.send(
                respuesta.data
            );

        } catch (e) {

            console.error(
                '[SPORTS] Error:',
                e.message
            );


            res
                .status(500)
                .send(
                    'Error obteniendo deportes'
                );
        }
    }
);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    '/',
    (req, res) => {

        res.json({
            ok: true,
            server: 'Roku IPTV Proxy',
            canal33:
                '/api/canal33',
            canal36:
                '/api/canal36'
        });
    }
);


app.get(
    '/health',
    (req, res) => {

        res.json({
            ok: true,
            timestamp:
                new Date().toISOString()
        });
    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res
            .status(404)
            .json({
                error:
                    'Ruta no encontrada'
            });
    }
);


// ============================================================
// ERRORES GENERALES
// ============================================================

app.use(
    (err, req, res, next) => {

        console.error(
            '[ERROR GENERAL]',
            err
        );


        if (
            !res.headersSent
        ) {

            res
                .status(500)
                .json({
                    error:
                        'Error interno del servidor'
                });
        }
    }
);


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor ejecutándose en puerto ${PORT}`
        );

        console.log(
            `Canal 33: /api/canal33`
        );

        console.log(
            `Canal 36: /api/canal36`
        );
    }
);
