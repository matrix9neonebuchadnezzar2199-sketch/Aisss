type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage ({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="hint">
        画面レイアウトの参照: <code>mockups/webui.html</code>（静的モック）
      </p>
    </section>
  )
}
