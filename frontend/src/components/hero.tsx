export function Hero() {
  return (
    <section className="border-b border-border bg-gradient-to-b from-secondary/40 to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 text-center">
        <h1
          className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight"
          style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
        >
          Cơ hội việc làm <span className="text-primary">Data</span>
          <br className="hidden sm:block" /> tại{' '}
          <span className="whitespace-nowrap">Việt Nam</span>
        </h1>
      </div>
    </section>
  );
}
