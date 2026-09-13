import {spawn} from 'child_process';
import {startRemoteFixtureServer} from '../fixtures/remote-responses-server';

const port = Number(process.env.E2E_REMOTE_FIXTURE_PORT) || 18080;
const serial = process.env.E2E_DEVICE_UDID || 'emulator-5554';
const dryRun = process.argv.includes('--dry-run');

function run(
  command: string,
  args: string[],
  env = process.env,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {env, stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  if (dryRun) {
    console.log(
      `[remote-responses] dry run: adb -s ${serial} reverse tcp:${port} tcp:${port}`,
    );
    console.log(
      '[remote-responses] dry run: npx wdio wdio.android.local.conf.ts --spec specs/features/remote-responses.spec.ts',
    );
    return;
  }
  const fixture = await startRemoteFixtureServer({port});
  console.log(`[remote-responses] fixture: ${fixture.url}`);
  try {
    const reverseCode = await run('adb', [
      '-s',
      serial,
      'reverse',
      `tcp:${port}`,
      `tcp:${port}`,
    ]);
    if (reverseCode !== 0) {
      throw new Error(`adb reverse failed for ${serial}`);
    }
    const args = [
      'wdio',
      'wdio.android.local.conf.ts',
      '--spec',
      'specs/features/remote-responses.spec.ts',
    ];
    if (process.env.E2E_REMOTE_GREP) {
      args.push('--mochaOpts.grep', process.env.E2E_REMOTE_GREP);
    }
    const code = await run('npx', args, {
      ...process.env,
      E2E_REMOTE_FIXTURE_URL: fixture.url,
      E2E_REMOTE_FIXTURE_PORT: String(port),
    });
    if (code !== 0) {
      process.exitCode = code;
    }
  } finally {
    await run('adb', [
      '-s',
      serial,
      'reverse',
      '--remove',
      `tcp:${port}`,
    ]).catch(() => 1);
    await fixture.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
