    
    
    
    
    

# Project Description

The `linkedIn-job-services` project is a scalable job platform built with Node.js, Express, MongoDB, and Docker, designed using a microservices architecture. It replicates core LinkedIn job features (job search, filters, easy apply, save jobs, job alerts, recommendations, analytics) and adds custom features like AI matching, skill gap analysis, and detailed feedback. Each service is containerized and orchestrated via Docker Compose, with Kafka for event-driven communication, Redis for caching, and healthchecks for reliability. The system is production-ready, with modular code, persistent volumes, and secure practices.

# Folder Structure

```
linkedIn-job-services/
│
├── docker-compose.yml
├── projectOverview.md
├── read.md
├── efse.js
├── services/
│   └── job-service/
│       ├── Dockerfile
│       ├── package.json
│       ├── package-lock.json
│       ├── server.js
│       ├── .env
│       ├── logs/
│       └── src/
│           ├── app.js
│           ├── auth.js
│           ├── config/
│           │   ├── kafka.js
│           │   ├── redis.js
│           │   ├── weivetclient.js
│           ├── controllers/
│           │   ├── filter.controllers.js
│           │   ├── jobAnalysis.controller.js
│           │   ├── jobApplication.controller.js
│           │   ├── jobs.controller.js
│           │   ├── search.controller.js
│           │   ├── sort.controller.js
│           ├── db/
│           │   └── db.js
│           ├── kafka/
│           │   ├── consumer.js
│           │   ├── producer.js
│           ├── model/
│           │   ├── job.model.js
│           │   ├── jobAnalysis.model.js
│           │   ├── jobApplication.model.js
│           ├── routers/
│           │   ├── job.router.js
│           ├── services/
│           │   ├── job.services.js
│           ├── utils/
│           │   ├── CustomError.js
│           │   ├── CustomSuccess.js
│           │   ├── logger.js
│           │   ├── security.js
│           │   ├── validators.js
│
└── .git/
```