import { Hono } from "hono";
import type { Env } from "../types/hono";
import { rssRoutes } from "./podcast/rss";

export const podcastRoutes = new Hono<{
  Bindings: Env;
}>();

podcastRoutes.route("/rss", rssRoutes);
