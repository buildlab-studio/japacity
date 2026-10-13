// The teaser's render settings (pnpm teaser:render passes the same): H.264 at a quality that keeps the stickers' edges.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(20);
