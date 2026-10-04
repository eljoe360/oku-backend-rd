const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // O usa fetch nativo si estás en Node 18+

const app = express();
app.use(cors());
app.use(express.json());

// Lista completa de canales del 1 al 49 sincronizada con el JSON
const channelsData = [
  { numero: 1, id: "sitv", nombre: "SI TV", url: "http://190.122.104.210:5080/LiveApp/streams/sitv2.m3u8" },
  { numero: 2, id: "canal2", nombre: "Canal 2", canal2_web: true },
  { numero: 3, id: "canal3", nombre: "Canal 3", canal3_web: true },
  { numero: 4, id: "canal4", nombre: "Canal 4 RD", url: "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8" },
  { numero: 5, id: "telemicro", nombre: "Telemicro Canal 5", telemicro_web: true },
  { numero: 6, id: "canal6", nombre: "Canal 6", canal6_web: true },
  { numero: 7, id: "canal7", nombre: "Antena 7", canal7_web: true },
  { numero: 8, id: "canal8", nombre: "Telemedios Canal 8", canal8_web: true },
  { numero: 9, id: "canal9", nombre: "Color Visión Canal 9", canal9_web: true },
  { numero: 10, id: "canal10", nombre: "Canal 10", canal10_web: true },
  { numero: 11, id: "canal11", nombre: "Telesistema 11 (TV)", canal11_web: true },
  { numero: 12, id: "canal12", nombre: "Canal 12", canal12_web: true },
  { numero: 13, id: "canal13", nombre: "Telecentro Canal 13", canal13_web: true },
  { numero: 14, id: "canal14", nombre: "Canal 14", canal14_web: true },
  { numero: 15, id: "canal15", nombre: "Digital 15", canal15_web: true },
  { numero: 16, id: "canal16", nombre: "Canal 16", canal16_web: true },
  { numero: 17, id: "canal17", nombre: "Canal 17", canal17_web: true },
  { numero: 18, id: "canal18", nombre: "AME 47 Canal 18", canal18_web: true },
  { numero: 19, id: "canal19", nombre: "TV HD Live 19", canal19_web: true },
  { numero: 20, id: "canal20", nombre: "Canal 20", canal20_web: true },
  { numero: 21, id: "canal21", nombre: "Canal 21", canal21_web: true },
  { numero: 22, id: "canal22", nombre: "Canal 22", canal22_web: true },
  { numero: 23, id: "canal23", nombre: "Canal 23", canal23_web: true },
  { numero: 24, id: "canal24", nombre: "Canal 24", canal24_web: true },
  { numero: 25, id: "canal25", nombre: "Canal 25", canal25_web: true },
  { numero: 26, id: "canal26", nombre: "Canal 26", canal26_web: true },
  { numero: 27, id: "canal27", nombre: "Canal 27", canal27_web: true },
  { numero: 28, id: "canal28", nombre: "Canal 28", canal28_web: true },
  { numero: 29, id: "canal29", nombre: "Canal 29", canal29_web: true },
  { numero: 30, id: "canal30", nombre: "Canal 30", canal30_web: true },
  { numero: 31, id: "canal31", nombre: "Canal 31", canal31_web: true },
  { numero: 32, id: "canal32", nombre: "Canal 32", canal32_web: true },
  { numero: 33, id: "canal33", nombre: "Canal 33", canal33_web: true },
  { numero: 34, id: "canal34", nombre: "Canal 34", canal34_web: true },
  { numero: 35, id: "canal35", nombre: "Canal 35", canal35_web: true },
  { numero: 36, id: "canal36", nombre: "Canal 36", canal36_web: true },
  { numero: 37, id: "canal37", nombre: "Canal 37", canal37_web: true },
  { numero: 38, id: "canal38", nombre: "Canal 38", canal38_web: true },
  { numero: 39, id: "canal39", nombre: "Canal 39", canal39_web: true },
  { numero: 40, id: "canal40", nombre: "Canal 40", canal39_web: true }, // Ajustado por coherencia si aplica
  { numero: 41, id: "canal41", nombre: "Canal 41", canal41_web: true },
  { numero: 42, id: "canal42", nombre: "Canal 42", canal42_web: true },
  { numero: 43, id: "canal43", nombre: "Canal 43", canal43_web: true },
  { numero: 44, id: "canal44", nombre: "Canal 44", canal44_web: true },
  { numero: 45, id: "canal45", nombre: "Canal 45", canal45_web: true },
  { numero: 46, id: "canal46", nombre: "Canal 46", canal46_web: true },
  { numero: 47, id: "canal47", nombre: "Canal 47", canal47_web: true },
  { numero: 48, id: "canal48", nombre: "Canal 48", canal48_web: true },
  { numero: 49, id: "canal49", nombre: "Canal 49", canal49_web: true }
];

// Ruta para obtener la lista completa de canales para la app de Roku
app.get('/channels', (req, res) => {
  res.json(channelsData);
});

// Endpoint opcional para manejar la resolución de enlaces dinámicos o flujos si tu aplicación Roku lo requiere
app.get('/stream/:id', async (req, res) => {
  const { id } = req.params;
  const channel = channelsData.find(c => c.id === id);

  if (!channel) {
    return res.status(404).json({ error: 'Canal no encontrado' });
  }

  // Si el canal tiene una URL directa, la devolvemos
  if (channel.url) {
    return res.json({ url: channel.url });
  }

  // Si maneja lógica web interna o scraping, puedes estructurarlo aquí
  res.json({ message: `Canal ${channel.nombre} configurado vía web.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
