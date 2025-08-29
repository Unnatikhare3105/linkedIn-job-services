import http from "http";
import app from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const server = http.createServer(app);

server.listen(process.env.PORT, () => {
    console.log(`Job service running on port ${process.env.PORT}`);
});
server.setTimeout(30000);