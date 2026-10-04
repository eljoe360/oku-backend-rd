const puppeteer = require('puppeteer');

async function obtenerUrlCanal(urlPagina) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    let streamUrl = null;

    // Escuchar el tráfico de red para encontrar el manifiesto .m3u8
    page.on('request', request => {
      const reqUrl = request.url();
      if ((reqUrl.includes('.m3u8') || reqUrl.includes('/playlist/')) && !streamUrl) {
        streamUrl = reqUrl;
        console.log('¡Enlace M3U8 capturado!:', streamUrl);
      }
    });

    await page.goto(urlPagina, { waitUntil: 'networkidle2', timeout: 35000 });
    return streamUrl;
  } catch (error) {
    console.error('Error al extraer el canal:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { obtenerUrlCanal };
