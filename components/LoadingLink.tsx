"use client";

import Link from "next/link";

type LoadingLinkProps = React.ComponentProps<typeof Link>;

export default function LoadingLink({
  href,
  children,
  ...props
}: LoadingLinkProps) {
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}