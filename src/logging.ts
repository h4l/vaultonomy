import { default as _log } from "loglevel";

export const log = _log;
const defaultLevel = import.meta.env.MODE === "development" ? "TRACE" : "INFO";
log.setDefaultLevel(defaultLevel);
log.setLevel(defaultLevel);
