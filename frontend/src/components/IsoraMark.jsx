// The ISORA mark: the app icon's speech bubble and three-block I (resources/icon.svg), without
// the icon's dark square, for the wordmark on Home and the start screen. Lime from the accent,
// the I cut out in the page background so it sits right on any theme.
export default function IsoraMark({ className = 'isora-mark', size }) {
  return (
    <svg className={className} viewBox="96 92 320 336" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="var(--acc)" d="M184 92h144a88 88 0 0 1 88 88v120a88 88 0 0 1-88 88H226l-70 40 10-48a88 88 0 0 1-70-86V180a88 88 0 0 1 88-88Z" />
      <g fill="var(--bg)">
        <rect x="190" y="150" width="132" height="38" rx="11" />
        <rect x="237" y="199" width="38" height="82" rx="10" />
        <rect x="190" y="292" width="132" height="38" rx="11" />
      </g>
    </svg>
  )
}
