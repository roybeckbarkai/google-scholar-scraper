import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Download, Trash2, Check, AlertCircle, Loader2, User, BookOpen, FileText } from 'lucide-react';

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [publications, setPublications] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
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
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setProfileName(data.profileName);
      
      // Auto-populate checkboxes based on profile name
      const processed = data.publications.map(pub => {
        const isLead = isFirstAuthor(pub.authors, data.profileName);
        const isOther = isAuthor(pub.authors, data.profileName) && !isLead;
        const isPreprint = isPreprintVenue(pub.venue);
        
        return { ...pub, isLead, isOther, isPreprint };
      });
      
      setPublications(processed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName, publications })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      alert('Dataset saved successfully!');
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/load');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setProfileName(data.profileName);
      setPublications(data.publications);
    } catch (err) {
      setError('Load failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDOI = async (id, title, venue) => {
    try {
      const response = await fetch('/api/doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, venue })
      });
      const data = await response.json();
      if (data.doi) {
        setPublications(prev => prev.map(p => p.id === id ? { ...p, doi: data.doi } : p));
      } else {
        alert('No DOI found for this paper.');
      }
    } catch (err) {
      console.error('DOI fetch failed', err);
    }
  };

  const isAuthor = (authorList, profile) => {
    if (!profile) return false;
    const lastName = profile.split(' ').pop().toLowerCase();
    return authorList.toLowerCase().includes(lastName);
  };

  const isFirstAuthor = (authorList, profile) => {
    if (!profile) return false;
    const firstAuthor = authorList.split(',')[0].toLowerCase().trim();
    const lastName = profile.split(' ').pop().toLowerCase();
    return firstAuthor.includes(lastName);
  };

  const isPreprintVenue = (venue) => {
    const v = venue.toLowerCase();
    return v.includes('arxiv') || v.includes('preprint') || v.includes('biorxiv') || v.includes('unpublished') || (venue && venue.trim() === '');
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
      id,
      isLead: isFirstAuthor(newEntry.authors, profileName),
      isOther: isAuthor(newEntry.authors, profileName) && !isFirstAuthor(newEntry.authors, profileName),
      isPreprint: isPreprintVenue(newEntry.venue)
    };
    setPublications([entry, ...publications]);
    setShowAddModal(false);
    setNewEntry({ title: '', authors: '', venue: '', year: new Date().getFullYear().toString(), citations: '0', link: '', doi: '' });
  };

  const stats = useMemo(() => {
    return {
      total: publications.length,
      lead: publications.filter(p => p.isLead).length,
      other: publications.filter(p => p.isOther).length,
      unpublished: publications.filter(p => p.isPreprint).length
    };
  }, [publications]);

  const renderAuthor = (authors, profile) => {
    if (!profile || !authors) return authors;
    const lastName = profile.split(' ').pop();
    if (!lastName) return authors;
    
    // Escape regex special characters
    const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = authors.split(new RegExp(`(\\b.*?${escapedLastName}\\b)`, 'gi'));
    
    return (
      <span>
        {parts.map((part, i) => {
          if (part.toLowerCase().includes(lastName.toLowerCase())) {
            return <strong key={i} className="text-primary-700 font-bold border-b-2 border-primary-200">{part}</strong>;
          }
          return part;
        })}
      </span>
    );
  };

  const handleExport = () => {
    window.print();
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
        
        <div className="flex justify-center gap-4 mt-6 pt-6 border-t border-slate-100">
          <button 
            onClick={handleLoad}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 rotate-45" /> Load Saved Dataset
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Manual Entry
          </button>
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
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Papers" value={stats.total} icon={<FileText className="text-blue-500" />} />
            <StatCard label="Lead Author" value={stats.lead} icon={<Check className="text-green-500" />} />
            <StatCard label="Other Author" value={stats.other} icon={<User className="text-purple-500" />} />
            <StatCard label="Unpublished" value={stats.unpublished} icon={<AlertCircle className="text-amber-500" />} />
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
                title="Save this dataset locally"
              >
                <Download className="w-4 h-4" /> Save
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Print
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
                  <th className="text-center">First Aut.</th>
                  <th className="text-center">Other Aut.</th>
                  <th className="text-center">Preprint</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {publications.map((pub) => (
                  <tr key={pub.id} className={pub.isLead ? "bg-primary-50/30" : ""}>
                    <td className="max-w-xs">
                      <a href={pub.link} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-primary-600 transition-colors">
                        {pub.title}
                      </a>
                    </td>
                    <td className="max-w-xs text-xs">{renderAuthor(pub.authors, profileName)}</td>
                    <td className="text-xs italic">{pub.venue}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          placeholder="DOI..." 
                          className="bg-slate-100/50 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-primary-400 w-24 outline-none"
                          value={pub.doi}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, doi: val } : p));
                          }}
                        />
                        {!pub.doi && (
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
                    <td className="text-center text-xs font-semibold">{pub.year}</td>
                    <td className="text-center font-mono text-xs">{pub.citations}</td>
                    <td className="text-center">
                      <Radio 
                        checked={pub.isLead} 
                        onChange={() => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, isLead: true, isOther: false } : p))} 
                      />
                    </td>
                    <td className="text-center">
                      <Radio 
                        checked={pub.isOther} 
                        onChange={() => setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, isLead: false, isOther: true } : p))} 
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

      {/* Print styles */}
      <style>{`
        @media print {
          .glass-card, button, .trash-col, header p, .flex.gap-3 { display: none !important; }
          .table-container { box-shadow: none; border: none; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f8fafc !important; color: #000 !important; }
          td, th { border: 1px solid #e2e8f0; font-size: 10pt; }
          body { background: white; padding: 0; }
          .max-w-7xl { max-width: 100%; width: 100%; padding: 0; }
          h2 { margin-bottom: 20px; }
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
    onClick={onChange}
    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
      checked 
        ? 'bg-primary-600 border-primary-600 text-white shadow-inner shadow-primary-800' 
        : 'bg-white border-slate-300 hover:border-primary-400'
    }`}
  >
    {checked && <div className="w-2 h-2 rounded-full bg-white" />}
  </button>
);

export default App;
