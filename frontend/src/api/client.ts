import type {
  Alert,
  Capture,
  DNSTransaction,
  EngineerMetrics,
  Flow,
  FlowDetail,
  Graph,
  HTTPTransaction,
  Host,
  Job,
  ProtocolStats,
  TimelineEvent,
  TLSSession,
} from '../types/api'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, init)
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      detail = (await resp.json()).detail ?? detail
    } catch {
      /* no body */
    }
    throw new Error(detail)
  }
  return resp.json()
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  parsers: () => request<Record<string, boolean>>('/captures/meta/parsers'),

  listCaptures: () => request<Capture[]>('/captures'),

  getCapture: (id: string) => request<Capture>(`/captures/${id}`),

  uploadCapture: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Capture>('/captures', { method: 'POST', body: form })
  },

  analyzeCapture: (id: string, parser?: string) =>
    request<Job>(`/captures/${id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parser ? { parser } : {}),
    }),

  getJob: (id: string) => request<Job>(`/jobs/${id}`),

  listJobs: () => request<Job[]>('/jobs'),

  listFlows: (captureId: string, filters?: { transport?: string; direction?: string }) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.transport) params.set('transport', filters.transport)
    if (filters?.direction) params.set('direction', filters.direction)
    return request<Flow[]>(`/flows?${params}`)
  },

  getFlow: (id: string) => request<FlowDetail>(`/flows/${id}`),

  // Hosts (Step 3)
  listHosts: (captureId: string, internal?: boolean) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (internal !== undefined) params.set('internal', String(internal))
    return request<Host[]>(`/hosts?${params}`)
  },

  getHost: (id: string) => request<Host>(`/hosts/${id}`),

  // Protocols (Step 3)
  listDns: (captureId: string, filters?: { domain?: string; rcode?: number }) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.domain) params.set('domain', filters.domain)
    if (filters?.rcode !== undefined) params.set('rcode', String(filters.rcode))
    return request<DNSTransaction[]>(`/protocols/dns?${params}`)
  },

  listHttp: (captureId: string, filters?: { host?: string; status?: number }) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.host) params.set('host', filters.host)
    if (filters?.status !== undefined) params.set('status', String(filters.status))
    return request<HTTPTransaction[]>(`/protocols/http?${params}`)
  },

  listTls: (captureId: string, filters?: { sni?: string }) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.sni) params.set('sni', filters.sni)
    return request<TLSSession[]>(`/protocols/tls?${params}`)
  },

  protocolStats: (captureId: string) =>
    request<ProtocolStats>(`/protocols/stats?capture_id=${captureId}`),

  // Alerts (Step 4)
  listAlerts: (
    captureId: string,
    filters?: { severity?: string; minScore?: number; rule?: string },
  ) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.severity) params.set('severity', filters.severity)
    if (filters?.minScore !== undefined) params.set('min_score', String(filters.minScore))
    if (filters?.rule) params.set('rule', filters.rule)
    return request<Alert[]>(`/alerts?${params}`)
  },

  getAlert: (id: string) => request<Alert>(`/alerts/${id}`),

  ackAlert: (id: string, acknowledged: boolean) =>
    request<Alert>(`/alerts/${id}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged }),
    }),

  // Timeline + Graph + Replay (Step 5)
  getTimeline: (
    captureId: string,
    filters?: {
      host?: string
      protocol?: string
      eventType?: string
      severity?: string
      after?: number
      before?: number
      limit?: number
    },
  ) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (filters?.host) params.set('host', filters.host)
    if (filters?.protocol) params.set('protocol', filters.protocol)
    if (filters?.eventType) params.set('event_type', filters.eventType)
    if (filters?.severity) params.set('severity', filters.severity)
    if (filters?.after !== undefined) params.set('after', String(filters.after))
    if (filters?.before !== undefined) params.set('before', String(filters.before))
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit))
    return request<TimelineEvent[]>(`/timeline?${params}`)
  },

  getGraph: (captureId: string) => request<Graph>(`/graph?capture_id=${captureId}`),

  getReplay: (captureId: string, after?: number) => {
    const params = new URLSearchParams({ capture_id: captureId })
    if (after !== undefined) params.set('after', String(after))
    return request<TimelineEvent[]>(`/replay?${params}`)
  },

  // Engineer Mode (Step 6)
  getEngineerMetrics: (captureId: string) =>
    request<EngineerMetrics>(`/engineer/metrics?capture_id=${captureId}`),
}
