import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { ChevronLeft, PlayCircle, CheckCircle2, Circle, Loader2, BookOpen } from 'lucide-react'

export function CourseView() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [course, setCourse] = useState<any>(null)
  const [activeLesson, setActiveLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (courseId) {
      fetchCourse()
    }
  }, [courseId])

  const fetchCourse = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('lms_courses')
        .select(`
          *,
          lms_modules (
            id,
            title,
            order_index,
            lms_lessons (
              id,
              title,
              description,
              video_url,
              duration,
              order_index,
              lms_user_progress (status)
            )
          )
        `)
        .eq('id', courseId)
        .single()

      if (error) throw error

      // Sort modules and lessons
      if (data?.lms_modules) {
        data.lms_modules.sort((a: any, b: any) => a.order_index - b.order_index)
        data.lms_modules.forEach((m: any) => {
          m.lms_lessons?.sort((a: any, b: any) => a.order_index - b.order_index)
        })
      }

      setCourse(data)
      
      // Auto-select first lesson if none active
      if (data?.lms_modules?.[0]?.lms_lessons?.[0]) {
        setActiveLesson(data.lms_modules[0].lms_lessons[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const markLessonComplete = async () => {
    if (!activeLesson || !user) return
    setCompleting(true)
    try {
      const { error } = await supabase.from('lms_user_progress').upsert({
        user_id: user.id,
        lesson_id: activeLesson.id,
        status: 'completed'
      }, { onConflict: 'user_id,lesson_id' })

      if (error) throw error
      
      // Refresh course state to show checkmark
      await fetchCourse()
    } catch (err) {
      console.error(err)
      alert('Failed to mark lesson as complete.')
    } finally {
      setCompleting(false)
    }
  }

  const isLessonCompleted = (lesson: any) => {
    const progress = lesson.lms_user_progress?.find((p: any) => p.user_id === user?.id)
    return progress && progress.status === 'completed'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-surface-900">Course not found</h2>
        <button onClick={() => navigate('/app/training')} className="text-brand-600 mt-4 font-semibold">
          &larr; Back to Training
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/training')} className="p-2 rounded-xl border border-surface-200 hover:bg-surface-50 text-surface-500 hover:text-surface-900 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">{course.title}</h1>
          <p className="text-sm text-surface-500 mt-1">ProNet Certification Course</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Video & Lesson Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden rounded-[24px]">
            {/* Video Player Placeholder / Embed */}
            <div className="w-full aspect-video bg-surface-900 relative flex items-center justify-center">
              {activeLesson?.video_url ? (
                <iframe 
                  src={activeLesson.video_url} 
                  className="w-full h-full absolute inset-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-6 text-surface-400">
                  <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No video URL provided for this lesson.</p>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-surface-900">{activeLesson?.title || 'Select a lesson'}</h2>
                  <p className="text-sm text-surface-500 mt-2">{activeLesson?.description}</p>
                </div>
                {activeLesson && (
                  <button 
                    onClick={markLessonComplete}
                    disabled={completing || isLessonCompleted(activeLesson)}
                    className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                      isLessonCompleted(activeLesson) 
                        ? 'bg-success-50 text-success-700' 
                        : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand'
                    }`}
                  >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isLessonCompleted(activeLesson) ? 'Completed' : 'Mark as Complete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Modules List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-bold text-surface-900 uppercase tracking-wider text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Course Content
          </h3>
          
          <div className="space-y-3">
            {course.lms_modules?.length === 0 && (
              <p className="text-sm text-surface-500 italic">No modules added to this course yet.</p>
            )}
            {course.lms_modules?.map((mod: any) => (
              <div key={mod.id} className="glass-card overflow-hidden">
                <div className="p-4 border-b border-surface-100 bg-surface-50/50">
                  <h4 className="font-bold text-surface-900 text-sm">{mod.title}</h4>
                </div>
                <div className="divide-y divide-surface-100">
                  {mod.lms_lessons?.length === 0 && (
                    <div className="p-3 text-xs text-surface-400 italic">No lessons in this module.</div>
                  )}
                  {mod.lms_lessons?.map((lesson: any) => {
                    const isActive = activeLesson?.id === lesson.id
                    const isCompleted = isLessonCompleted(lesson)

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLesson(lesson)}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-surface-50 ${isActive ? 'bg-brand-50/50' : ''}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0" />
                        ) : (
                          <Circle className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand-500' : 'text-surface-300'}`} />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isActive ? 'text-brand-700' : 'text-surface-700'}`}>
                            {lesson.title}
                          </p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase mt-0.5">
                            {lesson.duration || 'Video'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
