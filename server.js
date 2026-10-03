const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// AGENTE HTTPS
// ======================================================
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

// ======================================================
// CORS
// ======================================================
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
// GITHUB - LISTA DE CANALES JSON
// ======================================================
const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL, {
            timeout: 15000
        });

        const canales = response.data;
        const ahora = new Date();

        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return new Date(canal.vencimiento) > ahora;
        });

        const protocol =
            req.headers['x-forwarded-proto'] || req.protocol;

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
        console.log(
            'Error leyendo canales JSON:',
            error.message
        );

        return res.status(500).json({
            error: 'No se pudieron obtener los canales'
        });
    }
});

// ======================================================
// CANAL 5 - TELEMICRO
// ======================================================

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';

async function obtenerStreamTelemicro() {

    let cookies = '';

    try {

        const pagina = await axios.get(
            'https://telemicro.com.do/telemicro-en-vivo/',
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                timeout: 20000
            }
        );

        if (pagina.headers['set-cookie']) {

            cookies =
                pagina.headers['set-cookie']
                    .map(c => c.split(';')[0])
                    .join('; ');
        }

    } catch (error) {

        console.log(
            'Error cookies Telemicro:',
            error.message
        );
    }

    const playlistRes = await axios.get(
        TELEMICRO_PLAYLIST,
        {
            headers: {

                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                'Referer':
                    'https://telemicro.com.do/',

                'Accept':
                    '*/*',

                'Cookie':
                    cookies
            },

            timeout: 20000,

            validateStatus: () => true
        }
    );

    if (playlistRes.status !== 200) {

        throw new Error(
            'Telemicro HTTP ' +
            playlistRes.status
        );
    }

    const lineas =
        playlistRes.data
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);

    let streamUrl = null;

    for (const linea of lineas) {

        if (
            linea.includes('chunks.m3u8') ||
            linea.includes('nimblesessionid')
        ) {

            streamUrl =
                new URL(
                    linea,
                    TELEMICRO_BASE
                ).href;

            break;
        }
    }

    if (!streamUrl) {

        throw new Error(
            'No se encontró el stream de Telemicro'
        );
    }

    return {
        streamUrl,
        cookies
    };
}

async function obtenerPlaylistTelemicro() {

    const datos =
        await obtenerStreamTelemicro();

    const response = await axios.get(
        datos.streamUrl,
        {
            headers: {

                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                'Referer':
                    'https://telemicro.com.do/',

                'Accept':
                    '*/*',

                'Cookie':
                    datos.cookies
            },

            timeout: 20000
        }
    );

    const baseUrl =
        new URL(datos.streamUrl);

    const lineas =
        response.data.split(/\r?\n/);

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

        const urlSegmento =
            new URL(
                texto,
                baseUrl
            ).href;

        resultado.push(
            '/api/telemicro/proxy?url=' +
            encodeURIComponent(urlSegmento) +
            '&cookie=' +
            encodeURIComponent(datos.cookies)
        );
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

        const response = await axios.get(
            url,
            {
                responseType: 'arraybuffer',

                headers: {

                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                    'Referer':
                        'https://telemicro.com.do/',

                    'Accept':
                        '*/*',

                    'Cookie':
                        cookie
                },

                timeout: 30000,
                maxRedirects: 10
            }
        );

        res.setHeader(
            'Content-Type',
            'video/mp2t'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache'
        );

        return res.send(response.data);

    } catch (error) {

        console.log(
            'Error segmento Telemicro:',
            error.message
        );

        return res
            .status(502)
            .send('Error segmento Telemicro');
    }
});

app.get('/api/telemicro', async (req, res) => {

    try {

        const playlist =
            await obtenerPlaylistTelemicro();

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        return res.send(playlist);

    } catch (error) {

        console.log(
            'Error Telemicro:',
            error.message
        );

        return res
            .status(502)
            .send('Error Telemicro');
    }
});

// ======================================================
// CANAL 6 - EL SEIS
// ======================================================

const CANAL6_STREAM_URL =
    'https://stream.elseis.do/canal6/master.m3u8';

async function obtenerPlaylistCanal6() {

    const response = await axios.get(
        CANAL6_STREAM_URL,
        {
            headers: {

                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                'Accept':
                    '*/*',

                'Referer':
                    'https://elseis.do/'
            },

            timeout: 20000
        }
    );

    const baseUrl =
        new URL(CANAL6_STREAM_URL);

    const lineas =
        response.data.split(/\r?\n/);

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

        const urlAbsoluta =
            new URL(
                texto,
                baseUrl
            ).href;

        if (texto.includes('.m3u8')) {

            resultado.push(
                '/api/canal6/subplaylist?url=' +
                encodeURIComponent(urlAbsoluta)
            );

        } else {

            resultado.push(
                '/api/canal6/proxy?url=' +
                encodeURIComponent(urlAbsoluta)
            );
        }
    }

    return resultado.join('\n');
}

