import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Download, Trash2, Check, AlertCircle, Loader2, User, BookOpen, FileText, Calendar, FileJson, ChevronRight } from 'lucide-react';

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [publications, setPublications] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState(new Set());
  const fileInputRef = React.useRef(null);
  
  // New entry state
  const [newEntry, setNewEntry] = useState({
    title: '',
    authors: '',
    venue: '',
    year: new Date().getFullYear().toString(),
    citations: '0',
    link: '',
    doi: ''
  });

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Server returned an invalid response. Please check if the backend is running.');
      }
      
      if (!response.ok || data.error) throw new Error(data.error || `Server error: ${response.status}`);
      
      setProfileName(data.profileName);
      
      // Auto-populate checkboxes based on profile name
      const processed = data.publications.map(pub => {
        const isLead = isFirstAuthor(pub.authors, data.profileName);
        const isPreprint = isPreprintVenue(pub.venue);
        
        return { ...pub, isLead, isPreprint };
      });
      
      setPublications(processed);
      
      // Start auto-enrichment
      autoEnrich(processed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save: trigger browser file download
  const handleSave = () => {
    const date = new Date().toISOString().split('T')[0];
    const filename = profileName
      ? `${String(profileName).replace(/\s+/g, '_')}_${date}.json`
      : `publications_${date}.json`;
    const data = { profileName, publications, lastUpdated: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load: open file picker
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  // Handle file selected in picker
  const handleFileLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setProfileName(data.profileName || '');
        setPublications(Array.isArray(data.publications) ? data.publications : []);
      } catch {
        setError('Failed to parse file. Make sure it is a valid dataset JSON.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-loaded
    e.target.value = '';
  };


  const autoEnrich = async (pubs) => {
    for (const pub of pubs) {
      if (!pub.doi) {
        await fetchDOI(pub.id, pub.title, pub.venue);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  };

  const fetchDOI = async (id, title, venue) => {
    setEnrichingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch('/api/doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, venue })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        return; // Silent fail for auto-enrichment
      }

      if (data.doi) {
        setPublications(prev => prev.map(p => p.id === id ? { 
          ...p, 
          doi: data.doi,
          authors: data.authors || p.authors
        } : p));
      }
    } catch (err) {
      console.error('DOI fetch failed', err);
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const isAuthor = (authorList, profile) => {
    if (!profile || !authorList) return false;
    const profileStr = String(profile);
    const lastName = profileStr.includes(' ') ? profileStr.split(' ').pop().toLowerCase() : profileStr.toLowerCase();
    return String(authorList).toLowerCase().includes(lastName);
  };

  const isFirstAuthor = (authorList, profile) => {
    if (!profile || !authorList) return false;
    const authors = String(authorList).split(/[,;]/);
    if (authors.length === 0) return false;
    const firstAuthor = authors[0].toLowerCase().trim();
    const profileStr = String(profile);
    const lastName = profileStr.includes(' ') ? profileStr.split(' ').pop().toLowerCase() : profileStr.toLowerCase();
    return firstAuthor.includes(lastName);
  };

  const isPreprintVenue = (venue) => {
    if (!venue) return true;
    const v = String(venue).toLowerCase();
    return v.includes('arxiv') || v.includes('preprint') || v.includes('biorxiv') || v.includes('unpublished');
  };

  const toggleCheckbox = (id, field) => {
    setPublications(prev => prev.map(pub => 
      pub.id === id ? { ...pub, [field]: !pub[field] } : pub
    ));
  };

  const deletePublication = (id) => {
    setPublications(prev => prev.filter(pub => pub.id !== id));
  };

  const handleAddEntry = (e) => {
    e.preventDefault();
    const id = `manual-${Date.now()}`;
    const entry = {
      ...newEntry,
      id,
      isLead: isFirstAuthor(newEntry.authors, profileName),
      isPreprint: isPreprintVenue(newEntry.venue)
    };
    setPublications([entry, ...publications]);
    setShowAddModal(false);
    setNewEntry({ title: '', authors: '', venue: '', year: new Date().getFullYear().toString(), citations: '0', link: '', doi: '' });
  };

  const stats = useMemo(() => {
    const pubs = Array.isArray(publications) ? publications : [];
    return {
      total: pubs.length,
      lead: pubs.filter(p => p && p.isLead).length,
      unpublished: pubs.filter(p => p && p.isPreprint).length
    };
  }, [publications]);

  const renderAuthor = (authors, profile) => {
    if (!profile || !authors) return authors;
    const profileStr = String(profile);
    const lastName = profileStr.includes(' ') ? profileStr.split(' ').pop() : profileStr;
    if (!lastName) return authors;
    
    // Find only the segment (between separators) that contains the profile author
    const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`([^,;\\n]*?\\b${escapedLastName}\\b[^,;\\n]*)`, 'i');
    const match = authors.match(regex);
    
    if (!match) return authors;
    
    const index = match.index;
    const length = match[0].length;
    
    return (
      <span>
        {authors.substring(0, index)}
        <strong className="text-primary-700 font-bold border-b-2 border-primary-200">
          {authors.substring(index, index + length)}
        </strong>
        {authors.substring(index + length)}
      </span>
    );
  };

  const handleExport = () => {
    window.print();
  };

  // Title-case a string
  const toTitleCase = (str) => {
    if (!str) return str;
    return String(str).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  };

  // Format authors for print: show all unless >10 → first + et al.
  const formatAuthorsForPrint = (authors) => {
    if (!authors) return '';
    const parts = String(authors).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    // Heuristic: if we have >10 "parts" it means >10 authors
    // Google Scholar shows: "A Beck, B Doe, ... " so parts may be first/last names together
    // Try splitting by ", " first to get full-name items
    const byComma = String(authors).split(',').map(s => s.trim()).filter(Boolean);
    if (byComma.length > 10) {
      return `${byComma[0]} et al.`;
    }
    return authors;
  };

  // Sanitize a string for LaTeX
  const latexEscape = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  };

  // Sorted pub groups for print & export
  const sortByYear = (pubs) => [...pubs].sort((a, b) => parseInt(a.year || 0) - parseInt(b.year || 0));
  const leadPubs = sortByYear(publications.filter(p => p.isLead && !p.isPreprint));
  const contribPubs = sortByYear(publications.filter(p => !p.isLead && !p.isPreprint));
  const preprintPubs = sortByYear(publications.filter(p => p.isPreprint));

  const handleExportLatex = () => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lines = [
      '\\documentclass[12pt]{article}',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage{hyperref}',
      '\\usepackage{enumitem}',
      '\\begin{document}',
      '',
      `\\begin{center}{\\Large \\textbf{${latexEscape(profileName)} --- Publication List}}\\\\[4pt]`,
      `{\\small Updated to: ${today}}\\\\[2pt]`,
      `Total: ${stats.total} \\quad Lead Author: ${stats.lead} \\quad Preprints: ${stats.unpublished}`,
      '\\end{center}',
      '\\vspace{1em}',
      '',
    ];

    let counter = 1;
    const section = (title, pubs) => {
      if (!pubs.length) return;
      lines.push(`\\section*{${latexEscape(title)} (${pubs.length})}`);
      lines.push('\\begin{enumerate}[leftmargin=*, label=\\arabic*.]');
      // We set the start counter
      lines.push(`\\setcounter{enumi}{${counter - 1}}`);
      pubs.forEach(pub => {
        const doiLink = pub.doi ? ` \\href{https://doi.org/${pub.doi}}{DOI: ${latexEscape(pub.doi)}}` : '';
        lines.push(`  \\item ${latexEscape(formatAuthorsForPrint(pub.authors))} (${pub.year}). \\textit{${latexEscape(toTitleCase(pub.title))}}. ${latexEscape(toTitleCase(pub.venue))}.${doiLink}`);
        counter++;
      });
      lines.push('\\end{enumerate}');
      lines.push('');
    };

    section('Peer-Reviewed Lead Author', leadPubs);
    section('Peer-Reviewed Contributing Author', contribPubs);
    section('Preprints', preprintPubs);
    lines.push('\\end{document}');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(profileName || 'publications').replace(/\s+/g, '_')}_publications.tex`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportBib = () => {
    const allPubs = [...leadPubs, ...contribPubs, ...preprintPubs];
    const lines = [];
    allPubs.forEach((pub, i) => {
      // Construct a citekey from first author lastname + year
      const firstAuthor = String(pub.authors || '').split(/[,;]/)[0].trim().replace(/\s+/g, '');
      const citekey = `${firstAuthor}${pub.year || 'XXXX'}${i}`;
      const isPreprint = pub.isPreprint;
      const entryType = isPreprint ? 'misc' : 'article';
      lines.push(`@${entryType}{${citekey},`);
      lines.push(`  title     = {${String(pub.title || '').replace(/{/g, '\\{').replace(/}/g, '\\}')}},`);
      lines.push(`  author    = {${String(pub.authors || '')}},`);
      if (!isPreprint) lines.push(`  journal   = {${String(pub.venue || '')}},`);
      if (isPreprint) lines.push(`  note      = {${String(pub.venue || 'Preprint')}},`);
      lines.push(`  year      = {${pub.year || ''}},`);
      if (pub.doi) lines.push(`  doi       = {${pub.doi}},`);
      if (pub.link) lines.push(`  url       = {${pub.link}},`);
      lines.push('}');
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(profileName || 'publications').replace(/\s+/g, '_')}.bib`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">
          Publication Scraper
        </h1>
        <p className="text-slate-500 text-lg">
          Extract and organize your Google Scholar publications with ease.
        </p>
      </header>

      {/* Scraper Input */}
      <section className="glass-card p-6 mb-8 max-w-3xl mx-auto">
        <form onSubmit={handleScrape} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="url"
              placeholder="Paste Google Scholar Profile URL..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 px-8"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
            {loading ? 'Scraping...' : 'Fetch List'}
          </button>
        </form>
        
        {/* Hidden file input for loading */}
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileLoad}
          className="hidden"
        />

        <div className="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-slate-100">
          <button 
            onClick={handleLoad}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4" /> Load Dataset
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Manual Entry
          </button>
          <a
            href="/install-local.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Install Local
          </a>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </section>

      {publications.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Total Papers" value={stats.total} icon={<FileText className="text-blue-500" />} />
            <StatCard label="Lead Author" value={stats.lead} icon={<Check className="text-green-500" />} />
            <StatCard label="Preprint" value={stats.unpublished} icon={<AlertCircle className="text-amber-500" />} />
          </section>

          {/* Actions */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              {profileName ? `${profileName}'s Publications` : 'Publications'}
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Download dataset as JSON"
              >
                <Download className="w-4 h-4" /> Save
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Print
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Save as PDF using your browser's print dialog"
              >
                <FileText className="w-4 h-4" /> Save as PDF
              </button>
              <button 
                onClick={handleExportLatex}
                className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText className="w-4 h-4" /> Export LaTeX
              </button>
              <button 
                onClick={handleExportBib}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileJson className="w-4 h-4" /> Export .bib
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="table-container mb-12">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Authors</th>
                  <th>Journal / Venue</th>
                  <th>DOI</th>
                  <th className="text-center">Year</th>
                  <th className="text-center">Citations</th>
                  <th className="text-center">Lead Author</th>
                  <th className="text-center">Preprint</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {publications.map((pub) => (
                  <tr key={pub.id} className={pub.isLead ? "bg-primary-50/30" : ""}>
                    <td className="max-w-xs">
                      <input
                        type="text"
                        className="w-full bg-transparent font-medium text-slate-900 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5 text-sm"
                        value={pub.title}
                        onChange={(e) => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, title: e.target.value } : p))}
                      />
                      {(pub.doi || pub.link) && (
                        <a href={pub.doi ? `https://doi.org/${pub.doi}` : pub.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-500 hover:underline">
                          {pub.doi ? `doi:${pub.doi}` : 'link'}
                        </a>
                      )}
                    </td>
                    <td className="max-w-xs">
                      <input
                        type="text"
                        className="w-full bg-transparent text-xs outline-none focus:bg-slate-50 focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5"
                        value={pub.authors}
                        onChange={(e) => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, authors: e.target.value } : p))}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="w-full bg-transparent text-xs italic outline-none focus:bg-slate-50 focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5"
                        value={pub.venue}
                        onChange={(e) => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, venue: e.target.value } : p))}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          placeholder="DOI..." 
                          className={`bg-slate-100/50 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-primary-400 w-24 outline-none ${enrichingIds.has(pub.id) ? 'animate-pulse' : ''}`}
                          value={pub.doi}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, doi: val } : p));
                          }}
                        />
                        {enrichingIds.has(pub.id) ? (
                          <Loader2 className="w-3 h-3 animate-spin text-primary-500" />
                        ) : !pub.doi && (
                          <button 
                            onClick={() => fetchDOI(pub.id, pub.title, pub.venue)}
                            className="p-1 text-primary-500 hover:text-primary-700 transition-colors"
                            title="Find DOI"
                          >
                            <Search className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <input
                        type="text"
                        className="w-12 bg-transparent text-xs font-semibold text-center outline-none focus:bg-slate-50 focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5"
                        value={pub.year}
                        onChange={(e) => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, year: e.target.value } : p))}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="text"
                        className="w-10 bg-transparent font-mono text-xs text-center outline-none focus:bg-slate-50 focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5"
                        value={pub.citations}
                        onChange={(e) => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, citations: e.target.value } : p))}
                      />
                    </td>
                    <td className="text-center">
                      <Checkbox 
                        checked={pub.isLead} 
                        onChange={() => toggleCheckbox(pub.id, 'isLead')} 
                      />
                    </td>
                    <td className="text-center">
                      <Checkbox checked={pub.isPreprint} onChange={() => toggleCheckbox(pub.id, 'isPreprint')} />
                    </td>
                    <td className="text-right">
                      <button 
                        onClick={() => deletePublication(pub.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4">Add Manual Publication</h3>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title</label>
                <input 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                  value={newEntry.title}
                  onChange={e => setNewEntry({...newEntry, title: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Authors</label>
                  <input 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Author 1, Author 2..."
                    value={newEntry.authors}
                    onChange={e => setNewEntry({...newEntry, authors: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Journal/Venue</label>
                  <input 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    value={newEntry.venue}
                    onChange={e => setNewEntry({...newEntry, venue: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Year</label>
                  <input 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    value={newEntry.year}
                    onChange={e => setNewEntry({...newEntry, year: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Citations</label>
                  <input 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    value={newEntry.citations}
                    onChange={e => setNewEntry({...newEntry, citations: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">DOI</label>
                  <input 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    value={newEntry.doi}
                    onChange={e => setNewEntry({...newEntry, doi: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Add Publication
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print-only publication list (hidden on screen, shown when printing) */}
      {publications.length > 0 && (() => {
        // Build numbered items across sections (oldest first within each section)
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        let counter = 1;

        const PrintSection = ({ title, pubs }) => {
          if (!pubs.length) return null;
          const startNum = counter;
          counter += pubs.length;
          return (
            <div className="print-section">
              <h2>{title} ({pubs.length})</h2>
              <ol start={startNum}>
                {pubs.map((pub) => (
                  <li key={pub.id}>
                    {formatAuthorsForPrint(pub.authors)} ({pub.year}). {toTitleCase(pub.title)}.{' '}
                    <em>{toTitleCase(pub.venue)}</em>
                    {pub.doi ? `. DOI: ${pub.doi}` : ''}.
                  </li>
                ))}
              </ol>
            </div>
          );
        };

        return (
          <div className="print-only">
            <div className="print-header">
              <h1>{profileName ? `${profileName} — Publication List` : 'Publication List'}</h1>
              <div className="print-updated">Updated to: {today}</div>
              <div className="print-stats">
                Total: {stats.total} &nbsp;|&nbsp; Lead Author: {stats.lead} &nbsp;|&nbsp; Preprints: {stats.unpublished}
              </div>
            </div>
            <PrintSection title="Peer-Reviewed Lead Author" pubs={leadPubs} />
            <PrintSection title="Peer-Reviewed Contributing Author" pubs={contribPubs} />
            <PrintSection title="Preprints" pubs={preprintPubs} />
          </div>
        );
      })()}

      {/* Copyright Footer */}
      <footer className="mt-12 pt-6 border-t border-slate-100 text-center text-slate-400 text-sm">
        &copy; Roy Beck, Tel Aviv University
      </footer>

      {/* Print styles */}
      <style>{`
        .print-only { display: none; }
        @media print {
          /* Hide screen-only elements */
          .glass-card, button, input, section, .table-container,
          header, .animate-in, footer, .print-hide { display: none !important; }

          /* Show print-only elements */
          .print-only { display: block !important; }

          body { background: white; font-family: Times New Roman, serif; font-size: 12pt; color: #000; margin: 0; padding: 1.5cm; }
          .max-w-7xl { max-width: 100%; padding: 0; }

          .print-header { margin-bottom: 18px; }
          .print-header h1 { font-size: 18pt; font-weight: bold; margin-bottom: 4px; }
          .print-updated { font-size: 11pt; color: #333; margin-bottom: 3px; }
          .print-stats { font-size: 11pt; color: #444; margin-bottom: 18px; }

          .print-section { margin-bottom: 20px; page-break-inside: auto; }
          .print-section h2 { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #888; padding-bottom: 3px; margin-bottom: 8px; }
          .print-section ol { padding-left: 24px; margin: 0; }
          .print-section li { font-size: 12pt; margin-bottom: 7px; line-height: 1.5; }
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, icon }) => (
  <div className="glass-card p-4 flex items-center justify-between">
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
    <div className="p-3 bg-slate-50 rounded-xl">
      {icon}
    </div>
  </div>
);

const Radio = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
      checked 
        ? 'bg-primary-600 border-primary-600 text-white' 
        : 'bg-white border-slate-300 hover:border-primary-400'
    }`}
  >
    {checked && <div className="w-2 h-2 rounded-full bg-white" />}
  </button>
);

const Checkbox = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
      checked 
        ? 'bg-primary-600 border-primary-600 text-white' 
        : 'bg-white border-slate-300 hover:border-primary-400'
    }`}
  >
    {checked && <Check className="w-3 h-3" />}
  </button>
);

export default App;
