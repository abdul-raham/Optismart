import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { User, Lock, Save, Bell, Palette } from 'lucide-react'

export function SettingsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // 1. Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: form.fullName }
      })
      if (authError) throw authError

      // 2. Update users table
      if (user?.id) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ full_name: form.fullName })
          .eq('id', user.id)
        
        if (dbError) throw dbError
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Update profile error:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: form.newPassword
      })
      if (authError) throw authError

      setSuccess('Password updated successfully!')
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Update password error:', err)
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Account Settings</h1>
        <p className="text-sm text-surface-500 mt-1">Manage your personal information and security preferences.</p>
      </div>

      {(error || success) && (
        <div className={`p-4 rounded-xl text-sm font-medium ${error ? 'bg-danger-50 text-danger-700 border border-danger-200' : 'bg-success-50 text-success-700 border border-success-200'}`}>
          {error || success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-600" /> Personal Information
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.fullName}
                  onChange={e => setForm({...form, fullName: e.target.value})}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="label">Email Address (Read-only)</label>
                <input 
                  type="email" 
                  className="input bg-surface-50 text-surface-500 cursor-not-allowed" 
                  value={user?.email || ''}
                  disabled
                />
                <p className="text-xs text-surface-400 mt-1">Contact support to change your email address.</p>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto px-6 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Save Profile
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-brand-600" /> Security
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input 
                  type="password" 
                  className="input" 
                  value={form.newPassword}
                  onChange={e => setForm({...form, newPassword: e.target.value})}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="input" 
                  value={form.confirmPassword}
                  onChange={e => setForm({...form, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto px-6 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Update Password
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preferences Sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" /> Notifications
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-10 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </div>
                <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">Email Alerts</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-10 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </div>
                <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">Push Notifications</span>
              </label>
            </div>
            <p className="text-xs text-surface-400 mt-4 leading-relaxed">
              We'll let you know about important account updates and new commissions.
            </p>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5 text-brand-600" /> Appearance
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="border-2 border-brand-500 bg-brand-50 text-brand-700 py-2 rounded-lg text-sm font-bold transition-all">
                Light
              </button>
              <button className="border-2 border-surface-100 text-surface-400 hover:border-surface-200 py-2 rounded-lg text-sm font-bold transition-all opacity-50 cursor-not-allowed">
                Dark
              </button>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-center mt-3 text-surface-400">
              Dark mode coming soon
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
