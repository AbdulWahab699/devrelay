import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface AnalyticsData {
  totalHandoffs: number
  publishedThisWeek: number
  avgConfidence: string
  slackDeliveryRate: number
  dailyCounts: { date: string; count: number }[]
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => apiRequest<AnalyticsData>('/analytics'),
    staleTime: 60_000,
  })

  const cards = [
    { label: 'Total Handoffs',       value: data?.totalHandoffs ?? '—' },
    { label: 'Published This Week',  value: data?.publishedThisWeek ?? '—' },
    { label: 'Avg Confidence',       value: data?.avgConfidence ?? '—' },
    { label: 'Slack Delivery Rate',  value: data?.slackDeliveryRate != null ? data.slackDeliveryRate + '%' : '—' },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: '1120px', margin: '0 auto', fontFamily: '"Comic Sans MS", cursive' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#E2F1E7', marginBottom: '32px', letterSpacing: '-0.02em' }}>Analytics</h1>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: 'rgba(11,43,38,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '10px', padding: '20px 24px' }}>
            <div style={{ fontSize: '12px', color: '#235347', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</div>
            {isLoading
              ? <div style={{ height: '28px', width: '60%', background: '#163832', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              : <div style={{ fontSize: '28px', fontWeight: 700, color: '#00F5D4' }}>{card.value}</div>
            }
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: 'rgba(11,43,38,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '10px', padding: '24px' }}>
        <div style={{ fontSize: '13px', color: '#8EB69B', marginBottom: '20px', fontWeight: 500 }}>Handoffs per day — last 14 days</div>
        {isLoading ? (
          <div style={{ height: '200px', background: '#163832', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.dailyCounts ?? []} barSize={20}>
              <XAxis dataKey="date" tick={{ fill: '#235347', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#235347', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#163832', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '8px', color: '#E2F1E7', fontFamily: '"Comic Sans MS", cursive' }} cursor={{ fill: 'rgba(0,245,212,0.05)' }} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {(data?.dailyCounts ?? []).map((_, i) => (
                  <Cell key={i} fill="#00F5D4" fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}