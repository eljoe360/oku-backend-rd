const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Agente HTTPS para ignorar restricciones TLS estrictas de CloudFront / SSL viejos
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

// Habilitar cabeceras CORS globales para evitar bloqueos en Roku
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ======================================================
// GITHUB
// ======================================================
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

// ======================================================
// TELEMICRO
// ======================================================
const TELEMICRO_PLAYLIST = 'https://live2.telemicro.com.do/live/55/playlist.m3u8';
const TELEMICRO_BASE = 'https://live2.telemicro.com.do/live/55/';

async function obtenerStreamTelemicro() {
    console.log('Obteniendo stream de Telemicro...');
    let cookies = '';

    try {
        const pagina = await axios.get('https://telemicro.com.do/telemicro-en-vivo/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        if (pagina.headers['set-cookie']) {
            cookies = pagina.headers['set-cookie']
                .map(c => c.split(';')[0])
                .join('; ');
        }
    } catch (error) {
        console.log('No se pudieron obtener cookies de Telemicro: ' + error.message);
    }

    const playlistRes = await axios.get(TELEMICRO_PLAYLIST, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://telemicro.com.do/',
            'Accept': '*/*',
            'Cookie': cookies
        },
        timeout: 20000,
        validateStatus: () => true
    });

    if (playlistRes.status !== 200) {
        throw new Error('Telemicro respondió HTTP ' + playlistRes.status);
    }

    const playlist = playlistRes.data;
    const lineas = playlist.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

    let streamUrl = null;
    for (const linea of lineas) {
        if (linea.includes('chunks.m3u8') || linea.includes('nimblesessionid')) {
            streamUrl = new URL(linea, TELEMICRO_BASE).href;
            break;
        }
    }

    if (!streamUrl) {
        throw new Error('No se encontró el stream dinámico de Telemicro');
    }

    console.log('Stream Telemicro encontrado: ' + streamUrl);
    return { streamUrl, cookies };
}

async function obtenerPlaylistTelemicro() {
    const datos = await obtenerStreamTelemicro();

    const response = await axios.get(datos.streamUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://telemicro.com.do/',
            'Accept': '*/*',
            'Cookie': datos.cookies
        },
        timeout: 20000
    });

    const playlist = response.data;
    const baseUrl = new URL(datos.streamUrl);
    const lineas = playlist.split(/\r?\n/);
    const resultado = [];

    for (const linea of lineas) {
        const texto = linea.trim();

        if (!texto) {
            resultado.push('');
            continue;
        }

        if (texto.startsWith('#')) {
            resultado.push(texto);
            continue;
        }

        const urlSegmento = new URL(texto, baseUrl).href;
        const proxy = '/api/telemicro/proxy?url=' + encodeURIComponent(urlSegmento) + '&cookie=' + encodeURIComponent(datos.cookies);
        resultado.push(proxy);
    }

    return resultado.join('\n');
}

app.get('/api/telemicro/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        const cookie = req.query.cookie || '';

        if (!url) {
            return res.status(400).send('Falta URL');
        }

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://telemicro.com.do/',
                'Accept': '*/*',
                'Cookie': cookie
            },
            timeout: 30000,
            maxRedirects: 10
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(response.data);
    } catch (error) {
        console.log('Error proxy Telemicro: ' + error.message);
        return res.status(502).send('Error obteniendo segmento de Telemicro');
    }
});

app.get('/api/telemicro', async (req, res) => {
    try {
        console.log('Roku solicitó Telemicro');
        const playlist = await obtenerPlaylistTelemicro();

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(playlist);
    } catch (error) {
        console.log('Error Telemicro: ' + error.message);
        return res.status(502).send('Error obteniendo Telemicro');
    }
});

// ======================================================
// CANAL 6
// ======================================================
const CANAL6_MASTER = 'https://stream.elseis.do/canal6/master.m3u8';

async function obtenerPlaylistCanal6() {
    const response = await axios.get(CANAL6_MASTER, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
        },
        timeout: 20000
    });

    const playlist = response.data;
    const baseUrl = new URL(CANAL6_MASTER);
    const lineas = playlist.split(/\r?\n/);
    const resultado = [];

    for (const linea of lineas) {
        const texto = linea.trim();

        if (!texto) {
            resultado.push('');
            continue;
        }

        if (texto.startsWith('#')) {
            resultado.push(texto);
            continue;
        }

        const url = new URL(texto, baseUrl).href;
        const proxy = '/api/canal6/proxy?url=' + encodeURIComponent(url);
        resultado.push(proxy);
    }

    return resultado.join('\n');
}

