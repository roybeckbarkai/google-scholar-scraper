import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  const userId = urlObj.searchParams.get('user');
  const hl = urlObj.searchParams.get('hl') || 'en';
  if (!userId) {
    return res.status(400).json({ error: 'Invalid Google Scholar URL. "user" parameter missing.' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    const publications = [];
    let profileName = '';
    let cstart = 0;
    const pagesize = 100;

    // Paginate until no more results
    while (true) {
      const pageUrl = `https://scholar.google.com/citations?user=${userId}&hl=${hl}&cstart=${cstart}&pagesize=${pagesize}`;
      const response = await axios.get(pageUrl, { headers });
      const $ = cheerio.load(response.data);

      // Extract profile name from first page only
      if (cstart === 0) {
        profileName = $('#gsc_prf_in').text();
      }

      const rows = $('.gsc_a_tr');
      if (rows.length === 0) break; // No more results

      rows.each((i, el) => {
        const titleLink = $(el).find('.gsc_a_at');
        const title = titleLink.text();
        const link = 'https://scholar.google.com' + titleLink.attr('href');
        const authors = $(el).find('.gs_gray').first().text();
        const venueYear = $(el).find('.gs_gray').last().text();
        const citations = $(el).find('.gsc_a_ac').text() || '0';

        const yearPart = venueYear.match(/\d{4}$/);
        const year = yearPart ? yearPart[0] : '';
        const venue = venueYear.replace(/,?\s*\d{4}$/, '').trim();

        publications.push({
          id: `pub-${cstart + i}-${Date.now()}`,
          title,
          authors,
          venue,
          year,
          citations,
          link,
          doi: ''
        });
      });

      // If fewer than pagesize results, we've reached the end
      if (rows.length < pagesize) break;
      cstart += pagesize;

      // Safety cap to avoid infinite loops
      if (cstart > 2000) break;
    }

    res.json({ profileName, publications });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: 'Failed to scrape Google Scholar: ' + error.message });
  }
}
