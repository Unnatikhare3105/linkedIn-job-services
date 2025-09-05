import promClient from "prom-client";

// Prometheus metrics

const serviceLatency = new promClient.Histogram({
  name: "quality_trust_service_latency_seconds",
  help: "Quality Trust service operation latency in seconds",
  labelNames: ["operation"],
});
const serviceErrors = new promClient.Counter({
  name: "quality_trust_service_errors_total",
  help: "Total Quality Trust service errors",
  labelNames: ["operation"],
});

const aiOperationLatency = new promClient.Histogram({
  name: "ai_service_operation_latency_seconds",
  help: "AI service operation latency in seconds",
  labelNames: ["operation"],
});
const aiOperationErrors = new promClient.Counter({
  name: "ai_service_operation_errors_total",
  help: "Total AI service operation errors",
  labelNames: ["operation"],
});

const requestCounter = new promClient.Counter({
  name: "quality_trust_controller_requests_total",
  help: "Total Quality Trust controller requests",
  labelNames: ["endpoint", "status"],
});
const requestLatency = new promClient.Histogram({
  name: "quality_trust_controller_latency_seconds",
  help: "Quality Trust controller request latency in seconds",
  labelNames: ["endpoint"],
});

// Prometheus metrics
const ai_requestCounter = new promClient.Counter({
  name: "ai_controller_requests_total",
  help: "Total AI controller requests",
  labelNames: ["endpoint", "status"],
});
const ai_requestLatency = new promClient.Histogram({
  name: "ai_controller_request_latency_seconds",
  help: "AI controller request latency in seconds",
  labelNames: ["endpoint"],
});

// Prometheus metrics
const schemaOperationLatency = new promClient.Histogram({
  name: "quality_trust_schema_operation_latency_seconds",
  help: "Latency of QualityTrust schema operations in seconds",
  labelNames: ["operation"],
});
const schemaOperationErrors = new promClient.Counter({
  name: "quality_trust_schema_operation_errors_total",
  help: "Total errors in QualityTrust schema operations",
  labelNames: ["operation"],
});