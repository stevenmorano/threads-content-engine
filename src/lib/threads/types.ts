import { z } from "zod";

export const threadsPostSchema = z.object({
  id: z.string(),
  media_product_type: z.string().optional(),
  media_type: z.string().optional(),
  permalink: z.string().optional(),
  owner: z.union([
    z.string(),
    z.object({ id: z.string().optional() }).passthrough(),
  ]).optional(),
  username: z.string().optional(),
  text: z.string().optional(),
  timestamp: z.string().optional(),
  shortcode: z.string().optional(),
  is_quote_post: z.boolean().optional(),
  quoted_post: z.unknown().optional(),
  reposted_post: z.unknown().optional(),
  has_replies: z.boolean().optional(),
  alt_text: z.string().optional(),
  link_attachment_url: z.string().optional(),
}).passthrough();

export const threadsSearchResponseSchema = z.object({
  data: z.array(threadsPostSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional(),
    }).optional(),
    next: z.string().optional(),
    previous: z.string().optional(),
  }).optional(),
});

export type ThreadsPost = z.infer<typeof threadsPostSchema>;
export type ThreadsSearchType = "TOP" | "RECENT";
