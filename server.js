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

/* =========================================================
   CONFIGURACIÓN DE CANALES
========================================================= */

const CANALES_JSON =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

/* ---------- CANAL 5 ---------- */
const TELEMICRO_PLAYLIST = 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const TELEMICRO_BASE = 'https://live2.telemicro.com.do/live/55/';

/* ---------- CANAL 6 ---------- */
const CANAL6_STREAM_URL = 'https://stream.elseis.do/canal6/master.m3u8';

/* ---------- CANAL 7 ---------- */
const CANAL7_VIDEO_ID = 'x9hvyy0';

/* ---------- CANAL 8 ---------- */
const CANAL8_VIDEO_ID = 'x9hvyy0';


/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function obtenerBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
}

async function obtenerUrlDailymotion(videoId) {
    try {
        const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
        const respuesta = await axios.get(metadataUrl, {
            httpsAgent,
            timeout: 10000,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
                'Referer': 'https://www.dailymotion.com/'
            }
        });

        if (respuesta.data && respuesta.data.qualities) {
            const qualities = respuesta.data.qualities;
            const autoQuality = qualities.auto || Object.values(qualities)[0];
            if (autoQuality && autoQuality[0] && autoQuality[0].url) {
                return autoQuality[0].url;
            }
        }
    } catch (error) {
        console.error(`Error obteniendo metadata Dailymotion (${videoId}):`, error.message);
    }
    return null;
}


/* =========================================================
   LISTA PRINCIPAL DE CANALES (/api/canales)
========================================================= */

