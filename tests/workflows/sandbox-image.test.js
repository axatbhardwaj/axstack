import { expect, test } from 'bun:test';

const asset = (name) => Bun.file(new URL(`../../skills/axstack/sandbox/${name}`, import.meta.url));

test('workload Dockerfile uses a digest base and finishes as a non-root user', async () => {
  const dockerfile = await asset('Dockerfile').text();
  expect(dockerfile).toMatch(/^FROM\s+\S+@sha256:[a-f0-9]{64}/m);
  expect(dockerfile.match(/^USER\s+(.*)$/gm)?.at(-1)).toMatch(/\b61234:61234$/);
  expect(dockerfile).not.toMatch(/^VOLUME\b/m);
  expect(dockerfile).toMatch(/probes-image-build\.js/);
});

test('fixed sidecars cover required services and every image-declared volume with capped non-root tmpfs', async () => {
  const sidecars = await asset('sidecars.json').json();
  const expected = { postgres16: ['/var/lib/postgresql/data'], postgres17: ['/var/lib/postgresql/data'], redis: ['/data'], azurite: ['/data'], prometheus: ['/prometheus'], grafana: [], otel: [], nginx: [] };
  expect(sidecars.images.map((i) => i.id).sort()).toEqual(Object.keys(expected).sort());
  for (const image of sidecars.images) {
    expect(image.image).toMatch(/@sha256:[a-f0-9]{64}$/);
    expect(image.argv.length).toBeGreaterThan(0);
    const paths = image.declaredVolumes.map((v) => v.path);
    for (const path of expected[image.id]) expect(paths).toContain(path);
    for (const volume of image.declaredVolumes) {
      expect(volume.bytes).toBeGreaterThan(0);
      expect(volume.uid).toBe(61234);
      expect(volume.gid).toBe(61234);
      expect(volume.mode).toMatch(/^0[0-7]{3}$/);
    }
  }
});


test('runtime uid agrees across policy, image and all writable sidecars', async () => {
  const policy = await asset('launcher-policy.json').json();
  expect(policy.user).toBe('61234:61234');
  expect(policy.environment.find(e => e.name === 'TMPDIR')?.value).toBe('/work');
  const sidecars = await asset('sidecars.json').json();
  for (const image of sidecars.images) {
    if (image.id.startsWith('postgres')) {
      expect(image.argv.join(' ')).toContain('sandbox:x:61234:61234:');
      expect(image.argv.join(' ')).not.toContain('sandbox:x:1000:');
    }
  }
});
