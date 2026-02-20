const { execSync } = require('child_process');
try {
    const result = execSync('node_modules\\.bin\\tsc.cmd --noEmit --pretty false 2>&1', {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: __dirname
    });
    console.log('NO ERRORS');
    console.log(result);
} catch (e) {
    console.log('TYPE ERRORS FOUND:');
    console.log(e.stdout || '');
    console.log(e.stderr || '');
}
