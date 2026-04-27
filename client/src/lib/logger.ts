const isDev = import.meta.env.DEV;

type Meta = unknown;

const formatArgs = (message: string, meta?: Meta) =>
  meta === undefined ? [message] : [message, meta];

export const logger = {
  debug(message: string, meta?: Meta) {
    if (!isDev) return;
    console.debug(...formatArgs(message, meta));
  },
  info(message: string, meta?: Meta) {
    if (!isDev) return;
    console.info(...formatArgs(message, meta));
  },
  warn(message: string, meta?: Meta) {
    console.warn(...formatArgs(message, meta));
  },
  error(message: string, meta?: Meta) {
    console.error(...formatArgs(message, meta));
  },
};
