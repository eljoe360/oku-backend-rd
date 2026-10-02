const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Enlace RAW a tu lista de canales en channels.roku
const CHANNELS_URL = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(CHANNELS_URL);
        const canales = response.data;
        const hoy = new Date();

        // Filtra omitiendo los canales con fecha de vencimiento pasada
        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return new Date(canal.vencimiento) >= hoy;
        });

        res.json(canalesValidos);
    } catch (error) {
        console.error('Error al obtener canales:', error.message);
        res.status(500).json({ error: 'Error al obtener la lista de canales' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});
