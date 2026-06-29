import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { BookOpen, PlayCircle, FileText, Award, CheckCircle2, Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export function ProNetDashboard() {
  const { user } = useAuthStore()
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const { data: courseData, error } = await supabase
        .from('lms_courses')
        .select(`
          *,
          lms_modules (
            id,
            lms_lessons (
              id,
              lms_user_progress (status)
            )
          )
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: true })

      if (error) throw error

      const mapped = (courseData || []).map((course: any) => {
        let totalLessons = 0
        let completedLessons = 0
        
        course.lms_modules?.forEach((mod: any) => {
          mod.lms_lessons?.forEach((lesson: any) => {
            totalLessons++
            const progress = lesson.lms_user_progress?.find((p: any) => p.user_id === user?.id)
            if (progress && progress.status === 'completed') {
              completedLessons++
            }
          })
        })

        const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)

        return {
          ...course,
          lessonsCount: totalLessons,
          progress: progressPercent,
          completed: totalLessons > 0 && completedLessons === totalLessons,
          locked: false, // We can add tier logic here later if needed
          duration: 'Various', // Should ideally sum up durations, but keeping simple
        }
      })

      setCourses(mapped)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">ProNet LMS Dashboard</h1>
          <p className="text-sm text-surface-500 mt-1">Complete your certification training to unlock higher tiers.</p>
        </div>
      </div>

      <div className="relative mt-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Main Content: Courses */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Your Learning Path</h2>
            
            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-32 bg-surface-50/50 rounded-2xl animate-pulse" />)}
              </div>
            ) : courses.length === 0 ? (
              <div className="glass-card p-12 text-center flex flex-col items-center">
                <BookOpen className="w-12 h-12 text-surface-300 mb-4" />
                <h3 className="text-lg font-bold text-surface-900 mb-1">No courses available</h3>
                <p className="text-sm text-surface-500">Check back later for new training content.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course, i) => (
                  <Link to={`/app/training/${course.id}`} key={course.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`glass-card p-5 relative overflow-hidden transition-all mb-4 block ${course.locked ? 'opacity-70 grayscale-[0.3]' : 'hover:border-brand-200 hover:-translate-y-0.5'}`}
                    >
                      {course.locked && (
                        <div className="absolute top-4 right-4 bg-surface-100 p-2 rounded-lg text-surface-500">
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                      {course.completed && (
                        <div className="absolute top-4 right-4 text-success-500">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${course.completed ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-600'}`}>
                          <PlayCircle className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-surface-900">{course.title}</h3>
                          <p className="text-sm text-surface-500 mt-1 mb-4 pr-8">{course.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs font-semibold text-surface-500 mb-4">
                            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {course.lessonsCount} Lessons</span>
                            <span className="flex items-center gap-1.5"><PlayCircle className="w-3.5 h-3.5" /> {course.duration}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${course.completed ? 'bg-success-500' : 'bg-brand-500'}`}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] font-bold text-surface-400 uppercase">
                            <span>{course.progress}% Complete</span>
                            {course.locked && <span>Locked</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Resources & Certs */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 border-brand-200 bg-brand-50/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-surface-900 mb-2">ProNet Certification</h3>
              <p className="text-sm text-surface-600 mb-4">Complete all modules and pass the final exam to earn your official installer badge.</p>
              <div className="w-full bg-surface-200/50 rounded-lg p-3 text-center">
                <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Locked</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
              <h3 className="font-bold text-surface-900 mb-4">Study Resources</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-surface-100 hover:border-brand-200 hover:bg-brand-50/50 transition-colors text-left group">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-surface-900">Installation Manual V3</p>
                    <p className="text-[10px] text-surface-500 uppercase">PDF • 2.4 MB</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-surface-100 hover:border-brand-200 hover:bg-brand-50/50 transition-colors text-left group">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-surface-900">Sales Pitch Guide</p>
                    <p className="text-[10px] text-surface-500 uppercase">PDF • 1.1 MB</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
