export default function Loading() {
  return (
    <>
      <header>
        <div className="wordmark">Leinster Hockey</div>
        <h1 className="headline">
          Top<br />
          <span>Scorers.</span>
        </h1>
        <div className="header-row">
          <nav className="header-nav">
            <a href="/">← Competitions</a>
          </nav>
        </div>
      </header>
      <main>
        <div className="loading-block">
          <div className="spinner" />
          Loading…
        </div>
      </main>
    </>
  );
}
