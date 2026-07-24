import React from 'react'

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 flex flex-col justify-between h-[130px] animate-pulse">
          <div className="flex items-center justify-between">
            <div className="w-24 h-3.5 bg-surface-200 rounded-md" />
            <div className="w-10 h-10 rounded-2xl bg-surface-200" />
          </div>
          <div className="space-y-2">
            <div className="w-32 h-7 bg-surface-300 rounded-lg" />
            <div className="w-20 h-3 bg-surface-200 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="glass-card overflow-hidden w-full">
      {/* Desktop Table Skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-50/70 border-b border-surface-100">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="py-3.5 px-4">
                  <div className="w-20 h-3 bg-surface-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="animate-pulse">
                <td className="py-3.5 px-4">
                  <div className="w-28 h-4 bg-surface-200 rounded-md mb-1.5" />
                  <div className="w-20 h-3 bg-surface-100 rounded" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="w-32 h-4 bg-surface-200 rounded-md mb-1.5" />
                  <div className="w-24 h-3 bg-surface-100 rounded" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="w-24 h-4 bg-surface-300 rounded-md mb-1.5" />
                  <div className="w-12 h-3 bg-surface-100 rounded" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="w-20 h-6 bg-surface-200 rounded-full" />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="w-20 h-7 bg-surface-200 rounded-lg ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Skeleton */}
      <div className="md:hidden divide-y divide-surface-100 p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="pt-4 first:pt-0 animate-pulse space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <div className="w-28 h-4 bg-surface-200 rounded-md" />
                <div className="w-36 h-3 bg-surface-100 rounded" />
              </div>
              <div className="w-20 h-5 bg-surface-300 rounded-md" />
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="w-20 h-6 bg-surface-200 rounded-full" />
              <div className="w-20 h-7 bg-surface-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-surface-200 rounded-md" />
              <div className="w-1/2 h-3 bg-surface-100 rounded" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="w-full h-3 bg-surface-100 rounded" />
            <div className="w-5/6 h-3 bg-surface-100 rounded" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-surface-100">
            <div className="w-16 h-6 bg-surface-200 rounded-full" />
            <div className="w-24 h-8 bg-surface-200 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
