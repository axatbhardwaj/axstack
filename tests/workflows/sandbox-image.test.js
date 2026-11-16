import { expect, test } from 'bun:test';

const asset = (name) => Bun.file(new URL(`../../skills/axstack/sandbox/${name}`, import.meta.url));

test('workload Dockerfile uses a digest base and finishes as a non-root user', async () => {
  const dockerfile = await asset('Dockerfile').text();
  expect(dockerfile).toMatch(/^FROM\s+\S+@sha256:[a-f0-9]{64}/m);
  expect(dockerfile.match(/^USER\s+(.*)$/gm)?.at(-1)).toMatch(/\b1000:1000$/);
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
      expect(volume.uid).toBe(1000);
      expect(volume.gid).toBe(1000);
      expect(volume.mode).toMatch(/^0[0-7]{3}$/);
    }
  }
});
