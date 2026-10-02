const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

// Extraer URL .m3u8 en vivo desde DailyMotion
async function obtenerStreamDailymotion(idVideo) {
    try {
        const response = await axios.get(`https://www.dailymotion.com/player/metadata/video/${idVideo}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 4000
        });
        
        if (response.data && response.data.qualities && response.data.qualities.auto) {
            return response.data.qualities.auto[0].url;
        }
    } catch (error) {
        console.error(`Error en Dailymotion (${idVideo}):`, error.message);
    }
    return null;
}

// Extraer sesión de Telemicro
async function obtenerStreamTelemicro(paginaUrl) {
    try {
        const response = await axios.get(paginaUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 4000
        });

        const html = response.data;
        const match = html.match(/https?:\/\/[^"'\s]+\.(?:m3u8)(?:\?[^"'\s]+)?/i);

        if (match) {
            return match[0];
        }
    } catch (error) {
        console.error(`Error al extraer Telemicro:`, error.message);
    }
    return "https://live2.telemicro.com.do/live/55/chunks.m3u8";
}

app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let canales = response.data;
        if (typeof canales === 'string') {
            canales = JSON.parse(canales);
        }

        const hoy = new Date().toISOString().split('T')[0];

        // Filtrar canales no vencidos
        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return canal.vencimiento >= hoy;
        });

        // Procesar resolución dinámica de fuentes
        const canalesProcesados = await Promise.all(
            canalesValidos.map(async (canal) => {
                let canalCopia = { ...canal };

                if (canalCopia.dailymotion_id) {
                    const urlFresca = await obtenerStreamDailymotion(canalCopia.dailymotion_id);
                    if (urlFresca) {
                        canalCopia.url = urlFresca;
                    }
                }
                
                if (canalCopia.telemicro_web) {
                    const urlFresca = await obtenerStreamTelemicro(canalCopia.telemicro_web);
                    if (urlFresca) {
                        canalCopia.url = urlFresca;
                    }
                }

                // Respaldo de seguridad para que NUNCA quede vacía la URL
                if (!canalCopia.url) {
                    canalCopia.url = "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8";
                }

                return canalCopia;
            })
        );

        res.json(canalesProcesados);
    } catch (error) {
        console.error('Error al procesar los canales:', error.message);
        res.status(500).json({ error: 'Error al obtener la lista de canales' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
