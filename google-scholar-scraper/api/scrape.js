import axios from 'axios';
import * as cheerio from 'cheerio';

class ScholarBlockedError extends Error {
  constructor(statusCode) {
    super(
      `Google Scholar blocked the request${statusCode ? ` (upstream ${statusCode})` : ''}. ` +
      'This is common on Vercel/serverless IPs. Configure SCHOLAR_FETCH_URL_TEMPLATE to send Scholar requests through a proxy, or run the scraper from a non-datacenter IP.'
    );
    this.name = 'ScholarBlockedError';
    this.statusCode = statusCode;
  }
}

function buildBrowserHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://scholar.google.com/',
    'Cookie': 'CONSENT=YES+cb'
  };
}

function buildScholarPageUrl(userId, hl, cstart, pagesize) {
  return `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=${encodeURIComponent(hl)}&cstart=${cstart}&pagesize=${pagesize}`;
}

function buildFetchUrl(pageUrl) {
  const template = process.env.SCHOLAR_FETCH_URL_TEMPLATE;
  if (!template) {
    return pageUrl;
  }

  return template.replace('{url}', encodeURIComponent(pageUrl));
}

function looksBlocked(status, html) {
  const body = typeof html === 'string' ? html.toLowerCase() : '';

  return (
    status === 403 ||
    status === 429 ||
    body.includes('/sorry/') ||
    body.includes('our systems have detected unusual traffic') ||
    body.includes('not a robot') ||
    body.includes('captcha')
  );
}

async function fetchScholarPage(pageUrl, headers) {
  const response = await axios.get(buildFetchUrl(pageUrl), {
    headers,
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true
  });

  if (looksBlocked(response.status, response.data)) {
    throw new ScholarBlockedError(response.status);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.data;
}

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

  const headers = buildBrowserHeaders();

  try {
    const publications = [];
    let profileName = '';
    let cstart = 0;
    const pagesize = 100;

    // Paginate until no more results
    while (true) {
      const pageUrl = buildScholarPageUrl(userId, hl, cstart, pagesize);
      const html = await fetchScholarPage(pageUrl, headers);
      const $ = cheerio.load(html);

      // Extract profile name from first page only
      if (cstart === 0) {
        profileName = $('#gsc_prf_in').text();
      }

      const rows = $('.gsc_a_tr');
      if (rows.length === 0) {
        if (cstart === 0 && !profileName) {
          throw new Error('Google Scholar returned an unexpected page. The markup may have changed or the response may have been filtered by an upstream proxy.');
        }
        break;
      }

      rows.each((i, el) => {
        const titleLink = $(el).find('.gsc_a_at');
        const title = titleLink.text();
        const href = titleLink.attr('href');
        const link = href ? 'https://scholar.google.com' + href : '';
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
    const statusCode = error instanceof ScholarBlockedError ? 502 : 500;
    res.status(statusCode).json({ error: 'Failed to scrape Google Scholar: ' + error.message });
  }
}
