import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, venue } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const query = `${title} ${venue || ''}`;
    const response = await axios.get('https://api.crossref.org/works', {
      params: { query, rows: 1 },
      headers: { 'User-Agent': 'ScholarScraper/1.0 (mailto:scholar@example.com)' }
    });

    const items = response.data?.message?.items;
    if (items && items.length > 0) {
      const bestMatch = items[0];
      const matchTitle = (bestMatch.title?.[0] || '').toLowerCase();
      if (matchTitle.includes(title.toLowerCase().substring(0, 20))) {
        const fullAuthors = bestMatch.author
          ? bestMatch.author.map(a => `${a.family || ''}, ${a.given || ''}`).join('; ')
          : null;

        return res.json({ doi: bestMatch.DOI, authors: fullAuthors });
      }
    }

    res.status(404).json({ error: 'No DOI found for this publication.' });
  } catch (error) {
    console.error('DOI error:', error.message);
    res.status(500).json({ error: 'Crossref API failed' });
  }
}
