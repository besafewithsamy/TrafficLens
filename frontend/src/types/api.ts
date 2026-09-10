
export interface Page<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface Capture {
  id: string
  filename: string
  stored_path: string | null
  source: string
  status: 'created' | 'queued' | 'analyzing' | 'completed' | 'failed' | 'stopped'
  start_time: number | null
  end_time: number | null
  first_packet_ts: number | null
  last_packet_ts: number | null
  packet_count: number
  analyzed_packet_count: number
  size_bytes: number
  analysis_progress: number
  parser_used: string | null
  error: string | null
  created_at: string
  completed_at: string | null
  summary: CaptureSummary
}

export interface CaptureSummary {
  protocol_counts?: Record<string, number>
  transport_counts?: Record<string, number>
  unique_source_ips?: number
  unique_destination_ips?: number
  top_talkers?: { ip: string; packets: number }[]
  warnings?: string[]
  flow_summary?: FlowSummary
  host_count?: number
  internal_host_count?: number
  dns_summary?: { transactions: number; unique_domains: number; nxdomain_count: number }
  http_summary?: { transactions: number }
  tls_summary?: { sessions: number; unique_sni: number }
  alert_summary?: {
    total: number
    by_severity: Record<string, number>
    by_rule: Record<string, number>
    max_score: number
  }
  incidents?: {
    source_ip: string
    rule_names: string[]
    alert_count: number
    max_score: number
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    first_seen: number
    last_seen: number
    alert_ids: (string | null)[]
    title: string
    story: string
  }[]
  top_flows_by_bytes?: {
    source_ip: string
    destination_ip: string
    destination_port: number
    transport_protocol: string
    bytes: number
    packets: number
  }[]
}

export interface Job {
  id: string
  capture_id: string
  type: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  stage: string
  message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  result: {
    packets?: number
    parser?: string
    flows?: number
    protocols?: Record<string, number>
  }
}

export interface FlowSummary {
  flow_count?: number
  tcp_flows?: number
  udp_flows?: number
  failed_flows?: number
  reset_flows?: number
  retransmitting_flows?: number
  tcp_states?: Record<string, number>
  direction_counts?: Record<string, number>
}

export interface Flow {
  id: string
  capture_id: string
  source_ip: string
  destination_ip: string
  source_port: number
  destination_port: number
  transport_protocol: 'TCP' | 'UDP'
  application_protocol: string | null
  first_seen: number
  last_seen: number
  packets: number
  bytes: number
  packets_forward: number
  bytes_forward: number
  packets_reverse: number
  bytes_reverse: number
  duration: number
  direction: 'outbound' | 'inbound' | 'internal' | 'unknown'
  tcp_state: string | null
  retransmissions: number
  resets: number
  syn_count: number
  syn_retransmissions: number
  failed: boolean
  created_at: string
}

export interface PacketEvidence {
  timestamp: number
  source_ip: string | null
  destination_ip: string | null
  protocol: string | null
  transport: string | null
  source_port: number | null
  destination_port: number | null
  length: number
  flags: string[]
  metadata: Record<string, unknown>
  packet_reference: number
}

export interface FlowDetail extends Flow {
  packet_evidence: PacketEvidence[]
}

export interface HostService {
  port: number
  service: string
  transport: string
  packets: number
}

export interface HostContacted {
  ip: string
  port: number
  app_protocol: string
  packets: number
  bytes: number
}

export interface Host {
  id: string
  capture_id: string
  ip: string
  mac: string | null
  hostname: string | null
  is_internal: boolean
  first_seen: number
  last_seen: number
  packets_sent: number
  packets_received: number
  bytes_sent: number
  bytes_received: number
  protocols: Record<string, number>
  services: HostService[]
  contacted: HostContacted[]
  role: string | null
  behavior_summary: {
    dominant_protocol?: string
    protocol_distribution?: Record<string, number>
    unique_peers?: number
    services_exposed?: number
    connections_initiated?: number
  }
}

