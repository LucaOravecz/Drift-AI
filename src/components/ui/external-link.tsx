import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
  title?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
}

/**
 * External link component with visual indicator
 * Automatically opens in new tab and includes rel="noopener noreferrer" for security
 */
export function ExternalLink({
  href,
  children,
  className = "",
  showIcon = true,
  title,
  target = "_blank",
  rel = "noopener noreferrer",
}: ExternalLinkProps) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  if (!isExternal) {
    // Use Next.js Link for internal links
    return (
      <Link href={href} className={className} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`inline-flex items-center gap-1 ${className}`}
      title={title}
    >
      {children}
      {showIcon && (
        <ExternalLinkIcon
          className="h-3.5 w-3.5 inline-block"
          aria-hidden="true"
        />
      )}
    </a>
  );
}