app.get('/api/canal6/subplaylist', async (req, res) => {

    try {

        const subUrl = req.query.url;

        if (!subUrl) {
            return res.status(400).send('Falta URL');
        }

        const response = await axios.get(
            subUrl,
            {
                headers: {

                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                    'Accept':
                        '*/*',

                    'Referer':
                        'https://elseis.do/'
                },

                timeout: 20000
            }
        );

        const baseUrl =
            new URL(subUrl);

        const lineas =
            response.data.split(/\r?\n/);

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

            const urlAbsoluta =
                new URL(
                    texto,
                    baseUrl
                ).href;

            if (texto.includes('.m3u8')) {

                resultado.push(
                    '/api/canal6/subplaylist?url=' +
                    encodeURIComponent(urlAbsoluta)
                );

            } else {

                resultado.push(
                    '/api/canal6/proxy?url=' +
                    encodeURIComponent(urlAbsoluta)
                );
            }
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        return res.send(
            resultado.join('\n')
        );

    } catch (error) {

        console.log(
            'Error subplaylist Canal 6:',
            error.message
        );

        return res
            .status(502)
            .send(
                'Error subplaylist Canal 6'
            );
    }
});

app.get('/api/canal6/proxy', async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {
            return res.status(400).send('Falta URL');
        }

        const response = await axios.get(
            url,
            {
                responseType: 'arraybuffer',

                headers: {

                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

                    'Accept':
                        '*/*',

                    'Referer':
                        'https://elseis.do/'
                },

                timeout: 30000
            }
        );

        res.setHeader(
            'Content-Type',
            'video/mp2t'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache'
        );

        return res.send(response.data);

    } catch (error) {

        console.log(
            'Error segmento Canal 6:',
            error.message
        );

        return res
            .status(502)
            .send(
                'Error segmento Canal 6'
            );
    }
});

app.get('/api/canal6', async (req, res) => {

    try {

        const playlist =
            await obtenerPlaylistCanal6();

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );

        return res.send(playlist);

    } catch (error) {

        console.log(
            'Error Canal 6:',
            error.message
        );

        return res
            .status(502)
            .send(
                'Error Canal 6'
            );
    }
});

// ======================================================
// CANAL 7 - ANTENA 7 / CLOUDFRONT
// ======================================================

const CANAL7_STREAM_URL =
    'https://d3gie3ig6argu.cloudfront.net/medialist_15609871089997455276_hls.m3u8';

// ======================================================
// OBTENER PLAYLIST CANAL 7
// ======================================================

async function solicitarCanal7(url, intento) {

    let headers = {};

    if (intento === 1) {

        headers = {

            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',

            'Accept':
                'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

            'Accept-Language':
                'es-DO,es;q=0.9,en-US;q=0.8,en;q=0.7',

            'Referer':
                'https://www.antena7.com.do/',

            'Origin':
                'https://www.antena7.com.do',

            'Connection':
                'keep-alive'
        };

    } else if (intento === 2) {

        headers = {

            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',

            'Accept':
                'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

            'Accept-Language':
                'es-DO,es;q=0.9,en-US;q=0.8,en;q=0.7',

            'Referer':
                'https://www.antena7.com.do/',

            'Connection':
                'keep-alive'
        };

    } else {

        headers = {

            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',

            'Accept':
                '*/*',

            'Accept-Language':
                'es-DO,es;q=0.9,en-US;q=0.8,en;q=0.7',

            'Referer':
                'https://www.antena7.com.do/',

            'Sec-Fetch-Dest':
                'empty',

            'Sec-Fetch-Mode':
                'cors',

            'Sec-Fetch-Site':
                'cross-site',

            'Connection':
                'keep-alive'
        };
    }

    return await axios.get(
        url,
        {
            httpsAgent: httpsAgent,

            headers: headers,

            timeout: 20000,

            maxRedirects: 10,

            validateStatus: () => true
        }
    );
}

async function obtenerPlaylistCanal7() {

    console.log(
        '======================================'
    );

    console.log(
        'CANAL 7 - INICIANDO CONEXIÓN'
    );

    console.log(
        '======================================'
    );

    for (let intento = 1; intento <= 3; intento++) {

        try {

            console.log(
                'Canal 7 - intento:',
                intento
            );

            const response =
                await solicitarCanal7(
                    CANAL7_STREAM_URL,
                    intento
                );

            console.log(
                'Canal 7 - HTTP:',
                response.status
            );

            console.log(
                'Canal 7 - Content-Type:',
                response.headers['content-type']
            );

            if (response.status !== 200) {

                console.log(
                    'Canal 7 rechazó intento',
                    intento,
                    'con HTTP',
                    response.status
                );

                continue;
            }

            if (
                typeof response.data !== 'string' ||
                !response.data.includes('#EXTM3U')
            ) {

                console.log(
                    'Canal 7 no devolvió M3U8 válido'
                );

                continue;
            }

            console.log(
                'Canal 7 - playlist recibida correctamente'
            );

            const baseUrl =
                new URL(CANAL7_STREAM_URL);

            const lineas =
                response.data.split(/\r?\n/);

            const resultado = [];

            for (const linea of lineas) {

                const texto =
                    linea.trim();

                if (!texto) {

                    resultado.push('');

                    continue;
                }

                if (texto.startsWith('#')) {

                    resultado.push(texto);

                    continue;
                }

                const urlAbsoluta =
                    new URL(
                        texto,
                        baseUrl
                    ).href;

                if (
                    texto.includes('.m3u8')
                ) {

                    resultado.push(
                        '/api/canal7/subplaylist?url=' +
                        encodeURIComponent(
                            urlAbsoluta
                        )
                    );

                } else {

                    resultado.push(
                        '/api/canal7/proxy?url=' +
                        encodeURIComponent(
                            urlAbsoluta
                        )
                    );
                }
            }

            return resultado.join('\n');

        } catch (error) {

            console.log(
                'Canal 7 intento',
                intento,
                'error:',
                error.message
            );
        }
    }

    throw new Error(
        'CloudFront rechazó los 3 intentos'
    );
}

