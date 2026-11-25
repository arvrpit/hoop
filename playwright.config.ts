import { defineConfig } from '@playwright/test';

// Screenshot checks for the review milestones (M1 look test, M3 interaction).
// WebGL needs a real GPU for meaningful frame timing; the screenshots themselves
// are deterministic and also work on SwiftShader.
export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5183',
    storageState: 'e2e/storage.json', // onboarding already seen (e2e/onboarding.spec.ts starts fresh)
    launchOptions: {
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
