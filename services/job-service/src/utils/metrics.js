import promClient from "prom-client";
import * as prometheus from 'prom-client';

// Prometheus metrics

export const serviceLatency = new promClient.Histogram({
  name: "quality_trust_service_latency_seconds",
  help: "Quality Trust service operation latency in seconds",
  labelNames: ["operation"],
});

export const serviceErrors = new promClient.Counter({
  name: "quality_trust_service_errors_total",
  help: "Total Quality Trust service errors",
  labelNames: ["operation"],
});

export const aiOperationLatency = new promClient.Histogram({
  name: "ai_service_operation_latency_seconds",
  help: "AI service operation latency in seconds",
  labelNames: ["operation"],
});

export const aiOperationErrors = new promClient.Counter({
  name: "ai_service_operation_errors_total",
  help: "Total AI service operation errors",
  labelNames: ["operation"],
});

export const requestCounter = new promClient.Counter({
  name: "quality_trust_controller_requests_total",
  help: "Total Quality Trust controller requests",
  labelNames: ["endpoint", "status"],
});

export const requestLatency = new promClient.Histogram({
  name: "quality_trust_controller_latency_seconds",
  help: "Quality Trust controller request latency in seconds",
  labelNames: ["endpoint"],
});

// Prometheus metrics
export const ai_requestCounter = new promClient.Counter({
  name: "ai_controller_requests_total",
  help: "Total AI controller requests",
  labelNames: ["endpoint", "status"],
});

export const ai_requestLatency = new promClient.Histogram({
  name: "ai_controller_request_latency_seconds",
  help: "AI controller request latency in seconds",
  labelNames: ["endpoint"],
});

// Prometheus metrics
export const schemaOperationLatency = new promClient.Histogram({
  name: "quality_trust_schema_operation_latency_seconds",
  help: "Latency of QualityTrust schema operations in seconds",
  labelNames: ["operation"],
});

export const schemaOperationErrors = new promClient.Counter({
  name: "quality_trust_schema_operation_errors_total",
  help: "Total errors in QualityTrust schema operations",
  labelNames: ["operation"],
});


export const searchDuration = new prometheus.Histogram({
  name: 'search_duration_seconds',
  help: 'Search request duration in seconds',
  labelNames: ['search_type', 'status', 'user_type'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const searchRequests = new prometheus.Counter({
  name: 'search_requests_total',
  help: 'Total number of search requests',
  labelNames: ['search_type', 'status']
});

export const activeSearches = new prometheus.Gauge({
  name: 'active_searches_total',
  help: 'Number of currently active search requests'
});

export const cacheHits = new prometheus.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type']
});