app.get('/api/canales', async (req, res) => {
    try {
        const respuesta = await axios.get(CANALES_JSON, { timeout: 15000 });
        const canales = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);

        const resultado = canales.map(canal => {
            if (canal.telemicro_web === true) {
                return { ...canal, url: `${baseUrl}/api/telemicro` };
            }
            if (canal.canal6_web === true) {
                return { ...canal, url: `${baseUrl}/api/canal6` };
            }
            if (canal.canal7_web === true) {
                return { ...canal, url: `${baseUrl}/api/canal7` };
            }
            if (canal.canal8_web === true) {
                return { ...canal, url: `${baseUrl}/api/canal8` };
            }
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

async function obtenerCookiesTelemicro() {
    try {
        const respuesta = await axios.get(
            'https://telemicro.com.do/telemicro-en-vivo/',
            {
                httpsAgent,
                timeout: 15000,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
                    'Accept':
                        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                }
            }
        );

        const setCookie = respuesta.headers['set-cookie'];
        if (!setCookie) return '';

        return setCookie.map(cookie => cookie.split(';')[0]).join('; ');
    } catch (error) {
        console.error('Error obteniendo cookies Telemicro:', error.message);
        return '';
    }
}

async function obtenerPlaylistTelemicro() {
    const cookies = await obtenerCookiesTelemicro();
    const headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
        'Referer': 'https://telemicro.com.do/',
        'Origin': 'https://telemicro.com.do'
    };

    if (cookies) headers['Cookie'] = cookies;

    const respuesta = await axios.get(TELEMICRO_PLAYLIST, {
        httpsAgent,
        timeout: 15000,
        headers,
        responseType: 'text'
    });

    return { texto: respuesta.data, cookies };
}

app.get('/api/telemicro', async (req, res) => {
    try {
        const resultado = await obtenerPlaylistTelemicro();
        let playlist = resultado.texto;
        const cookies = resultado.cookies;
        const baseUrl = obtenerBaseUrl(req);

        const lineas = playlist.split(/\r?\n/);
        const nuevasLineas = lineas.map(linea => {
            const lineaTrim = linea.trim();

            if (
                lineaTrim &&
                !lineaTrim.startsWith('#') &&
                (lineaTrim.endsWith('.ts') || lineaTrim.includes('.ts?'))
            ) {
                let urlSegmento = lineaTrim;
                if (!urlSegmento.startsWith('http')) {
                    urlSegmento = new URL(urlSegmento, TELEMICRO_BASE).href;
                }
                return `${baseUrl}/api/telemicro/segment?url=${encodeURIComponent(urlSegmento)}&cookies=${encodeURIComponent(cookies)}`;
            }

            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error Canal 5:', error.response?.status || error.message);
        res.status(500).send(`Error Canal 5: ${error.response?.status || error.message}`);
    }
});

app.get('/api/telemicro/segment', async (req, res) => {
    try {
        const url = req.query.url;
        const cookies = req.query.cookies || '';

        if (!url) return res.status(400).send('Falta URL del segmento');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://telemicro.com.do/',
            'Origin': 'https://telemicro.com.do'
        };

        if (cookies) headers['Cookie'] = cookies;

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            headers,
            responseType: 'arraybuffer'
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.send(respuesta.data);

    } catch (error) {
        console.error('Error segmento Telemicro:', error.response?.status || error.message);
        res.status(500).send('Error obteniendo segmento Telemicro');
    }
});


/* =========================================================
   CANAL 6
========================================================= */

async function obtenerCanal6(url) {
    const respuesta = await axios.get(url, {
        httpsAgent,
        timeout: 15000,
        responseType: 'text',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
        }
    });
    return respuesta.data;
}

app.get('/api/canal6', async (req, res) => {
    try {
        const playlist = await obtenerCanal6(CANAL6_STREAM_URL);
        const baseUrl = obtenerBaseUrl(req);
        const lineas = playlist.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && texto.includes('.m3u8')) {
                const urlCompleta = new URL(texto, CANAL6_STREAM_URL).href;
                return `${baseUrl}/api/canal6/subplaylist?url=${encodeURIComponent(urlCompleta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error Canal 6:', error.response?.status || error.message);
        res.status(500).send(`Error Canal 6: ${error.response?.status || error.message}`);
    }
});

app.get('/api/canal6/subplaylist', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL de subplaylist');

        const playlist = await obtenerCanal6(url);
        const baseUrl = obtenerBaseUrl(req);
        const lineas = playlist.split(/\r?\n/);

        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && (texto.endsWith('.ts') || texto.includes('.ts?'))) {
                const segmento = new URL(texto, url).href;
                return `${baseUrl}/api/canal6/segment?url=${encodeURIComponent(segmento)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error subplaylist Canal 6:', error.response?.status || error.message);
        res.status(500).send('Error obteniendo subplaylist Canal 6');
    }
});

app.get('/api/canal6/segment', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL del segmento');

        const respuesta = await axios.get(url, {
            httpsAgent,
            timeout: 20000,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.send(respuesta.data);

    } catch (error) {
        console.error('Error segmento Canal 6:', error.response?.status || error.message);
        res.status(500).send('Error obteniendo segmento Canal 6');
    }
});


/* =========================================================
   CANAL 7
========================================================= */

app.get('/api/canal7', async (req, res) => {
    try {
        const streamUrl = await obtenerUrlDailymotion(CANAL7_VIDEO_ID);
        if (!streamUrl) throw new Error('No se pudo obtener el stream de Dailymotion');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(streamUrl, { httpsAgent, timeout: 20000, responseType: 'text', headers });
        const playlist = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(streamUrl);

        const lineas = playlist.split(/\r?\n/);
        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && texto.includes('.m3u8')) {
                const urlCompleta = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal7/subplaylist?url=${encodeURIComponent(urlCompleta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error Canal 7:', error.message);
        res.status(500).send(`Error Canal 7: ${error.message}`);
    }
});

app.get('/api/canal7/subplaylist', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL de subplaylist Canal 7');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(url, { httpsAgent, timeout: 20000, responseType: 'text', headers });
        const playlist = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(url);

        const lineas = playlist.split(/\r?\n/);
        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && texto.includes('.m3u8')) {
                const sub = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal7/subplaylist?url=${encodeURIComponent(sub)}`;
            }
            if (texto && !texto.startsWith('#')) {
                const segmento = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal7/segment?url=${encodeURIComponent(segmento)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error subplaylist Canal 7:', error.response?.status || error.message);
        res.status(500).send(`Error subplaylist Canal 7: ${error.response?.status || error.message}`);
    }
});

app.get('/api/canal7/segment', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL del segmento Canal 7');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(url, { httpsAgent, timeout: 20000, responseType: 'arraybuffer', headers });
        res.setHeader('Content-Type', respuesta.headers['content-type'] || 'video/mp2t');
        res.send(respuesta.data);

    } catch (error) {
        console.error('Error segmento Canal 7:', error.response?.status || error.message);
        res.status(500).send('Error obteniendo segmento Canal 7');
    }
});


/* =========================================================
   CANAL 8 (DAILYMOTION x9hvyy0)
========================================================= */

app.get('/api/canal8', async (req, res) => {
    try {
        console.log('Solicitando Canal 8 Dailymotion ID:', CANAL8_VIDEO_ID);
        const streamUrl = await obtenerUrlDailymotion(CANAL8_VIDEO_ID);

        if (!streamUrl) throw new Error('No se pudo obtener el stream de Dailymotion');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(streamUrl, { httpsAgent, timeout: 20000, responseType: 'text', headers });
        const playlist = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(streamUrl);

        const lineas = playlist.split(/\r?\n/);
        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && texto.includes('.m3u8')) {
                const urlCompleta = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal8/subplaylist?url=${encodeURIComponent(urlCompleta)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error Canal 8:', error.message);
        res.status(500).send(`Error Canal 8: ${error.message}`);
    }
});

app.get('/api/canal8/subplaylist', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL de subplaylist Canal 8');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(url, { httpsAgent, timeout: 20000, responseType: 'text', headers });
        const playlist = respuesta.data;
        const baseUrl = obtenerBaseUrl(req);
        const sourceBaseUrl = new URL(url);

        const lineas = playlist.split(/\r?\n/);
        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#') && texto.includes('.m3u8')) {
                const sub = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal8/subplaylist?url=${encodeURIComponent(sub)}`;
            }
            if (texto && !texto.startsWith('#')) {
                const segmento = new URL(texto, sourceBaseUrl).href;
                return `${baseUrl}/api/canal8/segment?url=${encodeURIComponent(segmento)}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));

    } catch (error) {
        console.error('Error subplaylist Canal 8:', error.response?.status || error.message);
        res.status(500).send(`Error subplaylist Canal 8: ${error.response?.status || error.message}`);
    }
});

app.get('/api/canal8/segment', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL del segmento Canal 8');

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://www.dailymotion.com/',
            'Origin': 'https://www.dailymotion.com'
        };

        const respuesta = await axios.get(url, { httpsAgent, timeout: 20000, responseType: 'arraybuffer', headers });
        res.setHeader('Content-Type', respuesta.headers['content-type'] || 'video/mp2t');
        res.send(respuesta.data);

    } catch (error) {
        console.error('Error segmento Canal 8:', error.response?.status || error.message);
        res.status(500).send('Error obteniendo segmento Canal 8');
    }
});


/* =========================================================
   RUTA PRINCIPAL Y SERVIDOR
========================================================= */

app.get('/', (req, res) => {
    res.send('ROKU Backend RD funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor funcionando en puerto ${PORT}`);
});
