export default function DnaSwitch({ checked, onChange, label, className = '' }) {
  return (
    <label className={`dna-switch ${className}`}>
      <input
        type="checkbox"
        className="dna-switch__input"
        checked={checked}
        onChange={e => onChange?.(e.target.checked)}
      />
      <span className="dna-switch__track">
        <span className="dna-switch__thumb" />
      </span>
      {label && <span className="dna-switch__label">{label}</span>}
    </label>
  )
}
