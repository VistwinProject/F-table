// 頂部細條。
// ⚠ 右側原本掛著一個深色／淺色切換（DnaSwitch），已經移除 —— 展場的桌面是投影，
//   只會用深色，那顆開關擺著只會被誤觸。元件本身也一併刪了。
//   這條 header 保留：它的下緣細線是外框視覺的一部分，而且撐出上方的留白。
export default function StudioHeader() {
  return (
    <header className="studio-header">
      <div className="studio-header__brand">
        {/* intentionally empty — space reserved */}
      </div>
    </header>
  )
}
