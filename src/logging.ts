import { default as _log } from "loglevel";

export const log = _log;
const defaultLevel =
  VAULTONOMY.releaseTarget === "development" ? "TRACE" : "INFO";
log.setDefaultLevel(defaultLevel);
log.setLevel(defaultLevel);
