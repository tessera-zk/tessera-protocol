#!/usr/bin/env bash
# install_rapidsnark.sh -- build the rapidsnark C++ prover (issue #39).
# rapidsnark replaces ONLY the proving step (witness -> proof); trusted setup
# stays snarkjs, witness generation stays circom/snarkjs. 3-6x faster proving,
# lower memory — the depth-10 prove path when a proof must be made on a
# smaller box AFTER phase-2 ran elsewhere.
# Requirements: cmake, g++, libgmp-dev, libsodium-dev, nasm.
set -euo pipefail
echo "[rapidsnark] checking build deps..."
for t in cmake g++ nasm git; do which "$t" >/dev/null || { echo "missing: $t"; exit 1; }; done
echo "[rapidsnark] deps OK (libgmp/libsodium checked at cmake configure time)"
if [ -d /tmp/opencode/rapidsnark ]; then echo "[rapidsnark] already cloned at /tmp/opencode/rapidsnark"; exit 0; fi
git clone --depth 1 https://github.com/iden3/rapidsnark.git /tmp/opencode/rapidsnark
cd /tmp/opencode/rapidsnark
git submodule update --init --recursive
echo "[rapidsnark] configure + build (nproc=$(nproc))"
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j"$(nproc)" prover
echo "[rapidsnark] prover at /tmp/opencode/rapidsnark/build/prover"
echo "[rapidsnark] usage: prover <zkey> <witness.wtns> <proof.json> <public.json>"
