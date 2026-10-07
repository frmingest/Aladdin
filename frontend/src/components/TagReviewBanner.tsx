import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { bannerText } from "../lib/tagReview";

/** Shown under a Newsweb fetch: tells Faiz when the newest report has inputs
 * the extractor could not fill, with a link to the Tag review page. Renders
 * nothing when there is nothing to review or the call fails (it is a hint,
 * never a blocker). `refreshKey` changes after each fetch. */
export function TagReviewBanner({ holdingId, refreshKey }: { holdingId: string; refreshKey: unknown }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getTagReview(holdingId)
      .then((review) => live && setText(bannerText(review)))
      .catch(() => live && setText(null));
    return () => {
      live = false;
    };
  }, [holdingId, refreshKey]);

  if (!text) return null;
  return (
    <p className="mb-3 rounded-md bg-caution-subtle px-3 py-2 text-xs text-caution">
      {text}{" "}
      <Link to="/tag-review" className="font-medium underline">
        Open tag review
      </Link>
    </p>
  );
}
