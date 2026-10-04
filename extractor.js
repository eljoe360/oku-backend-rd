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
        '--single-process',
        '--no-first-run',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();
    
    // User-Agent real para evitar bloqueos anti-bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let streamUrl = null;

    // Escuchar las peticiones para detectar .m3u8 o manifest
    page.on('request', request => {
      const reqUrl = request.url();
      if ((reqUrl.includes('.m3u8') || reqUrl.includes('playlist.m3u8') || reqUrl.includes('manifest')) && !streamUrl) {
        streamUrl = reqUrl;
        console.log('¡Enlace M3U8 capturado!:', streamUrl);
      }
    });

    await page.goto(urlPagina, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Esperamos 5 segundos para darle tiempo al reproductor JS de cargar el flujo
    await new Promise(resolve => setTimeout(resolve, 5000));

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
