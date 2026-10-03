const express = require('express');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

// Detrás de un proxy (Render, Railway, Nginx...) para que req.protocol sea correcto
app.set('trust proxy', 1);
app.disable('x-powered-by');

// URL pública de tu servicio, ej: https://mi-backend.onrender.com
// Si no se define, se deduce de la petición.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

// Secreto para firmar las URLs del proxy. DEFÍNELO en producción.
let SECRET = process.env.PROXY_SECRET;
if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');
    console.warn(
        '[AVISO] PROXY_SECRET no definido. Se generó uno temporal; ' +
        'las URLs firmadas dejarán de funcionar al reiniciar.'
    );
}

// Hosts (separados por coma) a los que se les permite certificado inválido.
// Ejemplo: INSECURE_TLS_HOSTS=live2.telemicro.com.do
const INSECURE_TLS_HOSTS = (process.env.INSECURE_TLS_HOSTS || '')
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

function agenteParaUrl(urlStr) {
    try {
        const host = new URL(urlStr).hostname.toLowerCase();
        return INSECURE_TLS_HOSTS.includes(host) ? agenteInseguro : agenteSeguro;
    } catch {
        return agenteSeguro;
    }
}

const CANALES_JSON =
    process.env.CANALES_JSON ||
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/* CONFIGURACIÓN DE CANALES (se pueden sobreescribir con variables de entorno) */
const TELEMICRO_PLAYLIST =
    process.env.TELEMICRO_PLAYLIST ||
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const CANAL6_STREAM_URL =
    process.env.CANAL6_STREAM_URL ||
    'https://stream.elseis.do/canal6/master.m3u8';

/* CANAL 7 - ANTENA 7 */
const CANAL7_STREAM_URL =
    process.env.CANAL7_STREAM_URL ||
    'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

/* CANAL 8 - TELEMEDIOS */
const CANAL8_VIDEO_ID = process.env.CANAL8_VIDEO_ID || 'x9hvyy0';

/* Mapa: bandera en el JSON -> ruta de esta API */
const CANALES_WEB = {
    telemicro_web: 'telemicro',
    canal6_web: 'canal6',
    canal7_web: 'canal7',
    canal8_web: 'canal8'
};

/* =========================================================
   MIDDLEWARE (CORS, límites)
========================================================= */
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// HLS hace muchas peticiones por segundo por espectador: límite generoso.
const LIMITE_VENTANA_MS = 60 * 1000;
const LIMITE_MAX = 1200;
const contadores = new Map(); // ip -> { cuenta, reinicio }

app.use((req, res, next) => {
    const ahora = Date.now();
    let c = contadores.get(req.ip);

    if (!c || c.reinicio <= ahora) {
        c = { cuenta: 0, reinicio: ahora + LIMITE_VENTANA_MS };
        contadores.set(req.ip, c);
    }

    c.cuenta++;

    if (c.cuenta > LIMITE_MAX) {
        res.setHeader(
            'Retry-After',
            Math.ceil((c.reinicio - ahora) / 1000)
        );
        return res.status(429).send('Demasiadas peticiones');
    }
    next();
});

// Limpieza periódica para que el Map no crezca sin fin
setInterval(() => {
    const ahora = Date.now();
    for (const [ip, c] of contadores) {
        if (c.reinicio <= ahora) contadores.delete(ip);
    }
}, LIMITE_VENTANA_MS).unref();

/* =========================================================
   UTILIDADES
========================================================= */
function obtenerBaseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;
    return `${req.protocol}://${req.get('host')}`;
}

function firmar(url, ref = '') {
    return crypto
        .createHmac('sha256', SECRET)
        .update(`${url}\n${ref}`)
        .digest('hex');
}

function firmaValida(url, ref = '', sig = '') {
    const esperada = Buffer.from(firmar(url, ref));
    const recibida = Buffer.from(String(sig));
    return (
        esperada.length === recibida.length &&
        crypto.timingSafeEqual(esperada, recibida)
    );
}

function urlHttpValida(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Valida los parámetros firmados (url, ref, sig).
 * Devuelve { url, ref } o null (y ya responde con el error).
 */
function validarParametrosProxy(req, res) {
    const { url, ref = '', sig } = req.query;

    if (typeof url !== 'string' || !url) {
        res.status(400).send('Falta URL');
        return null;
    }
    if (typeof ref !== 'string') {
        res.status(400).send('Parámetro ref inválido');
        return null;
    }
    if (!urlHttpValida(url)) {
        res.status(400).send('URL inválida');
        return null;
    }
    if (!firmaValida(url, ref, sig)) {
        res.status(403).send('Firma inválida');
        return null;
    }
    return { url, ref };
}

/* =========================================================
   EXTRACTOR DE DAILYMOTION (con caché)
========================================================= */
const DM_CACHE_MS = 25 * 1000;
const dmCache = new Map(); // videoId -> { url, expira }
const dmEnCurso = new Map(); // videoId -> Promise (evita scrapes duplicados)

async function extraerStreamDailymotion(videoId) {
    // Método 1: API de Player Metadata
    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpsAgent: agenteSeguro,
            timeout: 6000,
            headers: {
                'User-Agent':
