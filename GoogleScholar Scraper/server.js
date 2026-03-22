import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'publications.json');

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

// Save dataset locally
app.post('/api/save', async (req, res) => {
  try {
    const { profileName, publications } = req.body;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify({ profileName, publications, lastSaved: new Date() }, null, 2));
    res.json({ message: 'Dataset saved successfully' });
  } catch (error) {
    console.error('Save error:', error.message);
    res.status(500).json({ error: 'Failed to save dataset: ' + error.message });
  }
});

// Load dataset locally
app.get('/api/load', async (req, res) => {
  try {
    const data = await readFile(DATA_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'No saved dataset found.' });
    }
    console.error('Load error:', error.message);
    res.status(500).json({ error: 'Failed to load dataset: ' + error.message });
  }
});

// Lookup DOI using Crossref API
app.post('/api/doi', async (req, res) => {
  const { title, venue } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    // Crossref API search
    const query = encodeURIComponent(`${title} ${venue || ''}`);
    const response = await axios.get(`https://api.crossref.org/works?query.bibliographic=${query}&rows=1`, {
      headers: { 'User-Agent': 'ScholarScraper/1.0 (mailto:scholar@example.com)' }
    });

    const items = response.data?.message?.items;
    if (items && items.length > 0) {
      const bestMatch = items[0];
      // Basic check: title should match reasonably well
      const matchTitle = bestMatch.title?.[0]?.toLowerCase() || '';
      if (matchTitle.includes(title.toLowerCase().substring(0, 20))) {
        return res.json({ doi: bestMatch.DOI });
      }
    }
    res.status(404).json({ error: 'No DOI found for this publication.' });
  } catch (error) {
    console.error('DOI error:', error.message);
    res.status(500).json({ error: 'Failed to lookup DOI: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