export interface DNSTransaction {
  id: string
  capture_id: string
  transaction_id: number
  client_ip: string
  server_ip: string
  query_name: string
  query_type: string | null
  response_ips: string[]
  is_response: boolean
  rcode: number | null
  latency: number | null
  timestamp: number
  packet_ref: number
}

export interface HTTPTransaction {
  id: string
  capture_id: string
  client_ip: string
  server_ip: string
  server_port: number
  method: string | null
  host: string | null
  path: string | null
  user_agent: string | null
  status_code: number | null
  request_len: number
  response_len: number
  timestamp: number
  packet_ref: number
}

export interface TLSSession {
  id: string
  capture_id: string
  client_ip: string
  server_ip: string
  server_port: number
  sni: string | null
  version: string | null
  bytes: number
  packets: number
  first_seen: number
  last_seen: number
}

export interface ProtocolStats {
  dns: {
    transactions: number
    unique_domains: number
    nxdomain_count: number
    nxdomain_rate: number
    avg_latency: number | null
    top_domains: { value: string; count: number }[]
    nxdomain_domains: { value: string; count: number }[]
    longest_queries: string[]
  }
  http: {
    transactions: number
    status_codes: Record<string, number>
    methods: Record<string, number>
    top_hosts: { value: string; count: number }[]
    user_agents: Record<string, number>
    total_request_bytes: number
    total_response_bytes: number
  }
}

export interface AlertReason {
  reason: string
  detail: string
  weight: number
}

export interface Alert {
  id: string
  capture_id: string
  rule_name: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  score: number
  source_ip: string | null
  destination_ip: string | null
  destination_port: number | null
  reasons: AlertReason[]
  evidence: Record<string, unknown>
  related_flow_ids: string[]
  related_packet_refs: number[]
  explanation: string | null
  acknowledged: boolean
  timestamp: number | null
  created_at: string
}

export interface TimelineEvent {
  id: string
  capture_id: string
  event_type: string
  label: string
  timestamp: number
  source_ip: string | null
  destination_ip: string | null
  destination_port: number | null
  protocol: string | null
  domain: string | null
  severity: string | null
  detail: Record<string, unknown>
  related_flow_id: string | null
  related_alert_id: string | null
  packet_ref: number | null
}

export interface GraphNodeData {
  id: string
  label?: string
  type?: 'host' | 'domain' | 'service'
  role?: string | null
  hostname?: string | null
  internal?: boolean
  bytes_sent?: number
  bytes_received?: number
  alert_count?: number
  port?: number
  service?: string
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
  type: string
  packets?: number
  bytes?: number
  count?: number
  flow_ids?: string[]
}

export interface Graph {
  nodes: { data: GraphNodeData }[]
  edges: { data: GraphEdgeData }[]
  stats: {
    node_count: number
    edge_count: number
    host_count: number
    domain_count: number
    service_count: number
  }
}

export interface EngineerIssue {
  issue: string
  severity: 'high' | 'medium' | 'low' | 'info'
  detail: string
}

export interface EngineerMetrics {
  capture_duration_s: number
  total_packets: number
  total_bytes: number
  avg_pps: number
  peak_pps: number
  avg_bandwidth_bps: number
  peak_bandwidth_bps: number
  protocol_distribution: Record<string, number>
  transport_distribution: Record<string, number>
  tcp: {
    flows: number
    retransmissions: number
    retransmission_ratio: number
    syn_retransmissions: number
    resets: number
    reset_ratio: number
    failed_flows: number
    failure_ratio: number
    one_way_flows: number
  }
  dns: {
    transactions: number
    avg_latency_ms: number | null
    max_latency_ms: number | null
    p95_latency_ms: number | null
    nxdomain_rate: number
  }
  top_talkers: { ip: string; sent_bytes: number; received_bytes: number; packets: number }[]
  max_packet_size: number
  mtu_boundary_packets: number
  timeseries: {
    pps: { t: number; pps: number }[]
    bandwidth: { t: number; bps: number }[]
  }
  issues: EngineerIssue[]
  health: 'healthy' | 'warning' | 'degraded'
}
