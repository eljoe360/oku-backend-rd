const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const CANALES_JSON = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

/* CONFIGURACIÓN DE CANALES */
const TELEMICRO_PLAYLIST = 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const TELEMICRO_BASE = 'https://live2.telemicro.com.do/live/55/';
const CANAL6_STREAM_URL = 'https://stream.elseis.do/canal6/master.m3u8';

const CANAL7_VIDEO_ID = 'x9hvyy0';
const CANAL8_VIDEO_ID = 'x9hvyy0';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function obtenerBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
}

/* Extractor Robusto de Dailymotion */
async function obtenerUrlDailymotion(videoId) {
    try {
        // Intento 1: API Metadata con User-Agent de navegador
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respMeta = await axios.get(metadataUrl, {
            httpsAgent,
            timeout: 10000,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `https://www.dailymotion.com/embed/video/${videoId}`,
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });

        if (respMeta.data && respMeta.data.qualities) {
            const qualities = respMeta.data.qualities;
            // Preferir auto, si no buscar la primera cualidad de video válida
            const autoList = qualities.auto || Object.values(qualities).flat();
            const streamObj = autoList.find(q => q.url && !q.url.includes('live-aac'));
            if (streamObj) return streamObj.url;
            if (autoList[0]?.url) return autoList[0].url;
        }
    } catch (e) {
        console.error(`Error metadatos Dailymotion (${videoId}):`, e.message);
    }

    try {
        // Intento 2: Búsqueda directa en la página de embed
        const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
        const respEmbed = await axios.get(embedUrl, {
            httpsAgent,
            timeout: 10000,
            headers: { 'User-Agent': USER_AGENT }
        });

        const match = respEmbed.data.match(/"qualities":\s*({.*?}),"type"/);
        if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            const autoList = parsed.auto || Object.values(parsed).flat();
            if (autoList[0]?.url) return autoList[0].url;
        }
    } catch (e) {
        console.error(`Error fallback embed Dailymotion (${videoId}):`, e.message);
    }

    return null;
}

/* =========================================================
   LISTA DE CANALES (/api/canales)
========================================================= */

