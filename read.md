    
    
    
    
    
    linkedin-jobs/
│
├── discovery-service/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── kafka.js
│   │   │   ├── redis.js
│   │   │   ├── env.js
│   │   │   └── swagger.js
│   │   │
│   │   ├── db/
│   │   │   ├── Job.js
│   │   │   ├── User.js
│   │   │   └── CompanyReview.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── homepage.js
│   │   │   ├── search.js
│   │   │   ├── filters.js
│   │   │   ├── recommendations.js
│   │   │   └── similarJobs.js
│   │   │
│   │   ├── services/
│   │   │   ├── matching.js
│   │   │   ├── skillGap.js
│   │   │   ├── reviews.js
│   │   │   ├── search.js
│   │   │   └── recommendations.js
│   │   │
│   │   ├── routes/
│   │   │   └── jobs.js
│   │   │
│   │   ├── middlewares/
│   │   │   ├── auth.js
│   │   │   ├── rateLimit.js
│   │   │   ├── errorHandler.js
│   │   │   └── security.js
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── nlp.js
│   │   │   └── responses.js
│   │   │
│   │   ├── common/
│   │   │   ├── errors.js
│   │   │   └── constants.js
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env
│   ├── package.json
│   └── Dockerfile
│
├── application-service/
│   ├── src/
│   │   ├── config/ (db.js, kafka.js, redis.js, env.js, swagger.js)
│   │   ├── db/ (Application.js, User.js, Job.js)
│   │   ├── controllers/ (easyApply.js, applied.js)
│   │   ├── services/ (matching.js, feedback.js)
│   │   ├── routes/ (apps.js)
│   │   ├── middlewares/ (auth.js, rateLimit.js, errorHandler.js, security.js)
│   │   ├── utils/ (logger.js, nlp.js, responses.js)
│   │   ├── common/ (errors.js, constants.js)
│   │   ├── tests/ (unit/, integration/)
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env
│   ├── package.json
│   └── Dockerfile
│
├── user-interaction-service/
│   ├── src/
│   │   ├── config/ (db.js, kafka.js, redis.js, env.js, swagger.js)
│   │   ├── db/ (SavedJob.js, ViewedJob.js, User.js)
│   │   ├── controllers/ (saveJobs.js, viewed.js, reviewController.js)
│   │   ├── services/ (interactions.js)
│   │   ├── routes/ (interactions.js)
│   │   ├── middlewares/ (auth.js, rateLimit.js, errorHandler.js, security.js)
│   │   ├── utils/ (logger.js, responses.js)
│   │   ├── common/ (errors.js, constants.js)
│   │   ├── tests/ (unit/, integration/)
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env
│   ├── package.json
│   └── Dockerfile
│
├── notification-service/
│   ├── src/
│   │   ├── config/ (db.js, kafka.js, redis.js, env.js, swagger.js)
│   │   ├── db/ (JobAlert.js, Job.js)
│   │   ├── controllers/ (alerts.js)
│   │   ├── services/ (alerts.js)
│   │   ├── routes/ (alerts.js)
│   │   ├── middlewares/ (auth.js, rateLimit.js, errorHandler.js, security.js)
│   │   ├── utils/ (logger.js, responses.js)
│   │   ├── common/ (errors.js, constants.js)
│   │   ├── tests/ (unit/, integration/)
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env
│   ├── package.json
│   └── Dockerfile
│
├── ml-service/
│   ├── src/
│   │   ├── config/kafka.py
│   │   ├── services/ (nlp.py, ml.py)
│   │   ├── pipelines/
│   │   ├── models/
│   │   ├── notebooks/
│   │   └── utils/logger.py
│   │
│   ├── requirements.txt
│   └── Dockerfile.ml
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   └── nginx/
│
├── .env
└── README.md


The linkedin-jobs project is a robust, scalable job platform built on the MERn stack (MongoDB, Express.js, React, Node.js) to handle 1 million users, designed with a microservices architecture to replicate 10 core LinkedIn job features—Jobs Homepage (displaying recent job listings with company reviews), Job Search (keyword-based job search), Job Filters (filtering by location, job type, experience), Easy Apply (one-click job applications), Save Jobs (bookmarking jobs), Job Alerts (automated job notifications), Recently Applied (tracking user applications), Recently Viewed (tracking viewed jobs), Job Recommendations (personalized job suggestions), and Similar Jobs (jobs matching skills or criteria)—alongside 4 innovative custom features: AI Matching Score/ATS Checker (resume-job compatibility analysis), Skill Gap Analysis (identifying missing skills for jobs), Anonymous Company Reviews (user-submitted anonymous feedback on companies), and Detailed Job Application Feedback (ATS-driven application insights). The project is organized into five services: discovery-service manages Homepage, Search, Filters, Recommendations, Similar Jobs, AI Matching, Skill Gap, and Reviews, using MongoDB schemas (Job.js for job listings, User.js for user profiles, CompanyReview.js for reviews) and APIs for search/filtering/recommendations, with Kafka for event handling (e.g., job-viewed) and Redis for caching hot jobs; application-service handles Easy Apply, Recently Applied, Feedback, and AI Matching with schemas (Application.js, User.js, Job.js); user-interaction-service manages Save Jobs and Recently Viewed with schemas (SavedJob.js, ViewedJob.js, User.js); notification-service handles Job Alerts with schemas (JobAlert.js, Job.js) and Kafka for event-driven alerts; and ml-service is planned for future NLP/ML integration (using BERT for AI Matching/Reviews and scikit-learn for Skill Gap). Each service follows a consistent folder structure (src/config for DB/Kafka/Redis configs, db for schemas, controllers for API logic, services for business logic, routes for endpoints, middlewares for auth/rate-limiting/security, utils for logging/responses, tests for unit/integration tests), with individual .env (e.g., DB_URI, KAFKA_BROKER), package.json (dependencies like Express, Mongoose), and Dockerfile for containerization. A shared docker-compose.yml orchestrates all services, MongoDB, Kafka, Redis, and Nginx for load balancing, ensuring scalability with MongoDB sharding, Kafka partitioning, and Redis caching. Additional tools like Prometheus/Grafana for monitoring and Jest for testing make it production-ready, with Swagger for API documentation.