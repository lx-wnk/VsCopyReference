import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
    runTests,
} from '@vscode/test-electron';

const FIXTURES: Record<string, string> = {
    phptools: 'php',
    intelephense: 'php',
    js: 'js',
    none: 'none',
};

const PROVIDER_EXTENSIONS: Record<string, string | undefined> = {
    phptools: 'devsense.phptools-vscode',
    intelephense: 'bmewburn.vscode-intelephense-client',
};

async function main(): Promise<void> {
    const [provider, suite] = process.argv.slice(2);
    if (!(provider in FIXTURES) || !suite) {
        throw new Error(`Usage: runTests.js <${Object.keys(FIXTURES).join('|')}> <spike|php|js|none|command>`);
    }

    const root = path.resolve(__dirname, '../../..');
    const extensionTestsPath = path.join(
        root,
        'out/test/integration',
        suite === 'spike' ? 'spike.js' : `${suite}Suite.js`,
    );
    const fixture = path.join(root, 'test/fixtures', FIXTURES[provider]);
    const extensionsDir = path.join(root, `.vscode-test/extensions-${provider}`);
    const userDataDir = path.join(os.tmpdir(), `cr-user-${provider}`);

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const providerExtension = PROVIDER_EXTENSIONS[provider];
    if (providerExtension) {
        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        const result = cp.spawnSync(
            cli,
            [...args, '--extensions-dir', extensionsDir, '--install-extension', providerExtension],
            { encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' },
        );
        if (result.status !== 0) {
            throw new Error(`Installing ${providerExtension} failed with status ${result.status}`);
        }
    }

    await runTests({
        vscodeExecutablePath,
        extensionDevelopmentPath: root,
        extensionTestsPath,
        extensionTestsEnv: { COPY_REFERENCE_PROVIDER: provider },
        launchArgs: [
            fixture,
            '--extensions-dir', extensionsDir,
            '--user-data-dir', userDataDir,
            '--disable-workspace-trust',
        ],
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
