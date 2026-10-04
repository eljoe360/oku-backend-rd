const puppeteer = require('puppeteer');

async function obtenerUrlCanal(urlPagina) {
  // Iniciamos el navegador en modo headless (sin interfaz visual)
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let streamUrl = null;

  // Escuchamos las peticiones de red que realiza la página
  page.on('request', request => {
    const reqUrl = request.url();
    // Filtramos para capturar archivos de transmisión (.m3u8)
    if (reqUrl.includes('.m3u8') && !streamUrl) {
      streamUrl = reqUrl;
      console.log('¡Enlace extraído con éxito!:', streamUrl);
    }
  });

  try {
    // Navegamos a la URL del canal esperando a que cargue la red
    await page.goto(urlPagina, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (error) {
    console.error('Error al cargar la página:', error.message);
  } finally {
    await browser.close();
  }

  return streamUrl;
}

// Reemplaza con la URL web del canal que quieras probar
const canalUrl = 'https://telesistema11.com.do/';
obtenerUrlCanal(canalUrl);
