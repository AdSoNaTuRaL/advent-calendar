import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, {maxBuffer:16*1024*1024});
const paths = git('ls-files', '--stage', '-z').toString().split('\0').filter(Boolean);
const approved = /^(?:README\.md|LICENSE|PROJECT_PLAN\.md|DESIGN_SPEC\.md|TASKS\.md|package(?:-lock)?\.json|vercel\.json|\.gitignore|\.vercelignore|\.env\.example|\.githooks\/pre-commit|content\/calendar\.example\.json|public\/robots\.txt|public\/demo\/invierno\.svg|(?:src|scripts|api|tests)\/[a-zA-Z0-9_./-]+\.m?js|src\/client\/style\.css)$/;
const signatures = /-----BEGIN [A-Z ]*PRIVATE KEY-----|vercel_blob_rw_[a-zA-Z0-9_]{12,}|(?:^|\n)(?:ACCESS_CODE|SESSION_SECRET|BLOB_READ_WRITE_TOKEN)[ \t]*=[ \t]*[^\s#]/;
let failed = false;
for (const entry of paths) {
  const tab = entry.indexOf('\t');
  const [mode, object, stage] = entry.slice(0, tab).split(' ');
  const path = entry.slice(tab + 1);
  const blocked = !/^100(644|755)$/.test(mode) || stage !== '0' || !approved.test(path) ||
    /(?:^|\/)(?:private|dist|node_modules)(?:\/|$)|\.(?:private|local)\./i.test(path);
  const staged = blocked ? null : git('cat-file', 'blob', object);
  if (blocked || staged.includes(0) || signatures.test(staged.toString())) {
    console.error('Revisa este archivo del índice: ' + JSON.stringify(path));
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
