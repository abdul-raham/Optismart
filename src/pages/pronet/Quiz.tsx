import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Quiz, QuizAttempt, QuizQuestion } from '@/types'

interface QuizRow extends Quiz {
  training_modules?: { title: string }
  quiz_questions?: QuizQuestion[]
}

export function ProNetQuiz() {
  const { user } = useAuthStore()
  const [quizzes, setQuizzes] = useState<QuizRow[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchData(user.id)
  }, [user?.id])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [quizRes, attemptRes] = await Promise.all([
        supabase
          .from('quizzes')
          .select('*, training_modules ( title ), quiz_questions (*)')
          .order('created_at', { ascending: true }),
        supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('attempted_at', { ascending: false }),
      ])

      const rows = ((quizRes.data ?? []) as QuizRow[]).map((quiz) => ({
        ...quiz,
        quiz_questions: [...(quiz.quiz_questions ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
      }))

      setQuizzes(rows)
      setAttempts((attemptRes.data ?? []) as QuizAttempt[])
      setSelectedQuizId(rows[0]?.id ?? null)
    } catch (err) {
      console.error('Error fetching quizzes:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectedQuiz = useMemo(() => quizzes.find((quiz) => quiz.id === selectedQuizId) ?? null, [quizzes, selectedQuizId])
  const lastAttempt = selectedQuiz ? attempts.find((attempt) => attempt.quiz_id === selectedQuiz.id) : null

  const submitQuiz = async () => {
    if (!user?.id || !selectedQuiz) return

    const questions = selectedQuiz.quiz_questions ?? []
    if (questions.some((question) => !answers[question.id])) {
      alert('Please answer every question.')
      return
    }

    setSubmitting(true)
    try {
      const correct = questions.filter((question) => answers[question.id] === question.correct_answer_id).length
      const score = Math.round((correct / questions.length) * 100)
      const passed = score >= selectedQuiz.pass_percentage

      const { error } = await supabase.from('quiz_attempts').insert([{
        user_id: user.id,
        quiz_id: selectedQuiz.id,
        answers,
        score_percentage: score,
        passed,
      }])

      if (error) throw error

      if (passed) {
        // Generate certificate
        await supabase.from('certificates').insert([{
          user_id: user.id,
          module_id: selectedQuiz.module_id,
          certificate_number: `CERT-${Date.now().toString().slice(-8)}`
        }]).select().single()
      }

      setAnswers({})
      await fetchData(user.id)
    } catch (err) {
      console.error('Error submitting quiz:', err)
      alert('Failed to submit quiz.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="glass-card h-72 animate-pulse bg-surface-100/60" />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="glass-card p-4">
        <h1 className="px-2 text-xl font-black text-surface-900">Quizzes</h1>
        <div className="mt-4 space-y-2">
          {quizzes.map((quiz) => {
            const attempt = attempts.find((item) => item.quiz_id === quiz.id)
            return (
              <button key={quiz.id} onClick={() => setSelectedQuizId(quiz.id)} className={`w-full rounded-2xl p-4 text-left transition ${selectedQuizId === quiz.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-50'}`}>
                <p className="font-black">{quiz.title}</p>
                <p className="mt-1 text-xs font-semibold text-surface-500">{quiz.training_modules?.title}</p>
                {attempt && <span className={attempt.passed ? 'badge-green mt-3' : 'badge-red mt-3'}>{attempt.score_percentage}%</span>}
              </button>
            )
          })}
          {quizzes.length === 0 && <p className="p-4 text-sm font-semibold text-surface-500">No quizzes available.</p>}
        </div>
      </div>

      <motion.div key={selectedQuiz?.id ?? 'empty'} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        {selectedQuiz ? (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-brand-600">Pass mark: {selectedQuiz.pass_percentage}%</p>
                <h2 className="mt-1 text-2xl font-black text-surface-900">{selectedQuiz.title}</h2>
              </div>
              {lastAttempt && (
                <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black ${lastAttempt.passed ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                  {lastAttempt.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  Last score: {lastAttempt.score_percentage}%
                </div>
              )}
            </div>

            <div className="space-y-5">
              {(selectedQuiz.quiz_questions ?? []).map((question, index) => (
                <div key={question.id} className="rounded-2xl border border-surface-100 bg-white p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-black text-brand-700">{index + 1}</div>
                    <h3 className="font-black text-surface-900">{question.text}</h3>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => (
                      <button key={option.id} onClick={() => setAnswers({ ...answers, [question.id]: option.id })} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${answers[question.id] === option.id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-surface-100 bg-surface-50 text-surface-600 hover:border-brand-100'}`}>
                        {option.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={submitQuiz} disabled={submitting || !(selectedQuiz.quiz_questions?.length)} className="btn-primary mt-6 h-12 w-full rounded-2xl">
              {submitting ? 'Submitting...' : 'Submit quiz'}
            </button>
          </>
        ) : (
          <div className="py-16 text-center">
            <HelpCircle className="mx-auto h-10 w-10 text-surface-300" />
            <p className="mt-3 text-sm font-bold text-surface-500">Select a quiz to begin.</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
