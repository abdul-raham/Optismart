import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Book, Download, FileText } from 'lucide-react'

interface Ebook {
  id: string
  title: string
  category: string
  file_url: string
  file_size_mb: number
}

export function ProNetEbooks() {
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEbooks()
  }, [])

  const fetchEbooks = async () => {
    try {
      const { data } = await supabase
        .from('training_resources')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setEbooks(data)
    } catch (err) {
      console.error('Error fetching ebooks:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">ProNet Library</h1>
          <p className="text-sm text-surface-500 mt-1">Download manuals, guides, and ebooks.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="glass-card h-40 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : ebooks.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Book className="mx-auto w-12 h-12 text-surface-300 mb-4" />
          <h3 className="text-lg font-bold text-surface-900 mb-2">Library is empty</h3>
          <p className="text-surface-500">No resources have been uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ebooks.map((ebook, idx) => (
            <motion.div
              key={ebook.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-bold text-surface-900 mb-1 line-clamp-2">{ebook.title}</h3>
                <p className="text-xs text-surface-500 uppercase font-bold">{ebook.category}</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-surface-100 pt-4">
                <span className="text-xs text-surface-500">{ebook.file_size_mb} MB</span>
                <a 
                  href={ebook.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-700"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
