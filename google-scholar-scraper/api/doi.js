import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, venue, doi } = req.body;

  if (doi) {
    try {
      const normalizedDoi = String(doi).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      const response = await axios.get(`https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}`, {
        headers: { 'User-Agent': 'ScholarScraper/1.0 (mailto:scholar@example.com)' }
      });

      const item = response.data?.message;
      if (!item) return res.status(404).json({ error: 'DOI metadata not found.' });

      const authors = item.author
        ? item.author
            .map(a => [a.given, a.family].filter(Boolean).join(' ').trim())
            .filter(Boolean)
            .join(', ')
        : '';

      const venueName = item['container-title']?.[0] || item.publisher || '';
      const year =
        item.issued?.['date-parts']?.[0]?.[0] ||
        item.published?.['date-parts']?.[0]?.[0] ||
        item.created?.['date-parts']?.[0]?.[0] ||
        '';

      return res.json({
        doi: item.DOI || normalizedDoi,
        title: item.title?.[0] || '',
        authors,
        venue: venueName,
        year: String(year || ''),
        link: item.URL || `https://doi.org/${item.DOI || normalizedDoi}`
      });
    } catch (error) {
      console.error('DOI metadata error:', error.message);
      return res.status(404).json({ error: 'Could not retrieve publication details for this DOI.' });
    }
  }

  if (!title) return res.status(400).json({ error: 'Title is required when DOI is not provided.' });

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
