export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-muted max-w-sm mx-auto">{note}</p>
      <p className="text-[11px] text-muted mt-6">（核心三页 + 明日计划已用 mock 数据实现，可点击体验）</p>
    </div>
  )
}
