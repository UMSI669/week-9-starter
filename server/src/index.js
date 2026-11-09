/**
 * Entry point. Refuses to start on a fatal misconfiguration rather than
 * booting into a state that looks fine and is not.
 */

import { config, configurationStatus, startupProblems } from './config.js';
import { createApp } from './app.js';

const problems = startupProblems();
if (problems.length > 0) {
  console.error('\nDream Decoder backend cannot start:\n');
  problems.forEach((problem) => console.error(`  * ${problem}\n`));
  console.error('See server/.env.example and API_SETUP.md.\n');
  process.exit(1);
}

const app = createApp();
const status = configurationStatus();

const server = app.listen(config.port, config.host, () => {
  console.log(`Dream Decoder backend listening on http://${config.host}:${config.port}`);
  console.log(
    `  analysis:      ${status.analysis.configured ? `ready (${status.analysis.model})` : `NOT configured (missing ${status.analysis.missing.join(', ')})`}`,
  );
  console.log(
    `  transcription: ${status.transcription.configured ? `ready (${status.transcription.model})` : 'disabled (phone transcription only)'}`,
  );
  console.log('  auth:          bearer token required');
  console.log(
    '\nPoint the app at this machine’s LAN address, not localhost:\n' +
      '  EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:' + config.port + '\n',
  );
});

function shutdown(signal) {
  console.log(`\n${signal} received, closing server.`);
  server.close(() => process.exit(0));
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
