import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * 서버 의존성 번들링 allowlist
 * 
 * 이 패키지들은 번들에 포함되어 cold start 시 openat(2) syscall을 줄입니다.
 * 번들링 대상 선택 기준:
 * - 작은 크기의 유틸리티 라이브러리
 * - 자주 사용되는 핵심 의존성
 * - 번들링 시 성능 이점이 큰 패키지
 */
const BUNDLE_ALLOWLIST = [
  "date-fns",
  "express",
  "zod",
  "zod-validation-error",
] as const;

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(
    await readFile("package.json", "utf-8"),
  ) as PackageJson;
  
  // 프로덕션 빌드에서는 devDependencies를 제외해야 함
  // devDependencies는 프로덕션 환경에 설치되지 않으므로 externals에 포함할 필요 없음
  const productionDeps = Object.keys(pkg.dependencies || {});
  const allowlistSet = new Set(BUNDLE_ALLOWLIST);
  const externals = productionDeps.filter((dep) => !allowlistSet.has(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
