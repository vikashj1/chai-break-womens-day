export function Header() {
  return (
    <header className="header" style={{ backgroundImage: 'url(/header-bg.png)' }}>
      <div className="header__inner">
        <div className="header__logos">
          <img className="header__logo" src="/chai-break-logo.png" alt="Chai Break" />
          <img
            className="header__logo header__logo--secondary"
            src="/womens-day.png"
            alt="Women's Day"
          />
        </div>

        <h1 className="header__title">Breaking Stereotypes.</h1>
        <p className="header__subtitle">A Refreshment on the House.</p>
      </div>
    </header>
  )
}
