/**
 * NDK 27 + ld.lld on Windows can omit libc++ from the link line for some CMake targets,
 * causing undefined __cxa_* / iostream symbols in expo-modules-core and react-native-screens.
 * Idempotent: safe to run on every npm install (postinstall).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CPP = '${CPP_SHARED_LIB}';

function patchFile(relPath, apply) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return;
  const before = fs.readFileSync(full, 'utf8');
  const after = apply(before);
  if (after !== before) fs.writeFileSync(full, after, 'utf8');
}

patchFile('node_modules/expo-modules-core/android/CMakeLists.txt', (t) => {
  if (t.includes('find_library(CPP_SHARED_LIB c++_shared)')) return t;
  return t.replace(
    'find_library(LOG_LIB log)\n\nfind_package(ReactAndroid REQUIRED CONFIG)',
    `find_library(LOG_LIB log)\n# NDK 27 + lld on Windows may not implicitly link libc++; explicit link fixes undefined __cxa_* / iostream symbols.\nfind_library(CPP_SHARED_LIB c++_shared)\n\nfind_package(ReactAndroid REQUIRED CONFIG)`,
  );
});

patchFile('node_modules/expo-modules-core/android/CMakeLists.txt', (t) => {
  const needle = `  ReactAndroid::reactnative\n)`;
  const insert = `  ReactAndroid::reactnative\n  ${CPP}\n)`;
  if (t.includes(`ReactAndroid::reactnative\n  ${CPP}`)) return t;
  if (!t.includes(needle)) return t;
  return t.replace(needle, insert);
});

patchFile('node_modules/react-native-screens/android/CMakeLists.txt', (t) => {
  if (t.includes('find_library(CPP_SHARED_LIB c++_shared)')) return t;
  return t.replace(
    'find_package(ReactAndroid REQUIRED CONFIG)\n\nif(${RNS_NEW_ARCH_ENABLED})',
    'find_package(ReactAndroid REQUIRED CONFIG)\n# NDK 27 + lld on Windows: ensure libc++ is linked (undefined __cxa_* / std:: symbols).\nfind_library(CPP_SHARED_LIB c++_shared)\n\nif(${RNS_NEW_ARCH_ENABLED})',
  );
});

patchFile('node_modules/react-native-screens/android/CMakeLists.txt', (t) => {
  const block = `            fbjni::fbjni\n            android\n        )\n    else()`;
  if (t.includes(`android\n            ${CPP}\n        )\n    else()`)) return t;
  if (!t.includes(block)) return t;
  return t.replace(
    block,
    `            fbjni::fbjni\n            android\n            ${CPP}\n        )\n    else()`,
  );
});

patchFile('node_modules/react-native-screens/android/CMakeLists.txt', (t) => {
  const block = `                fbjni::fbjni\n                android\n        )\n    endif()`;
  if (t.includes(`android\n                ${CPP}\n        )\n    endif()`)) return t;
  if (!t.includes(block)) return t;
  return t.replace(
    block,
    `                fbjni::fbjni\n                android\n                ${CPP}\n        )\n    endif()`,
  );
});

patchFile('node_modules/react-native-screens/android/CMakeLists.txt', (t) => {
  const block = `        ReactAndroid::jsi\n        android\n    )\nendif()`;
  if (t.includes(`android\n        ${CPP}\n    )\nendif()`)) return t;
  if (!t.includes(block)) return t;
  return t.replace(
    block,
    `        ReactAndroid::jsi\n        android\n        ${CPP}\n    )\nendif()`,
  );
});
