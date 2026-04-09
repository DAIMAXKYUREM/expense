import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['express', 'vite', '@prisma/client', 'bcryptjs', 'jsonwebtoken', 'cookie-parser', 'cors'],
}).catch(() => process.exit(1));
