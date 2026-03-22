import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Extract user ID
    const urlObj = new URL(url);
    const userId = urlObj.searchParams.get('user');
    
    if (!userId) {
      return res.status(400).json({ error: 'Invalid Google Scholar URL. "user" parameter missing.' });
    }

    // Google Scholar pagination: &cstart=0&pagesize=100
    // For this tool, we'll fetch the first 100 results for speed, 
    // but could be expanded to fetch more.
    const scrapeUrl = `https://scholar.google.com/citations?user=${userId}&hl=en&cstart=0&pagesize=100`;
    
    const response = await axios.get(scrapeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const profileName = $('#gsc_prf_in').text();
    const publications = [];

    $('.gsc_a_tr').each((i, el) => {
      const titleLink = $(el).find('.gsc_a_at');
      const title = titleLink.text();
      const link = 'https://scholar.google.com' + titleLink.attr('href');
      const authors = $(el).find('.gs_gray').first().text();
      const venueAndYear = $(el).find('.gs_gray').last().text();
      
      // Venue is usually before the year or comma
      const venueMatch = venueAndYear.match(/^(.*),\s*\d{4}$/) || [null, venueAndYear];
      const venue = venueMatch[1] || venueAndYear;
      
      const citations = $(el).find('.gsc_a_ac').text() || '0';
      const year = $(el).find('.gsc_a_y').text();

      publications.push({
        id: `gs-${i}`,
        title,
        authors,
        venue,
        year,
        citations,
        link,
        doi: '', // Google Scholar doesn't provide DOI on this page
        isLead: false, // Will be calculated on frontend
        isOther: false, // Will be calculated on frontend
        isPreprint: false // Will be calculated on frontend
      });
    });

    res.json({
      profileName,
      publications
    });

  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: 'Failed to scrape Google Scholar. ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
