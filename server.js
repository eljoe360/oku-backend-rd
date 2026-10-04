const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Lista completa de canales en el formato exacto que lee tu App de Roku
const listaCanales = [
  {
    "numero": 1,
    "id": "sitv",
    "nombre": "SI TV",
    "url": "http://190.122.104.210:5080/LiveApp/streams/sitv2.m3u8"
  },
  {
    "numero": 4,
    "id": "canal4",
    "nombre": "Canal 4 RD",
    "url": "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8"
  },
  {
    "numero": 5,
    "id": "telemicro",
    "nombre": "Telemicro Canal 5",
    "telemicro_web": true
  },
  {
    "numero": 6,
    "id": "canal6",
    "nombre": "Canal 6",
    "canal6_web": true
  },
  {
    "numero": 7,
    "id": "canal7",
    "nombre": "Antena 7",
    "canal7_web": true
  },
  {
    "numero": 8,
    "id": "canal8",
    "nombre": "Telemedios Canal 8",
    "canal8_web": true
  },
  {
    "numero": 9,
    "id": "canal9",
    "nombre": "Color Visión Canal 9",
    "canal9_web": true
  },
  {
    "numero": 10,
    "id": "canal10",
    "nombre": "Canal 10",
    "canal10_web": true
  },
  {
    "numero": 11,
    "id": "canal11",
    "nombre": "Telesistema 11 (TV)",
    "url": "https://oku-backend-rd.onrender.com/live/telesistema"
  },
  {
    "numero": 12,
    "id": "canal12",
    "nombre": "Canal 12",
    "canal12_web": true
  },
  {
    "numero": 13,
    "id": "canal13",
    "nombre": "Telecentro Canal 13",
    "canal13_web": true
  },
  {
    "numero": 15,
    "id": "canal15",
    "nombre": "Digital 15",
    "canal15_web": true
  },
  {
    "numero": 18,
    "id": "canal18",
    "nombre": "AME 47 Canal 18",
    "canal18_web": true
  },
  {
    "numero": 19,
    "id": "canal19",
    "nombre": "TV HD Live 19",
    "canal19_web": true
  },
  {
    "numero": 21,
    "id": "canal21",
    "nombre": "Canal 21",
    "canal21_web": true
  },
  {
    "numero": 23,
    "id": "canal23",
    "nombre": "Canal 23",
    "canal23_web": true
  }
];

// 1. Ruta raíz que consulta tu TV/Roku para obtener la lista
app.get('/', (req, res) => {
  res.json(listaCanales);
});

// 2. Extractor rápido para Telesistema (Dailymotion)
app.get('/live/telesistema', async (req, res) => {
  const videoId = 'x80ac48';
  const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;

  try {
    const response = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const m3u8Url = response.data?.qualities?.auto?.[0]?.url;

    if (m3u8Url) {
      return res.redirect(m3u8Url);
    } else {
      return res.status(500).json({ error: 'No se pudo obtener el stream M3U8.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error de conexion con Dailymotion.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
