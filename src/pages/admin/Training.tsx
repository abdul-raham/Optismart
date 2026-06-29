import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Plus, BookOpen, PlayCircle, Settings, Trash2, CheckCircle2, X, AlertCircle, UploadCloud, ChevronLeft, Loader2, Video } from 'lucide-react'

export function AdminTraining() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [newCourse, setNewCourse] = useState({ title: '', description: '', thumbnail_url: '', required_tier: 'tier1' })
  
  // Content Manager States
  const [activeCourse, setActiveCourse] = useState<any>(null)
  const [courseContent, setCourseContent] = useState<any[]>([])
  const [loadingContent, setLoadingContent] = useState(false)
  
  const [showAddModule, setShowAddModule] = useState(false)
  const [newModule, setNewModule] = useState({ title: '' })
  
  const [showAddLesson, setShowAddLesson] = useState<{moduleId: string} | null>(null)
  const [newLesson, setNewLesson] = useState({ title: '', description: '', duration: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingLesson, setUploadingLesson] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (activeCourse) fetchContent(activeCourse.id)
  }, [activeCourse])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('lms_courses')
        .select('*, lms_modules(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCourses(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchContent = async (courseId: string) => {
    setLoadingContent(true)
    try {
      const { data, error } = await supabase
        .from('lms_modules')
        .select('*, lms_lessons(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      
      data?.forEach((m: any) => {
        m.lms_lessons?.sort((a: any, b: any) => a.order_index - b.order_index)
      })
      
      setCourseContent(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingContent(false)
    }
  }

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('lms_courses').insert([newCourse])
      if (error) throw error
      setShowAddCourse(false)
      setNewCourse({ title: '', description: '', thumbnail_url: '', required_tier: 'tier1' })
      fetchCourses()
    } catch (err) {
      console.error(err)
      alert('Failed to add course')
    }
  }

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('lms_modules').insert([{
        course_id: activeCourse.id,
        title: newModule.title,
        order_index: courseContent.length
      }])
      if (error) throw error
      setShowAddModule(false)
      setNewModule({ title: '' })
      fetchContent(activeCourse.id)
    } catch (err) {
      console.error(err)
      alert('Failed to add module')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 50MB Limit
    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit. Please compress the video or choose a smaller file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadFile(null)
      return
    }
    
    setUploadFile(file)
  }

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAddLesson || !uploadFile) return
    
    setUploadingLesson(true)
    try {
      // 1. Upload file to storage
      const fileExt = uploadFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${activeCourse.id}/${showAddLesson.moduleId}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('lms-videos')
        .upload(filePath, uploadFile, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('lms-videos')
        .getPublicUrl(filePath)
        
      const videoUrl = publicUrlData.publicUrl

      // 3. Insert Lesson
      const currentModule = courseContent.find((m: any) => m.id === showAddLesson.moduleId)
      const currentLessonsCount = currentModule?.lms_lessons?.length || 0

      const { error: dbError } = await supabase.from('lms_lessons').insert([{
        module_id: showAddLesson.moduleId,
        title: newLesson.title,
        description: newLesson.description,
        video_url: videoUrl,
        duration: newLesson.duration || 'Unknown',
        order_index: currentLessonsCount
      }])

      if (dbError) throw dbError

      // Cleanup
      setShowAddLesson(null)
      setNewLesson({ title: '', description: '', duration: '' })
      setUploadFile(null)
      fetchContent(activeCourse.id)
      
    } catch (err) {
      console.error(err)
      alert('Failed to upload lesson. See console for details.')
    } finally {
      setUploadingLesson(false)
    }
  }

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('lms_courses').update({ is_published: !currentStatus }).eq('id', id)
      if (error) throw error
      fetchCourses()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteCourse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return
    try {
      const { error } = await supabase.from('lms_courses').delete().eq('id', id)
      if (error) throw error
      fetchCourses()
    } catch (err) {
      console.error(err)
    }
  }
  
  const deleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return
    try {
      const { error } = await supabase.from('lms_lessons').delete().eq('id', id)
      if (error) throw error
      fetchContent(activeCourse.id)
    } catch (err) {
      console.error(err)
    }
  }

  if (activeCourse) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => { setActiveCourse(null); fetchCourses(); }} className="p-2 rounded-xl border border-surface-200 hover:bg-surface-50 text-surface-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-surface-900 tracking-tight">{activeCourse.title} Content</h1>
              <p className="text-sm text-surface-500 mt-1">Manage modules and video lessons for this course.</p>
            </div>
          </div>
          <button onClick={() => setShowAddModule(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" /> Add Module
          </button>
        </div>

        <div className="space-y-6 max-w-4xl">
          {loadingContent ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
          ) : courseContent.length === 0 ? (
            <div className="glass-card p-12 text-center text-surface-500">No modules found. Add a module to start organizing lessons.</div>
          ) : (
            courseContent.map((mod: any) => (
              <div key={mod.id} className="glass-card overflow-hidden">
                <div className="bg-surface-50 p-4 border-b border-surface-100 flex justify-between items-center">
                  <h3 className="font-bold text-surface-900 text-lg">{mod.title}</h3>
                  <button onClick={() => setShowAddLesson({ moduleId: mod.id })} className="btn-secondary py-1.5 px-3 text-xs">
                    <Video className="w-3.5 h-3.5 mr-1.5" /> Add Lesson
                  </button>
                </div>
                
                <div className="divide-y divide-surface-100">
                  {mod.lms_lessons?.length === 0 && (
                    <div className="p-6 text-center text-sm text-surface-400 italic">No lessons in this module.</div>
                  )}
                  {mod.lms_lessons?.map((lesson: any) => (
                    <div key={lesson.id} className="p-4 flex gap-4 items-start hover:bg-surface-50/50 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 text-brand-600">
                        <PlayCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-surface-900">{lesson.title}</h4>
                        <p className="text-sm text-surface-500 mt-1 line-clamp-2">{lesson.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs font-semibold text-surface-400 bg-surface-100 px-2 py-0.5 rounded uppercase tracking-wider">{lesson.duration}</span>
                          <a href={lesson.video_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                            Test Video &rarr;
                          </a>
                        </div>
                      </div>
                      <button onClick={() => deleteLesson(lesson.id)} className="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Module Modal */}
        <AnimatePresence>
          {showAddModule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                <h2 className="text-xl font-bold text-surface-900 mb-4">Add Module</h2>
                <form onSubmit={handleAddModule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-surface-700 mb-1.5">Module Title</label>
                    <input required type="text" value={newModule.title} onChange={e => setNewModule({title: e.target.value})} className="input w-full" placeholder="e.g. Introduction" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddModule(false)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" className="btn-primary flex-1">Create</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Lesson Modal */}
        <AnimatePresence>
          {showAddLesson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                <h2 className="text-xl font-bold text-surface-900 mb-4">Upload New Lesson</h2>
                <form onSubmit={handleAddLesson} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-surface-700 mb-1.5">Lesson Title</label>
                    <input required type="text" value={newLesson.title} onChange={e => setNewLesson({...newLesson, title: e.target.value})} className="input w-full" placeholder="e.g. Setting up the DVR" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-surface-700 mb-1.5">Description</label>
                    <textarea required value={newLesson.description} onChange={e => setNewLesson({...newLesson, description: e.target.value})} className="input w-full h-20 resize-none" placeholder="What will they learn?" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-surface-700 mb-1.5">Duration (Text)</label>
                    <input required type="text" value={newLesson.duration} onChange={e => setNewLesson({...newLesson, duration: e.target.value})} className="input w-full" placeholder="e.g. 5:30" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-surface-700 mb-1.5">Video File (Max 50MB)</label>
                    <div className="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center hover:bg-surface-50 transition-colors relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="video/mp4,video/webm,video/x-m4v,video/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                        required
                      />
                      <UploadCloud className="w-8 h-8 text-surface-400 mx-auto mb-2" />
                      {uploadFile ? (
                        <p className="text-sm font-bold text-brand-600">{uploadFile.name} ({(uploadFile.size / (1024*1024)).toFixed(2)} MB)</p>
                      ) : (
                        <p className="text-sm font-medium text-surface-500">Click to browse for MP4</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => {setShowAddLesson(null); setUploadFile(null);}} disabled={uploadingLesson} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" disabled={uploadingLesson || !uploadFile} className="btn-primary flex-1">
                      {uploadingLesson ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : 'Upload Lesson'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    )
  }

  // MAIN COURSES LIST VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">ProNet LMS Management</h1>
          <p className="text-sm text-surface-500 mt-1">Manage courses, modules, and training content.</p>
        </div>
        <button 
          onClick={() => setShowAddCourse(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" /> New Course
        </button>
      </div>

      <AnimatePresence>
        {showAddCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-surface-900">Create New Course</h2>
                <button onClick={() => setShowAddCourse(false)} className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Course Title</label>
                  <input required type="text" value={newCourse.title} onChange={e => setNewCourse({...newCourse, title: e.target.value})} className="input w-full" placeholder="e.g. CCTV Installation Basics" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Description</label>
                  <textarea required value={newCourse.description} onChange={e => setNewCourse({...newCourse, description: e.target.value})} className="input w-full h-24 resize-none" placeholder="Course description..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Thumbnail URL (Optional)</label>
                  <input type="text" value={newCourse.thumbnail_url} onChange={e => setNewCourse({...newCourse, thumbnail_url: e.target.value})} className="input w-full" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Required Tier</label>
                  <select value={newCourse.required_tier} onChange={e => setNewCourse({...newCourse, required_tier: e.target.value})} className="input w-full">
                    <option value="tier1">Tier 1 (Base)</option>
                    <option value="tier2">Tier 2</option>
                    <option value="tier3">Tier 3</option>
                  </select>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowAddCourse(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Create Course</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          [1,2].map(i => <div key={i} className="h-48 bg-surface-50 rounded-3xl animate-pulse" />)
        ) : courses.length === 0 ? (
          <div className="col-span-2 glass-card p-12 text-center flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-surface-300 mb-4" />
            <h3 className="text-lg font-bold text-surface-900 mb-1">No courses found</h3>
            <p className="text-sm text-surface-500 mb-6">You haven't created any training courses yet.</p>
            <button onClick={() => setShowAddCourse(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" /> Create First Course
            </button>
          </div>
        ) : (
          courses.map(course => (
            <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-sm">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900 line-clamp-1">{course.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${course.is_published ? 'bg-success-50 text-success-700' : 'bg-surface-100 text-surface-600'}`}>
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                        {course.required_tier}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePublish(course.id, course.is_published)} className={`p-2 rounded-xl transition-colors ${course.is_published ? 'text-surface-400 hover:text-warning-600 hover:bg-warning-50' : 'text-surface-400 hover:text-success-600 hover:bg-success-50'}`} title={course.is_published ? 'Unpublish' : 'Publish'}>
                    {course.is_published ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteCourse(course.id)} className="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-surface-500 mb-6 flex-1 line-clamp-2">{course.description}</p>
              
              <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-brand-500" /> Modules ({course.lms_modules?.length || 0})
                  </h4>
                  <button 
                    onClick={() => setActiveCourse(course)}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Manage Content &rarr;
                  </button>
                </div>
                {course.lms_modules?.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-2">No modules added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {course.lms_modules?.slice(0,2).map((m: any) => (
                      <div key={m.id} className="text-xs font-medium text-surface-600 bg-white p-2 rounded-lg border border-surface-200 line-clamp-1">
                        {m.title}
                      </div>
                    ))}
                    {course.lms_modules?.length > 2 && (
                      <div className="text-xs text-center text-surface-400 font-medium">+{course.lms_modules.length - 2} more</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
