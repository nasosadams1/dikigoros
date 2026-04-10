import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const HEADER_OFFSET = 96;
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 50;

const ScrollToHash = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      return;
    }

    const targetId = decodeURIComponent(hash.slice(1));
    let attempts = 0;

    const scrollToTarget = () => {
      const element = document.getElementById(targetId);

      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }

      attempts += 1;
      if (attempts < MAX_ATTEMPTS) {
        window.setTimeout(scrollToTarget, RETRY_DELAY_MS);
      }
    };

    scrollToTarget();
  }, [pathname, hash]);

  return null;
};

export default ScrollToHash;
