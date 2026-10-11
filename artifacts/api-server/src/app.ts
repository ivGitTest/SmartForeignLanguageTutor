import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import prototypeRouter from "./routes/prototype";
import { prototypeError } from "./lib/prototype-errors";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Browser authentication is same-origin; never enable credentialed wildcard CORS.
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);
app.use("/language-prototype/api/v1", prototypeRouter);
app.use(prototypeError);

export default app;
