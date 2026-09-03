/**
 * What a note actually says, as opposed to what it contains.
 *
 * A note body is HTML, and a lot of what is in it carries no meaning for a
 * study guide: image tags for imported slides, empty paragraphs, the heading
 * the importer stamps on top. Everything downstream that asks "is there
 * enough here to study?" has to ask it of the prose, not the markup.
 */

/** Visible prose in a note body, with markup and entities resolved away. */
export function plainTextFromHtml(html: string): string {
  return (
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Block boundaries are word boundaries; without this, "</p><p>" would
      // glue the last word of one paragraph to the first of the next.
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The least prose worth generating a study guide from.
 *
 * This is a correctness guard, not a style preference. Below this, the model
 * has nothing to summarise and will pad the gap with plausible-sounding
 * material from the title — which is the single worst thing this app can do
 * to someone revising from it. It has to be high enough that a title plus an
 * imported-slide heading cannot clear it on their own.
 */
export const MIN_STUDY_CHARS = 120;
