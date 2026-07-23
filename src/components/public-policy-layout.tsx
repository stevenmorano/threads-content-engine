import Link from "next/link";
import { Brand } from "@/components/brand";

export function PublicPolicyLayout({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="policy-shell">
      <nav className="policy-nav" aria-label="Public information">
        <Link href="/"><Brand /></Link>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/data-deletion">Data deletion</Link>
          <Link className="button button-secondary" href="/login">Sign in</Link>
        </div>
      </nav>
      <article className="policy-document">
        <header>
          <span className="kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="policy-content">{children}</div>
      </article>
    </main>
  );
}
