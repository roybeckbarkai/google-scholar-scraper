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
const PORT = 3002;

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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
      const venueYear = $(el).find('.gs_gray').last().text();
      const citations = $(el).find('.gsc_a_ac').text() || '0';
      
      const yearPart = venueYear.match(/\d{4}$/);
      const year = yearPart ? yearPart[0] : '';
      const venue = venueYear.replace(/,?\s*\d{4}$/, '').trim();

      publications.push({
        id: `pub-${i}-${Date.now()}`,
        title,
        authors,
        venue,
        year,
        citations,
        link,
        doi: ''
      });
    });

    res.json({ profileName, publications });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: 'Failed to scrape Google Scholar: ' + error.message });
  }
});

// Save publications to a named JSON file
app.post('/api/save', async (req, res) => {
  try {
    const { publications, profileName, filename } = req.body;
    const safeFilename = path.basename(filename || 'publications.json');
    if (!safeFilename.endsWith('.json')) {
      return res.status(400).json({ error: 'Filename must end with .json' });
    }
    
    if (!fs.existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
    
    const filePath = path.join(DATA_DIR, safeFilename);
    const data = {
      profileName,
      publications,
      lastUpdated: new Date().toISOString()
    };
    
    await writeFile(filePath, JSON.stringify(data, null, 2));
    res.json({ message: 'Dataset saved successfully!', filename: safeFilename });
  } catch (err) {
    console.error('Save failed', err);
    res.status(500).json({ error: 'Failed to save dataset locally.' });
  }
});

// Load publications from a named JSON file
app.get('/api/load', async (req, res) => {
  try {
    const filename = req.query.filename || 'publications.json';
    const safeFilename = path.basename(filename);
    const filePath = path.join(DATA_DIR, safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Specified dataset file not found.' });
    }
    
    const content = await readFile(filePath, 'utf8');
    res.json(JSON.parse(content));
  } catch (err) {
    console.error('Load failed', err);
    res.status(500).json({ error: 'Failed to load dataset.' });
  }
});

// List all saved JSON files
app.get('/api/files', async (req, res) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return res.json({ files: [] });
    }
    
    const items = await readdir(DATA_DIR);
    const files = [];
    for (const item of items) {
      if (item.endsWith('.json')) {
        const stats = await stat(path.join(DATA_DIR, item));
        files.push({
          name: item,
          modified: stats.mtime.getTime()
        });
      }
    }
      
    files.sort((a, b) => b.modified - a.modified);
      
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list saved files.' });
  }
});

// Search for DOI using Crossref API
app.post('/api/doi', async (req, res) => {
  const { title, venue } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const query = `${title} ${venue || ''}`;
    const response = await axios.get('https://api.crossref.org/works', {
      params: {
        query: query,
        rows: 1
      },
      headers: {
        'User-Agent': 'ScholarScraper/1.0 (mailto:scholar@example.com)'
      }
    });

    const items = response.data?.message?.items;
    if (items && items.length > 0) {
      const bestMatch = items[0];
      const matchTitle = (bestMatch.title?.[0] || '').toLowerCase();
      if (matchTitle.includes(title.toLowerCase().substring(0, 20))) {
        const fullAuthors = bestMatch.author 
          ? bestMatch.author.map(a => `${a.family}, ${a.given || ''}`).join('; ')
          : null;
          
        return res.json({ 
          doi: bestMatch.DOI,
          authors: fullAuthors
        });
      }
    }
    res.status(404).json({ error: 'No DOI found for this publication.' });
  } catch (error) {
    console.error('DOI search error:', error.message);
    res.status(500).json({ error: 'Crossref API failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
