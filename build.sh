#!/bin/bash

set -e

# export OPTIMIZE="-Os" # changed
export OPTIMIZE="-O3" # SIMD
export LDFLAGS=${OPTIMIZE}
# export CFLAGS=${OPTIMIZE} # changed
export CFLAGS="${OPTIMIZE} -msimd128" 
export CXXFLAGS=${OPTIMIZE}

ENTRY_POINT="rnnoise.js"
ENTRY_POINT_SYNC="rnnoise-sync.js"
MODULE_CREATE_NAME="createRNNWasmModule"
MODULE_CREATE_NAME_SYNC="createRNNWasmModuleSync"
RNN_EXPORTED_FUNCTIONS="['_rnnoise_process_frame', '_rnnoise_init', '_rnnoise_destroy', '_rnnoise_create', '_malloc', '_free']"


if [[ `uname` == "Darwin"  ]]; then
  SO_SUFFIX="dylib"
else
  SO_SUFFIX="so"
fi

echo "============================================="
echo "Compiling wasm bindings"
echo "============================================="
(
  cd rnnoise

  # Clean possible autotools clutter that might affect the configurations step
  git clean -f -d
  ./autogen.sh

  # For some reason setting the CFLAGS export doesn't apply optimization to all compilation steps
  # so we need to explicitly pass it to configure.
  emconfigure ./configure --enable-wasm-simd --enable-static=no --disable-examples --disable-doc  # changed
  emmake make clean
  emmake make V=1

  # For SIMD
  # Compile librnnoise generated LLVM bytecode to wasm with an async loading module.
  emcc \
    -msimd128 \  # changed
     ${OPTIMIZE} \
    -g2 \
    -s STRICT=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MALLOC=emmalloc \
    -s MODULARIZE=1 \
    -s ENVIRONMENT="web,worker" \
    -s EXPORT_ES6=1 \
    -s USE_ES6_IMPORT_META=0 \
    -s EXPORT_NAME=${MODULE_CREATE_NAME} \
    -s EXPORTED_FUNCTIONS="${RNN_EXPORTED_FUNCTIONS}" \
    .libs/librnnoise.${SO_SUFFIX} \
    -o ./$ENTRY_POINT

  # Compile librnnoise generated LLVM bytecode to wasm with a sync loading module and inline wasm bytecode.
  emcc \
    -msimd128 \  # changed
     ${OPTIMIZE} \
    -g2 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MALLOC=emmalloc \
    -s MODULARIZE=1 \
    -s ENVIRONMENT="web,worker" \
    -s EXPORT_ES6=1 \
    -s USE_ES6_IMPORT_META=1 \
    -s WASM_ASYNC_COMPILATION=0 \
    -s SINGLE_FILE=1 \
    -s EXPORT_NAME=${MODULE_CREATE_NAME_SYNC} \
    -s EXPORTED_FUNCTIONS="${RNN_EXPORTED_FUNCTIONS}" \
    .libs/librnnoise.${SO_SUFFIX} \
    -o ./$ENTRY_POINT_SYNC

  # # Compile librnnoise generated LLVM bytecode to wasm with an async loading module.
  # emcc \
  #   ${OPTIMIZE} \
  #   -g2 \
  #   -s STRICT=1 \
  #   -s ALLOW_MEMORY_GROWTH=1 \
  #   -s MALLOC=emmalloc \
  #   -s MODULARIZE=1 \
  #   -s ENVIRONMENT="web,worker" \
  #   -s EXPORT_ES6=1 \
  #   -s USE_ES6_IMPORT_META=0 \
  #   -s EXPORT_NAME=${MODULE_CREATE_NAME} \
  #   -s EXPORTED_FUNCTIONS="${RNN_EXPORTED_FUNCTIONS}" \
  #   .libs/librnnoise.${SO_SUFFIX} \
  #   -o ./$ENTRY_POINT

  # # Compile librnnoise generated LLVM bytecode to wasm with a sync loading module and inline wasm bytecode.
  # emcc \
  #   ${OPTIMIZE} \
  #   -g2 \
  #   -s ALLOW_MEMORY_GROWTH=1 \
  #   -s MALLOC=emmalloc \
  #   -s MODULARIZE=1 \
  #   -s ENVIRONMENT="web,worker" \
  #   -s EXPORT_ES6=1 \
  #   -s USE_ES6_IMPORT_META=1 \
  #   -s WASM_ASYNC_COMPILATION=0 \
  #   -s SINGLE_FILE=1 \
  #   -s EXPORT_NAME=${MODULE_CREATE_NAME_SYNC} \
  #   -s EXPORTED_FUNCTIONS="${RNN_EXPORTED_FUNCTIONS}" \
  #   .libs/librnnoise.${SO_SUFFIX} \
  #   -o ./$ENTRY_POINT_SYNC

  # Create output folder
  rm -rf ../dist
  mkdir -p ../dist

  # Move artifacts
  mv $ENTRY_POINT ../dist/
  mv $ENTRY_POINT_SYNC ../dist/
  mv rnnoise.wasm ../dist/

  # Clean cluttter
  git clean -f -d
)
echo "============================================="
echo "Compiling wasm bindings done"
echo "============================================="
