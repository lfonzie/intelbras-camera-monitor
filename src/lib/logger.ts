import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';

const logsDirectory = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

// Configuração do logger principal
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'camera-monitor' },
  transports: [
    // Arquivo de log geral
    new transports.File({
      filename: path.join(logsDirectory, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Arquivo de log de erros
    new transports.File({
      filename: path.join(logsDirectory, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Console em desenvolvimento
    ...(process.env.NODE_ENV !== 'production' ? [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      })
    ] : [])
  ],
});

// Logger específico para streams
export const streamLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDirectory, 'streams.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
  ],
});

// Logger específico para autenticação
export const authLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDirectory, 'auth.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
  ],
});

// Logger específico para gravações
export const recordingLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDirectory, 'recording.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
  ],
});

export default logger;
