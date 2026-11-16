# Build context: skills/axstack/sandbox; build/smoke only in T21 integration.
# linux/amd64; every required artifact's version/checksum/source is in probes-image-pins.json.
# Base source: https://registry-1.docker.io/v2/library/debian/manifests/bookworm-slim
FROM docker.io/library/debian@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip xz-utils tar git build-essential pkg-config clang cmake \
    libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev \
    libcurl4-openssl-dev libxml2-dev libedit2 libicu72 libatomic1 libcurl4 libsqlite3-0 libncurses6 libpython3.11 liblzma-dev libncurses-dev libgdbm-dev uuid-dev libzstd-dev && \
    rm -r /var/lib/apt/lists/* && groupadd --gid 61234 reviewer && \
    useradd --uid 61234 --gid 61234 --home-dir /sandbox-home --create-home --shell /bin/bash reviewer
# Bootstrap source: https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/SHASUMS256.txt
ADD --checksum=sha256:951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip /tmp/bootstrap-bun.zip
RUN unzip -q /tmp/bootstrap-bun.zip -d /opt/bootstrap && rm /tmp/bootstrap-bun.zip
COPY probes-image-pins.json probes-image-build.js /opt/axstack-image/
ENV PATH="/opt/swift/usr/bin:/opt/swiftlint:/opt/node-24/bin:/opt/rust/bin:/opt/cargo-tools/bin:/opt/jdk-25/bin:/opt/go/bin:/opt/gradle/gradle-9.6.0/bin:/opt/kotlin/kotlinc/bin:/opt/android/cmdline-tools/23.0/bin:/opt/android/platform-tools:/opt/foundry:/opt/terraform:/opt/python-3.12/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    JAVA_HOME="/opt/jdk-25" JAVA_11_HOME="/opt/jdk-11" ANDROID_HOME="/opt/android" \
    ANDROID_SDK_ROOT="/opt/android" SVM_HOME="/opt/svm" HOME="/sandbox-home" \
    GRADLE_USER_HOME="/tmp/gradle" GRADLE_RO_DEP_CACHE="/opt/gradle-cache/caches/modules-2" PYTHONDONTWRITEBYTECODE="1"
RUN AXSTACK_IMAGE_BUILD=1 /opt/bootstrap/bun-linux-x64/bun /opt/axstack-image/probes-image-build.js --artifacts
COPY probes-android-platform.xml /opt/android/platforms/android-37.0/package.xml
RUN mkdir /tmp/axstack-image-cargo && AXSTACK_IMAGE_BUILD=1 /opt/bootstrap/bun-linux-x64/bun /opt/axstack-image/probes-image-build.js --preload
# Gradle creates private cache modes as root during preload; runtime is uid 61234.
RUN chmod -R a+rX /opt/gradle-cache
COPY inventory.json /opt/axstack-image/inventory.json
WORKDIR /work
USER 61234:61234
CMD ["/bin/bash"]
