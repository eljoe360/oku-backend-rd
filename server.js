const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL =
    'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

const TELEMICRO_PLAYLIST =
    'https://live2.telemicro.com.do/live/55/playlist.m3u8';

const TELEMICRO_BASE =
    'https://live2.telemicro.com.do/live/55/';


// ======================================================
// OBTENER STREAM DINÁMICO DE TELEMICRO
// ======================================================
async function obtenerStreamTelemicro() {

    try {

        // ------------------------------------------------
        // 1. Abrir página de Telemicro para obtener cookies
        // ------------------------------------------------
        const sessionRes = await axios.get(
            'https://telemicro.com.do/telemicro-en-vivo/',
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                    'Accept':
                        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },

                timeout: 10000,

                // No necesitamos seguir redirecciones manualmente aquí
                maxRedirects: 5
            }
        );


        // ------------------------------------------------
        // 2. Obtener cookies
        // ------------------------------------------------
        const cookies =
            sessionRes.headers['set-cookie']
                ? sessionRes.headers['set-cookie'].join('; ')
                : '';


        console.log(
            'Cookies Telemicro:',
            cookies ? 'OBTENIDAS' : 'NINGUNA'
        );


        // ------------------------------------------------
        // 3. Pedir playlist principal
        // ------------------------------------------------
        const playlistRes = await axios.get(
            TELEMICRO_PLAYLIST,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',

                    'Accept':
                        'application/vnd.apple.mpegurl, application/x-mpegURL, */*',

                    'Referer':
                        'https://telemicro.com.do/',

                    'Origin':
                        'https://telemicro.com.do/',

                    'Cookie':
                        cookies
                },

                timeout: 10000,

                maxRedirects: 5,

                validateStatus: () => true
            }
        );


        console.log(
            'Respuesta playlist Telemicro:',
            playlistRes.status
        );


        // ------------------------------------------------
        // 4. Verificar respuesta
        // ------------------------------------------------
        if (
            playlistRes.status < 200 ||
            playlistRes.status >= 300
        ) {

            throw new Error(
                `Telemicro respondió HTTP ${playlistRes.status}`
            );
        }


        const playlist =
            typeof playlistRes.data === 'string'
                ? playlistRes.data
                : String(playlistRes.data);


        console.log(
            'Playlist recibida:',
            playlist.substring(0, 500)
        );


        // ------------------------------------------------
        // 5. Buscar chunks.m3u8
        // ------------------------------------------------
        const match =
            playlist.match(
                /(?:https?:\/\/[^"\s]+\/)?chunks\.m3u8(?:\?[^"\s]+)?/i
            );


        if (match && match[0]) {

            let streamUrl = match[0];


            // Si la URL viene relativa
            if (streamUrl.startsWith('/')) {

                streamUrl =
                    'https://live2.telemicro.com.do' +
                    streamUrl;
            }


            // Si solamente devuelve chunks.m3u8?...
            else if (
                streamUrl.startsWith('chunks.m3u8')
            ) {

                streamUrl =
                    TELEMICRO_BASE +
                    streamUrl;
            }


            console.log(
                'STREAM TELEMICRO ENCONTRADO:',
                streamUrl
            );


            return streamUrl;
        }


        // ------------------------------------------------
        // 6. Intentar buscar directamente nimblesessionid
        // ------------------------------------------------
        const sessionMatch =
            playlist.match(
                /nimblesessionid[=:%]\s*(\d+)/i
            );


        if (sessionMatch && sessionMatch[1]) {

            const sessionId =
                sessionMatch[1];


            const streamUrl =
                `${TELEMICRO_BASE}chunks.m3u8?nimblesessionid=${sessionId}`;


            console.log(
                'STREAM TELEMICRO POR SESSION ID:',
                streamUrl
            );


            return streamUrl;
        }


        throw new Error(
            'No se encontró chunks.m3u8 ni nimblesessionid en la playlist'
        );

    }

    catch (error) {

        console.error(
            'Error obteniendo Telemicro:',
            error.message
        );

        return null;
    }
}



// ======================================================
// API DE CANALES
// ======================================================
app.get('/api/canales', async (req, res) => {

    try {

        // ------------------------------------------------
        // Descargar channels.json desde GitHub
        // ------------------------------------------------
        const response =
            await axios.get(
                GITHUB_JSON_URL,
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0'
                    },

                    timeout: 10000
                }
            );


        let canales =
            typeof response.data === 'string'
                ? JSON.parse(response.data)
                : response.data;


        // ------------------------------------------------
        // Fecha actual
        // ------------------------------------------------
        const hoy =
            new Date()
                .toISOString()
                .split('T')[0];


        // ------------------------------------------------
        // Filtrar canales vigentes
        // ------------------------------------------------
        const vigentes =
            canales.filter(
                canal =>
                    !canal.vencimiento ||
                    canal.vencimiento >= hoy
            );


        // ------------------------------------------------
        // Procesar canales
        // ------------------------------------------------
        const resultados =
            await Promise.all(

                vigentes.map(
                    async canal => {

                        const c = {
                            ...canal
                        };


                        // ==================================
                        // TELEMICRO
                        // ==================================
                        if (c.telemicro_web) {

                            console.log(
                                'Buscando nueva sesión de Telemicro...'
                            );


                            const nuevaUrl =
                                await obtenerStreamTelemicro();


                            if (nuevaUrl) {

                                c.url =
                                    nuevaUrl;

                            } else {

                                // No mandamos una URL vieja.
                                // Dejamos el canal sin URL
                                // para que Roku pueda reintentar.
                                c.url = '';
                            }
                        }


                        return c;
                    }
                )
            );


        // ------------------------------------------------
        // Respuesta
        // ------------------------------------------------
        res.json(resultados);

    }

    catch (error) {

        console.error(
            'Error general en backend:',
            error.message
        );


        res.status(500).json(
            {
                error:
                    'Error al procesar la lista de canales'
            }
        );
    }
});



// ======================================================
// PRUEBA DIRECTA DE TELEMIICRO
// ======================================================
app.get('/api/telemicro', async (req, res) => {

    const url =
        await obtenerStreamTelemicro();


    if (!url) {

        return res.status(503).json(
            {
                ok: false,
                error:
                    'No se pudo obtener el stream de Telemicro'
            }
        );
    }


    res.json(
        {
            ok: true,
            url: url
        }
    );
});



// ======================================================
// INICIAR SERVIDOR
// ======================================================
app.listen(
    PORT,
    () => {

        console.log(
            `Servidor activo en el puerto ${PORT}`
        );

    }
);
