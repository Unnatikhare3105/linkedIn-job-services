# apiVersion: v1
# kind: ConfigMap
# metadata:
#   name: es-config
# data:
#   nodes: "http://elasticsearch:9200"
# ---
# apiVersion: v1
# kind: ConfigMap
# metadata:
#   name: app-config
# data:
#   config.json: |
#     {"logLevel":"info"}
# ---
# apiVersion: v1
# kind: Secret
# metadata:
#   name: app-secrets
# type: Opaque
# data:
#   REDIS_PASSWORD: cmVkaXMtcGFzc3dvcmQ= # base64-encoded "redis-password"
#   KAFKA_SASL_PASSWORD: a2Fma2EtcGFzc3dvcmQ= # base64-encoded "kafka-password"
# ---
# apiVersion: apps/v1
# kind: Deployment
# metadata:
#   name: job-search-api
#   labels:
#     app: job-search-api
# spec:
#   replicas: 3
#   selector:
#     matchLabels:
#       app: job-search-api
#   template:
#     metadata:
#       labels:
#         app: job-search-api
#     spec:
#       containers:
#       - name: job-search-api
#         image: your-registry/job-search-api:v2
#         imagePullPolicy: IfNotPresent
#         ports:
#         - containerPort: 3000
#         env:
#         - name: NODE_ENV
#           value: "production"
#         - name: ELASTICSEARCH_NODES
#           valueFrom:
#             configMapKeyRef:
#               name: es-config
#               key: nodes
#         - name: REDIS_HOST
#           value: "redis-service"
#         - name: REDIS_PORT
#           value: "6379"
#         - name: REDIS_PASSWORD
#           valueFrom:
#             secretKeyRef:
#               name: app-secrets
#               key: REDIS_PASSWORD
#         - name: KAFKA_BROKERS
#           value: "kafka-service:9092"
#         - name: KAFKA_SASL_PASSWORD
#           valueFrom:
#             secretKeyRef:
#               name: app-secrets
#               key: KAFKA_SASL_PASSWORD
#         resources:
#           requests:
#             memory: "512Mi"
#             cpu: "250m"
#           limits:
#             memory: "1Gi"
#             cpu: "1"
#         livenessProbe:
#           httpGet:
#             path: /health
#             port: 3000
#           initialDelaySeconds: 15
#           periodSeconds: 10
#           timeoutSeconds: 3
#           failureThreshold: 5
#         readinessProbe:
#           httpGet:
#             path: /health
#             port: 3000
#           initialDelaySeconds: 3
#           periodSeconds: 5
#           timeoutSeconds: 3
#           failureThreshold: 3
#         volumeMounts:
#         - name: config-volume
#           mountPath: /app/config
#           readOnly: true
#       volumes:
#       - name: config-volume
#         configMap:
#           name: app-config
# ---
# apiVersion: v1
# kind: Service
# metadata:
#   name: job-search-api-service
# spec:
#   selector:
#     app: job-search-api
#   ports:
#   - protocol: TCP
#     port: 80
#     targetPort: 3000
#   type: ClusterIP
# ---
# apiVersion: autoscaling/v2
# kind: HorizontalPodAutoscaler
# metadata:
#   name: job-search-api-hpa
# spec:
#   scaleTargetRef:
#     apiVersion: apps/v1
#     kind: Deployment
#     name: job-search-api
#   minReplicas: 3
#   maxReplicas: 100
#   metrics:
#   - type: Resource
#     resource:
#       name: cpu
#       target:
#         type: Utilization
#         averageUtilization: 60
#   - type: Resource
#     resource:
#       name: memory
#       target:
#         type: Utilization
#         averageUtilization: 70
#   - type: Pods
#     pods:
#       metric:
#         name: requests-per-second
#       target:
#         type: AverageValue
#         averageValue: 1000
# ---
# apiVersion: networking.k8s.io/v1
# kind: Ingress
# metadata:
#   name: job-search-ingress
#   annotations:
#     nginx.ingress.kubernetes.io/rewrite-target: /
#     nginx.ingress.kubernetes.io/ssl-redirect: "true"
# spec:
#   tls:
#   - hosts:
#     - api.your-domain.com
#     secretName: job-search-tls
#   rules:
#   - host: api.your-domain.com
#     http:
#       paths:
#       - path: /
#         pathType: Prefix
#         backend:
#           service:
#             name: job-search-api-service
#             port:
#               number: 80