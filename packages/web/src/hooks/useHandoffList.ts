import { useInfiniteQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'

export interface Handoff {
  id: string
  status: 'draft' | 'awaiting_review' | 'published'
  brief_body: { what_changed: string; what_failed: string; decisions_made: string; next_steps: string; confidence: 'high' | 'medium' | 'low' } | null
  created_at: string
  author_id: string
}

export interface HandoffListResponse {
  items: Handoff[]
  hasMore: boolean
  nextCursor: string | null
  nextCursorId: string | null
}

async function fetchHandoffs(cursor?: string, cursorId?: string): Promise<HandoffListResponse> {
  const params = new URLSearchParams({ limit: '20' })
  if (cursor) params.set('cursor', cursor)
  if (cursorId) params.set('cursorId', cursorId)
  return apiRequest<HandoffListResponse>('/handoffs?' + params.toString())
}

export function useHandoffList(cursor?: string, cursorId?: string) {
  return useInfiniteQuery<HandoffListResponse, Error>({
    queryKey: ['handoffs', cursor],
    queryFn: () => fetchHandoffs(cursor, cursorId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 60000,
  })
}
