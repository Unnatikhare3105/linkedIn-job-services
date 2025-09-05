import express from "express";
const app = express();
import jobRouter from "./routers/job.routes.js";
import applicationRouter from "./routers/jobApplication.routes.js";
import analysisRouter from "./routers/jobAnalysis.routes.js";
import searchRouter from "./routers/search.routes.js";
import searchHistoryRouter from "./routers/searchHistory.routes.js";
import filterRouter from "./routers/filter.routes.js";
import sortRouter from "./routers/sort.routes.js";
import aiRouter from "./routers/ai.routes.js";
import qualityTrustRouter from "./routers/qualityTrust.routes.js";
import companyRouter from "./routers/company.routes.js";
import matchingRouter from "./routers/matching.routes.js";
import { authenticate } from "./auth.js";
import {connectDB} from "./db/db.js";
import {initKafka} from "./config/kafka.js";

connectDB();
initKafka();

app.use(authenticate);
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Job Service");
});

app.use("/jobs", jobRouter);
app.use("/jobs/applications", applicationRouter);
app.use("/jobs/analysis", analysisRouter);
app.use("/jobs/search", searchRouter);
app.use("/jobs/filters", filterRouter); 
app.use("/jobs/search-history", searchHistoryRouter);
app.use("/jobs/sort", sortRouter);
app.use("/jobs/ai", aiRouter);
app.use("/jobs/quality-trust", qualityTrustRouter);
app.use("/jobs/company", companyRouter);
app.use("/jobs/matching", matchingRouter);


export default app;