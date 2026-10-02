interface Props {
  adTag: string
  width: number
  height: number
  label: string
}

/**
 * 忍者AdMaxの広告タグは document.write() に依存したレガシー形式のため、
 * SPA内でただの<script>としてDOMに差し込むと、ブラウザがそれを非同期扱いし、
 * 初回パース後にdocument.write()が呼ばれてdocument.open()相当の全消去が起こり、
 * React側のDOM全体が壊れる危険がある。iframe+srcDocで広告専用の別ドキュメントを
 * 持たせることで、document.write()の影響をそのiframe内だけに閉じ込める
 * （Reactアプリ本体には一切影響しない）。
 */
export function AdSlot({ adTag, width, height, label }: Props) {
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head><body>${adTag}</body></html>`

  return (
    <div className="mx-auto overflow-hidden" style={{ width, maxWidth: '100%', height }} aria-label={label}>
      <iframe
        title={label}
        srcDoc={srcDoc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        scrolling="no"
      />
    </div>
  )
}
