import DnaSwitch from './DnaSwitch'

export default function StudioHeader({ theme, onThemeToggle }) {
  return (
    <header className="studio-header">
      <div className="studio-header__brand">
        {/* intentionally empty — space reserved */}
      </div>
      <div className="studio-header__right">
        <DnaSwitch
          checked={theme === 'light'}
          onChange={v => onThemeToggle(v ? 'light' : 'dark')}
          label={theme === 'light' ? 'LIGHT' : 'DARK'}
        />
      </div>
    </header>
  )
}
