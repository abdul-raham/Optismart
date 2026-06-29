import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: any
  prefix?: string
  trend?: { value: number; isPositive: boolean }
  color: 'brand' | 'success' | 'warning' | 'danger'
  delay?: number
}

const COLOR_MAP = {
  brand: {
    bg: 'bg-brand-50',
    icon: 'text-brand-600',
  },
  success: {
    bg: 'bg-success-50',
    icon: 'text-success-600',
  },
  warning: {
    bg: 'bg-warning-50',
    icon: 'text-warning-600',
  },
  danger: {
    bg: 'bg-danger-50',
    icon: 'text-danger-600',
  },
}

export function StatCard({ title, value, icon: Icon, prefix, trend, color, delay = 0 }: StatCardProps) {
  const styles = COLOR_MAP[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card-hover p-5 flex flex-col gap-3 relative overflow-hidden group"
    >
      <div className={cn('absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-50 blur-2xl transition-transform group-hover:scale-150', styles.bg)} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', styles.bg)}>
          <Icon className={cn('w-6 h-6', styles.icon)} />
        </div>
        
        {trend && (
          <div className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1',
            trend.isPositive ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </div>
        )}
      </div>

      <div className="relative z-10 mt-1">
        <p className="text-sm font-semibold text-surface-500 mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xl font-bold text-surface-400">{prefix}</span>}
          <h3 className="text-3xl font-extrabold text-surface-900 tracking-tight">{value}</h3>
        </div>
      </div>
    </motion.div>
  )
}
