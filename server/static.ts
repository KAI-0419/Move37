import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES modules에서 __dirname을 얻기 위한 방법
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // Vercel 환경에서는 dist/public 경로를 사용
  // 로컬에서는 server/public 또는 dist/public을 확인
  let distPath: string;
  
  if (process.env.VERCEL) {
    // Vercel에서는 프로젝트 루트 기준으로 경로 설정
    distPath = path.resolve(process.cwd(), "dist", "public");
  } else {
    // 로컬에서는 server/public 또는 dist/public 확인
    const serverPublicPath = path.resolve(__dirname, "public");
    const distPublicPath = path.resolve(__dirname, "..", "dist", "public");
    
    if (fs.existsSync(serverPublicPath)) {
      distPath = serverPublicPath;
    } else if (fs.existsSync(distPublicPath)) {
      distPath = distPublicPath;
    } else {
      distPath = distPublicPath; // 기본값으로 설정
    }
  }
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