app.get('/api/canal6/proxy', async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).send('Falta URL');
        }

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            timeout: 30000,
            maxRedirects: 10
        });

        const contentType = response.headers['content-type'] || '';

        if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.includes('.m3u8')) {
            const playlist = Buffer.from(response.data).toString('utf8');
            const baseUrl = new URL(url);
            const lineas = playlist.split(/\r?\n/);
            const resultado = [];

            for (const linea of lineas) {
                const texto = linea.trim();

                if (!texto) {
                    resultado.push('');
                    continue;
                }

                if (texto.startsWith('#')) {
                    resultado.push(texto);
                    continue;
                }

                const nuevaUrl = new URL(texto, baseUrl).href;
                resultado.push('/api/canal6/proxy?url=' + encodeURIComponent(nuevaUrl));
            }

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(resultado.join('\n'));
        }

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(response.data);
    } catch (error) {
        console.log('Error proxy Canal 6: ' + error.message);
        return res.status(502).send('Error obteniendo segmento Canal 6');
    }
});

app.get('/api/canal6', async (req, res) => {
    try {
        console.log('Roku solicitó Canal 6');
        const playlist = await obtenerPlaylistCanal6();

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(playlist);
    } catch (error) {
        console.log('Error Canal 6: ' + error.message);
        return res.status(502).send('Error obteniendo Canal 6');
    }
});

// ======================================================
// CANAL 7 (ANTENA 7 / CLOUDFRONT) - SOLUCIÓN PARA ROKU
// ======================================================
const CANAL7_MASTER = 'https://d3gie3ig6argu.cloudfront.net/ts:abr.m3u8';
const CANAL7_BASE = 'https://d3gie3ig6argu.cloudfront.net/';

app.get('/api/canal7', async (req, res) => {
    try {
        console.log('Obteniendo master playlist de Antena 7...');

        // 1. Obtener la playlist Master
        const masterRes = await axios.get(CANAL7_MASTER, {
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Origin': 'https://www.antena7.com.do',
                'Referer': 'https://www.antena7.com.do/'
            },
            timeout: 15000
        });

        const masterLines = masterRes.data.split(/\r?\n/);
        let subPlaylistUrl = null;

        // 2. Extraer la URL de la variante de video activa
        for (const line of masterLines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                subPlaylistUrl = new URL(trimmed, CANAL7_BASE).href;
                break;
            }
        }

        if (!subPlaylistUrl) {
            subPlaylistUrl = CANAL7_MASTER;
        }

        console.log('Cargando sub-playlist de Canal 7:', subPlaylistUrl);

        // 3. Obtener la sub-playlist con los segmentos .ts reales
        const subRes = await axios.get(subPlaylistUrl, {
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Origin': 'https://www.antena7.com.do',
                'Referer': 'https://www.antena7.com.do/'
            },
            timeout: 15000
        });

        const playlist = subRes.data;
        const lineas = playlist.split(/\r?\n/);
        const resultado = [];

        // 4. Convertir cada segmento a URL absoluta directa de CloudFront
        for (const linea of lineas) {
            const texto = linea.trim();

            if (!texto) {
                resultado.push('');
                continue;
            }

            if (texto.startsWith('#')) {
                resultado.push(texto);
                continue;
            }

            const urlAbsoluta = new URL(texto, subPlaylistUrl).href;
            resultado.push(urlAbsoluta);
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(resultado.join('\n'));

    } catch (error) {
        console.log('Error Canal 7: ' + (error.response ? `HTTP ${error.response.status}` : error.message));
        return res.status(502).send('Error obteniendo transmisión de Canal 7');
    }
});

// ======================================================
// CANALES DESDE GITHUB
// ======================================================
app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL, { timeout: 15000 });
        const canales = response.data;
        const ahora = new Date();

        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return new Date(canal.vencimiento) > ahora;
        });

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const resultado = canalesValidos.map(canal => {
            const nuevo = { ...canal };

            if (canal.telemicro_web) {
                nuevo.url = `${baseUrl}/api/telemicro`;
            } else if (canal.canal6_web) {
                nuevo.url = `${baseUrl}/api/canal6`;
            } else if (canal.canal7_web) {
                nuevo.url = `${baseUrl}/api/canal7`;
            }

            return nuevo;
        });

        return res.json(resultado);
    } catch (error) {
        console.log('Error leyendo canales: ' + error.message);
        return res.status(500).json({ error: 'No se pudieron obtener los canales' });
    }
});

// ======================================================
// INICIO & SERVER
// ======================================================
app.get('/', (req, res) => {
    res.send('ROKU Backend RD funcionando correctamente');
});

app.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});