// ======================================================
// CANAL 7 - SUBPLAYLIST
// ======================================================

app.get(
    '/api/canal7/subplaylist',
    async (req, res) => {

        try {

            const subUrl =
                req.query.url;

            if (!subUrl) {

                return res
                    .status(400)
                    .send('Falta URL');
            }

            console.log(
                'Canal 7 subplaylist:',
                subUrl
            );

            const response =
                await axios.get(
                    subUrl,
                    {
                        httpsAgent:
                            httpsAgent,

                        headers: {

                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',

                            'Accept':
                                'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                            'Referer':
                                'https://www.antena7.com.do/',

                            'Origin':
                                'https://www.antena7.com.do'
                        },

                        timeout: 20000,

                        validateStatus:
                            () => true
                    }
                );

            console.log(
                'Canal 7 subplaylist HTTP:',
                response.status
            );

            if (response.status !== 200) {

                throw new Error(
                    `Subplaylist HTTP ${response.status}`
                );
            }

            const baseUrl =
                new URL(subUrl);

            const lineas =
                response.data.split(/\r?\n/);

            const resultado = [];

            for (const linea of lineas) {

                const texto =
                    linea.trim();

                if (!texto) {

                    resultado.push('');

                    continue;
                }

                if (texto.startsWith('#')) {

                    resultado.push(texto);

                    continue;
                }

                const urlAbsoluta =
                    new URL(
                        texto,
                        baseUrl
                    ).href;

                if (
                    texto.includes('.m3u8')
                ) {

                    resultado.push(
                        '/api/canal7/subplaylist?url=' +
                        encodeURIComponent(
                            urlAbsoluta
                        )
                    );

                } else {

                    resultado.push(
                        '/api/canal7/proxy?url=' +
                        encodeURIComponent(
                            urlAbsoluta
                        )
                    );
                }
            }

            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            return res.send(
                resultado.join('\n')
            );

        } catch (error) {

            console.log(
                'Error subplaylist Canal 7:',
                error.message
            );

            return res
                .status(502)
                .send(
                    'Error subplaylist Canal 7'
                );
        }
    }
);

// ======================================================
// CANAL 7 - PROXY
// ======================================================

app.get(
    '/api/canal7/proxy',
    async (req, res) => {

        try {

            const url =
                req.query.url;

            if (!url) {

                return res
                    .status(400)
                    .send('Falta URL');
            }

            const response =
                await axios.get(
                    url,
                    {
                        responseType:
                            'arraybuffer',

                        httpsAgent:
                            httpsAgent,

                        headers: {

                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',

                            'Accept':
                                '*/*',

                            'Referer':
                                'https://www.antena7.com.do/',

                            'Origin':
                                'https://www.antena7.com.do'
                        },

                        timeout: 30000,

                        maxRedirects: 10,

                        validateStatus:
                            () => true
                    }
                );

            if (response.status !== 200) {

                console.log(
                    'Canal 7 segmento HTTP:',
                    response.status
                );

                return res
                    .status(502)
                    .send(
                        'Error segmento Canal 7 HTTP ' +
                        response.status
                    );
            }

            res.setHeader(
                'Content-Type',
                'video/mp2t'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache'
            );

            return res.send(
                response.data
            );

        } catch (error) {

            console.log(
                'Error proxy Canal 7:',
                error.message
            );

            return res
                .status(502)
                .send(
                    'Error segmento Canal 7'
                );
        }
    }
);

// ======================================================
// CANAL 7 PRINCIPAL
// ======================================================

app.get(
    '/api/canal7',
    async (req, res) => {

        try {

            console.log(
                'Solicitud recibida para Canal 7'
            );

            const playlist =
                await obtenerPlaylistCanal7();

            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl'
            );

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            return res.send(
                playlist
            );

        } catch (error) {

            console.log(
                'Error Canal 7:',
                error.message
            );

            return res
                .status(502)
                .send(
                    'Error Canal 7: ' +
                    error.message
                );
        }
    }
);

// ======================================================
// INICIO DEL SERVIDOR
// ======================================================

app.get('/', (req, res) => {

    res.send(
        'ROKU Backend RD funcionando correctamente'
    );
});

app.listen(PORT, () => {

    console.log(
        `Servidor activo en el puerto ${PORT}`
    );
});
