import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Wrench, MapPin, Star, Calendar, Clock, CheckCircle2, ChevronRight, Search } from 'lucide-react'
import type { Order } from '@/types'

// Local interface extending user with installer profile data
interface Installer {
  id: string
  full_name: string
  avatar_url: string | null
  installer_profiles: {
    location: string
    is_available: boolean
    rating: number
    total_jobs: number
  }[]
}

export function DSAInstallerBooking() {
  const { user } = useAuthStore()
  const [installers, setInstallers] = useState<Installer[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [booking, setBooking] = useState<string | null>(null) // installer id being booked

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authId = session?.user?.id

      // 1. Fetch available installers
      const { data: installerData } = await supabase
        .from('users')
        .select(`
          id, full_name, avatar_url,
          installer_profiles ( location, is_available, rating, total_jobs )
        `)
        .eq('role', 'installer')
        .eq('status', 'active')

      // 2. Fetch DSA's pending orders that need installation
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .or(`dsa_id.eq.${user?.id},created_by_auth_id.eq.${authId}`)
        .eq('status', 'pending')

      if (installerData) {
        // Filter out installers with no profile or who are unavailable
        const validInstallers = installerData.filter(i => i.installer_profiles && i.installer_profiles.length > 0 && i.installer_profiles[0].is_available) as unknown as Installer[]
        setInstallers(validInstallers)
      }
      
      if (orderData) {
        setPendingOrders(orderData)
        if (orderData.length > 0) setSelectedOrder(orderData[0].id)
      }
    } catch (err) {
      console.error('Error fetching booking data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBookInstaller = async (installerId: string) => {
    if (!selectedOrder) return alert('Please select an order first')
    setBooking(installerId)

    try {
      // Schedule for 2 days from now by default (simple logic for MVP)
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + 2)

      const { error } = await supabase
        .from('installer_jobs')
        .insert([{
          installer_id: installerId,
          order_id: selectedOrder,
          scheduled_date: scheduledDate.toISOString(),
          status: 'assigned',
          commission_amount: 15000 // Default flat fee for installer
        }])

      if (error) throw error

      alert('Installer successfully booked!')
      
      // Remove the order from pending list
      setPendingOrders(prev => prev.filter(o => o.id !== selectedOrder))
      setSelectedOrder(null)

    } catch (err: any) {
      console.error('Error booking installer:', err)
      if (err.code === '23505') {
        alert('An installer is already booked for this order.')
      } else {
        alert('Failed to book installer')
      }
    } finally {
      setBooking(null)
    }
  }

  const filteredInstallers = installers.filter(i => 
    i.full_name.toLowerCase().includes(search.toLowerCase()) || 
    i.installer_profiles[0].location.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installer Booking</h1>
          <p className="text-sm text-surface-500 mt-1">Assign verified technicians to your pending orders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Select Order */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">1. Select Pending Order</h2>
          
          {loading ? (
            <div className="glass-card h-48 animate-pulse bg-surface-100/50" />
          ) : pendingOrders.length === 0 ? (
            <div className="glass-card p-8 text-center border-2 border-dashed border-surface-200">
              <CheckCircle2 className="w-8 h-8 text-success-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-surface-900">All caught up!</p>
              <p className="text-xs text-surface-500 mt-1">You have no pending orders requiring installation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedOrder === order.id 
                      ? 'border-brand-500 bg-brand-50/50 shadow-sm' 
                      : 'border-surface-100 bg-white hover:border-surface-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className={`font-bold ${selectedOrder === order.id ? 'text-brand-900' : 'text-surface-900'}`}>
                      {order.customer_name}
                    </p>
                    <span className="text-xs font-bold text-surface-500 bg-surface-100 px-2 py-0.5 rounded">
                      {order.order_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-surface-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{order.customer_address}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Select Installer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">2. Choose Technician</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search location..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-surface-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-48 transition-all"
              />
            </div>
          </div>

          <div className="glass-card p-2 min-h-[400px]">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-surface-100/50 rounded-xl animate-pulse" />)}
              </div>
            ) : !selectedOrder ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
                <ChevronRight className="w-8 h-8 text-surface-300 mb-3" />
                <p className="text-sm font-medium text-surface-500">Select an order on the left to see available technicians</p>
              </div>
            ) : filteredInstallers.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
                <Wrench className="w-8 h-8 text-surface-300 mb-3" />
                <p className="text-sm font-medium text-surface-500">No available technicians found in this area.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                <AnimatePresence>
                  {filteredInstallers.map(installer => {
                    const profile = installer.installer_profiles[0]
                    return (
                      <motion.div
                        key={installer.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-surface-100 rounded-xl p-4 hover:border-brand-200 hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {installer.full_name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-surface-900 leading-tight">{installer.full_name}</h3>
                            <div className="flex items-center gap-1 mt-1 text-xs text-surface-500">
                              <MapPin className="w-3 h-3" /> {profile.location}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                          <div className="bg-surface-50 rounded-lg py-1.5">
                            <div className="flex items-center justify-center gap-1 text-amber-500 text-sm font-bold">
                              <Star className="w-3.5 h-3.5 fill-current" /> {profile.rating.toFixed(1)}
                            </div>
                            <span className="text-[10px] text-surface-500 uppercase font-semibold">Rating</span>
                          </div>
                          <div className="bg-surface-50 rounded-lg py-1.5">
                            <div className="text-surface-900 text-sm font-bold">{profile.total_jobs}</div>
                            <span className="text-[10px] text-surface-500 uppercase font-semibold">Jobs Done</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleBookInstaller(installer.id)}
                          disabled={booking === installer.id}
                          className="mt-auto btn-primary w-full py-2.5 text-sm"
                        >
                          {booking === installer.id ? 'Booking...' : 'Book Technician'}
                        </button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
