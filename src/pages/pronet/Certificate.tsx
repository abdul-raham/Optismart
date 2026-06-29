import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, Download, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'

export function ProNetCertificate() {
  const { user } = useAuthStore()
  const [certificates, setCertificates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchCertificates(user.id)
  }, [user?.id])

  const fetchCertificates = async (userId: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('certificates')
        .select('*, training_modules(title)')
        .eq('user_id', userId)
        .order('issued_at', { ascending: false })
      
      if (data) setCertificates(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="glass-card h-72 animate-pulse bg-surface-100/60" />
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-600">Your Achievements</p>
            <h1 className="mt-1 text-2xl font-black text-surface-900">Certificates</h1>
            <p className="mt-1 text-sm text-surface-500">View and download your earned ProNet certificates.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-surface-900">{certificates.length}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Earned</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((cert, i) => (
          <motion.div key={cert.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-500/10 pointer-events-none" />
            
            <div className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <ShieldCheck className="h-8 w-8 text-brand-600" />
                <span className="text-xs font-bold text-surface-400 bg-surface-100 px-2 py-1 rounded-md">{cert.certificate_number}</span>
              </div>
              
              <h3 className="text-lg font-black text-surface-900 mb-1">{cert.training_modules?.title}</h3>
              <p className="text-sm font-semibold text-surface-500 mb-6">Issued {formatDate(cert.issued_at)}</p>
              
              <button className="w-full btn-secondary h-10 px-4 text-sm flex items-center justify-center gap-2 group-hover:border-brand-300 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                <Download className="h-4 w-4" /> Download PDF
              </button>
            </div>
          </motion.div>
        ))}

        {certificates.length === 0 && (
          <div className="col-span-full glass-card p-12 text-center">
            <Award className="mx-auto h-12 w-12 text-surface-300" />
            <h3 className="mt-4 text-lg font-black text-surface-900">No certificates yet</h3>
            <p className="mt-2 text-sm font-medium text-surface-500 max-w-sm mx-auto">
              Complete training modules and pass their quizzes to earn your ProNet certifications!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
