import { default as _log } from "loglevel";

export const log = _log;
log.setDefaultLevel(import.meta.env.MODE === "development" ? "TRACE" : "INFO");
