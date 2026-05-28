import fs from 'fs';
import path from 'path';

export function writeLog(action: string, details: string) {
  try {
    const logPath = path.resolve(__dirname, '../../../server.log');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${action.toUpperCase()}: ${details}\n`;
    fs.appendFileSync(logPath, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}