app.get('/api/canales', async (req, res) => {
    try {
        const respuesta = await axios.get(CANALES_JSON, { timeout: 15000 });
        const canales = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {
            if (canal.telemicro_web === true) return { ...canal, url: `${baseUrl}/api/telemicro` };
            if (canal.canal6_web === true) return { ...canal, url: `${baseUrl}/api/canal6` };
            if (canal.canal7_web === true) return { ...canal, url: `${baseUrl}/api/canal7` };
            if (canal.canal8_web === true) return { ...canal, url: `${baseUrl}/api/canal8` };
            return canal;
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error obteniendo canales:', error.message);
        res.status(500).json({ error: 'No se pudo obtener la lista de canales' });
    }
});

/* =========================================================
   CANAL 5 - TELEMICRO
========================================================= */

app.get('/api/telemicro', async (req, res) => {
    try {
        const headers = {
            'User-Agent': USER_AGENT,
            'Accept': '*/*',
            'Referer': 'https://telemicro.com.do/',
            'Origin': 'https://telemicro.com.do'
        };

        const respuesta = await axios.get(TELEMICRO_PLAYLIST, {
            httpsAgent,
            timeout: 15000,
            headers,
            responseType: 'text'
        });

        const baseUrl = obtenerBaseUrl(req);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const lineaTrim = linea.trim();
            if (lineaTrim && !lineaTrim.startsWith('#')) {
                let urlSegmento = lineaTrim;
                if (!urlSegmento.startsWith('http')) {
                    urlSegmento = new URL(urlSegmento, TELEMICRO_BASE).href;
                }
                return `${baseUrl}/api/telemicro/segment?url=${encodeURIComponent(urlSegmento)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error Canal 5:', error.message);
        res.status(500).send(`Error Canal 5: ${error.message}`);
    }
});

app.get('/api/telemicro/segment', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL');

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://telemicro.com.do/',
                'Origin': 'https://telemicro.com.do'
            }
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.send(respuesta.data);
    } catch (error) {
        res.status(500).send('Error segmento Telemicro');
    }
});

/* =========================================================
   CANAL 6
========================================================= */

app.get('/api/canal6', async (req, res) => {
    try {
        const respuesta = await axios.get(CANAL6_STREAM_URL, {
            httpsAgent,
            timeout: 15000,
            responseType: 'text',
            headers: { 'User-Agent': USER_AGENT }
        });

        const baseUrl = obtenerBaseUrl(req);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const urlCompleta = new URL(texto, CANAL6_STREAM_URL).href;
                return `${baseUrl}/api/canal6/subplaylist?url=${encodeURIComponent(urlCompleta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(nuevasLineas.join('\n'));
    } catch (error) {
        res.status(500).send('Error Canal 6');
    }
});

app.get('/api/canal6/subplaylist', async (req, res) => {
    try {
        const url = req.query.url;
        const respuesta = await axios.get(url, { httpsAgent, timeout: 15000, responseType: 'text', headers: { 'User-Agent': USER_AGENT } });
        const baseUrl = obtenerBaseUrl(req);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const segmento = new URL(texto, url).href;
                return `${baseUrl}/api/canal6/segment?url=${encodeURIComponent(segmento)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(nuevasLineas.join('\n'));
    } catch (error) {
        res.status(500).send('Error subplaylist Canal 6');
    }
});

app.get('/api/canal6/segment', async (req, res) => {
    try {
        const respuesta = await axios.get(req.query.url, { httpsAgent, timeout: 20000, responseType: 'arraybuffer', headers: { 'User-Agent': USER_AGENT } });
        res.setHeader('Content-Type', 'video/mp2t');
        res.send(respuesta.data);
    } catch (error) {
        res.status(500).send('Error segmento Canal 6');
    }
});

/* =========================================================
   HELPER PROXY PARA DAILYMOTION (CANAL 7 Y CANAL 8)
========================================================= */

async function procesarDailymotion(videoId, req, res, canalNombre) {
    try {
        const streamUrl = await obtenerUrlDailymotion(videoId);
        if (!streamUrl) throw new Error(`No se obtuvo URL de Dailymotion para ${canalNombre}`);

        const respuesta = await axios.get(streamUrl, {
            httpsAgent,
            timeout: 20000,
            responseType: 'text',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.dailymotion.com/'
            }
        });

        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(streamUrl);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const urlCompleta = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/${canalNombre}/subplaylist?url=${encodeURIComponent(urlCompleta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error(`Error ${canalNombre}:`, error.message);
        res.status(500).send(`Error ${canalNombre}: ${error.message}`);
    }
}

async function procesarSubplaylistDailymotion(req, res, canalNombre) {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL');

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            responseType: 'text',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.dailymotion.com/'
            }
        });

        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(url);
        const lineas = respuesta.data.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const urlAbsoluta = new URL(texto, sourceBaseUrl).href;
                if (texto.includes('.m3u8')) {
                    return `${baseUrl}/api/${canalNombre}/subplaylist?url=${encodeURIComponent(urlAbsoluta)}`;
                }
                return `${baseUrl}/api/${canalNombre}/segment?url=${encodeURIComponent(urlAbsoluta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        res.status(500).send(`Error subplaylist ${canalNombre}`);
    }
}

async function procesarSegmentoDailymotion(req, res) {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL de segmento');

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.dailymotion.com/'
            }
        });

        res.setHeader('Content-Type', respuesta.headers['content-type'] || 'video/mp2t');
        res.send(respuesta.data);
    } catch (error) {
        res.status(500).send('Error segmento Dailymotion');
    }
}

/* CANAL 7 */
app.get('/api/canal7', (req, res) => procesarDailymotion(CANAL7_VIDEO_ID, req, res, 'canal7'));
app.get('/api/canal7/subplaylist', (req, res) => procesarSubplaylistDailymotion(req, res, 'canal7'));
app.get('/api/canal7/segment', (req, res) => procesarSegmentoDailymotion(req, res));

/* CANAL 8 */
app.get('/api/canal8', (req, res) => procesarDailymotion(CANAL8_VIDEO_ID, req, res, 'canal8'));
app.get('/api/canal8/subplaylist', (req, res) => procesarSubplaylistDailymotion(req, res, 'canal8'));
app.get('/api/canal8/segment', (req, res) => procesarSegmentoDailymotion(req, res));

/* SERVIDOR */
app.get('/', (req, res) => res.send('ROKU Backend RD funcionando correctamente'));

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
