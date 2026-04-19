/**
 * Removes `<script>` tags from strings passed to `dangerouslySetInnerHTML`.
 * React 19 rejects parsed markup that includes script nodes; AI-generated SVG/HTML may wrap Mermaid or loaders in scripts.
 */
export function stripScriptTagsFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
}
