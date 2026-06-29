import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, PlayCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Lesson, LessonProgress, TrainingModule } from '@/types'

interface ModuleRow extends TrainingModule {
  lessons?: Lesson[]
}

export function ProNetLessons() {
  const { user } = useAuthStore()
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [progress, setProgress] = useState<LessonProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) fetchLessons(user.id)
  }, [user?.id])

  const fetchLessons = async (userId: string) => {
    setLoading(true)
    try {
      const [modulesRes, progressRes] = await Promise.all([
        supabase
          .from('training_modules')
          .select('*, lessons (*)')
          .eq('is_active', true)
          .order('order_index', { ascending: true }),
        supabase.from('lesson_progress').select('*').eq('user_id', userId),
      ])

      const sortedModules = ((modulesRes.data ?? []) as ModuleRow[]).map((module) => ({
        ...module,
        lessons: [...(module.lessons ?? [])].sort((a, b) => a.order_index - b.order_index),
      }))

      setModules(sortedModules)
      setProgress((progressRes.data ?? []) as LessonProgress[])
    } catch (err) {
      console.error('Error fetching lessons:', err)
    } finally {
      setLoading(false)
    }
  }

  const markComplete = async (lessonId: string) => {
    if (!user?.id) return
    setUpdating(lessonId)
    try {
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' })

      if (error) throw error
      await fetchLessons(user.id)
    } catch (err) {
      console.error('Error updating lesson progress:', err)
      alert('Failed to update lesson progress.')
    } finally {
      setUpdating(null)
    }
  }

  const isCompleted = (lessonId: string) => progress.some((item) => item.lesson_id === lessonId && item.status === 'completed')
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length ?? 0), 0)
  const completedLessons = progress.filter((item) => item.status === 'completed').length
  const progressPct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0

  if (loading) {
    return <div className="glass-card h-72 animate-pulse bg-surface-100/60" />
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-600">ProNet Lessons</p>
            <h1 className="mt-1 text-2xl font-black text-surface-900">Build field confidence</h1>
            <p className="mt-1 text-sm text-surface-500">{completedLessons} of {totalLessons} lessons completed</p>
          </div>
          <div className="w-full rounded-full bg-surface-100 md:w-56">
            <div className="h-3 rounded-full bg-brand-gradient" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {modules.map((module, moduleIndex) => (
          <motion.div key={module.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: moduleIndex * 0.05 }} className="glass-card overflow-hidden">
            <div className="border-b border-surface-100 p-5">
              <h2 className="text-lg font-black text-surface-900">{module.title}</h2>
              <p className="mt-1 text-sm text-surface-500">{module.description}</p>
            </div>
            <div className="divide-y divide-surface-100">
              {(module.lessons ?? []).map((lesson) => {
                const completed = isCompleted(lesson.id)
                return (
                  <div key={lesson.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${completed ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-600'}`}>
                        {completed ? <CheckCircle2 className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-black text-surface-900">{lesson.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-surface-500">{lesson.content ?? 'Lesson content will appear here.'}</p>
                      </div>
                    </div>
                    <button onClick={() => markComplete(lesson.id)} disabled={completed || updating === lesson.id} className={completed ? 'btn-secondary h-10 px-4 text-sm' : 'btn-primary h-10 px-4 text-sm'}>
                      {completed ? 'Completed' : updating === lesson.id ? 'Saving...' : 'Mark done'}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        ))}

        {modules.length === 0 && (
          <div className="glass-card p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-surface-300" />
            <p className="mt-3 text-sm font-bold text-surface-500">No ProNet lessons yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
