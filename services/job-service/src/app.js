import express from "express";
const app = express();
import jobRouter from "./routers/job.router.js";
import applicationRouter from "./routers/jobApplication.router.js";
import analysisRouter from "./routers/jobAnalysis.router.js";
import searchRouter from "./routers/search.router.js";
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

export default app;