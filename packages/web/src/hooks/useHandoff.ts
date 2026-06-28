import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import type { HandoffBrief } from '@devrelay/shared'

export interface HandoffDetail {
  id: string
  status: 'draft' | 'awaiting_review' | 'published'
  brief_body: HandoffBrief | null
  created_at: string
  published_at: string | null
  slack_ts: string | null
  author_id: string
}

export function useHandoff(id: string) {
  return useQuery<HandoffDetail>({
    queryKey: ['handoff', id],
    queryFn: () => apiRequest<HandoffDetail>('/handoffs/' + id),
    refetchInterval: (query) => {
      return query.state.data?.status === 'awaiting_review' ? 3000 : false
    },
    staleTime: 0,
  })
}
