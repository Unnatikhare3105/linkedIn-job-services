    
    
    
    
    

# Project Description

The `linkedIn-job-services` project is a scalable job platform built with Node.js, Express, MongoDB, and Docker, designed using a microservices architecture. It replicates core LinkedIn job features (job search, filters, easy apply, save jobs, job alerts, recommendations, analytics) and adds custom features like AI matching, skill gap analysis, and detailed feedback. Each service is containerized and orchestrated via Docker Compose, with Kafka for event-driven communication, Redis for caching, and healthchecks for reliability. The system is production-ready, with modular code, persistent volumes, and secure practices.

# Folder Structure
```
LINKEDIN JOB SERVICES
│   .gitignore
│   docker-compose.yml
│   Dockerfile
│   jest.config.js
│   package.json
│   package-lock.json
│   README.md
│
└───src
    │   app.js
    │   auth.js
    │   random.js
    │
    ├───config
    │       cache.ttl.js
    │       circuitBreaker.js
    │       elasticSearch.client.js
    │       kafka.js
    │       pinecone.js
    │       rate.limiter.js
    │       redis.js
    │       weivetclient.js
    │
    ├───constants
    │       http.js
    │
    ├───controllers
    │       ai.controllers.js
    │       company.controller.js
    │       filter.controllers.js
    │       jobAnalysis.controller.js
    │       jobApplication.controller.js
    │       jobs.controller.js
    │       matching.controller.js
    │       qualityTrust.controller.js
    │       search.controller.js
    │       searchHistory.controller.js
    │       sort.controller.js
    │
    ├───db
    │       db.js
    │
    ├───kafka
    │       consumer.js
    │       producer.js
    │
    ├───model
    │       company.model.js
    │       job.model.js
    │       jobAnalysis.model.js
    │       jobApplication.model.js
    │       qualityTrust.model.js
    │       searchHistory.model.js
    │
    ├───routers
    │       ai.routes.js
    │       company.routes.js
    │       filter.routes.js
    │       job.routes.js
    │       jobAnalysis.routes.js
    │       jobApplication.routes.js
    │       matching.routes.js
    │       qualityTrust.routes.js
    │       search.routes.js
    │       searchHistory.routes.js
    │       sort.routes.js
    │
    ├───services
    │       ai.services.js
    │       application.services.js
    │       job.services.js
    │       matching.services.js
    │       qualityTrust.services.js
    │       search.services.js
    │       sort.services.js
    │
    ├───utils
    │       CustomError.js
    │       CustomSuccess.js
    │       logger.js
    │       metrics.js
    │       security.js
    │       withLocks.js
    │
    └───validations
            ai.validations.js
            analytics.validations.js
            application.validations.js
            company.validation.js
            filter.validations.js
            job.validations.js
            qualityTrust.validations.js
            search.validations.js
            searchHistory.validations.js
            sort.validations.js
```